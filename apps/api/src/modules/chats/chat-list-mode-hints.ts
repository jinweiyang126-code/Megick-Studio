import {
  Prisma,
  type GenerationJobTypeEnum,
  type PrismaClient,
} from "@prisma/client";
import {
  CHAT_LIST_MODE_JOB_TAKE,
  CHAT_LIST_MODE_MESSAGE_TAKE,
} from "./chat-list-query";

export type ChatListModeHints = {
  jobs: Array<{ id: string; type: GenerationJobTypeEnum; createdAt: Date }>;
  messages: Array<{ metadata: unknown }>;
};

const MODE_JOB_TYPES = new Set<GenerationJobTypeEnum>([
  "IMAGE2VIDEO",
  "TEXT2IMAGE",
  "IMAGE_EDIT",
]);

type JobRow = {
  id: string;
  chatSessionId: string;
  type: GenerationJobTypeEnum;
  createdAt: Date;
};

type MessageRow = {
  sessionId: string;
  metadata: unknown;
};

function jobsIndicateMode(
  jobs: Array<Pick<ChatListModeHints["jobs"][number], "type">>,
) {
  return jobs.some((job) => MODE_JOB_TYPES.has(job.type));
}

function groupJobsBySession(sessionIds: string[], rows: JobRow[]) {
  const map = new Map<string, ChatListModeHints["jobs"]>();
  for (const id of sessionIds) map.set(id, []);
  for (const row of rows) {
    const jobs = map.get(row.chatSessionId);
    if (!jobs) continue;
    jobs.push({
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
    });
  }
  for (const jobs of map.values()) {
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return map;
}

function groupMessagesBySession(sessionIds: string[], rows: MessageRow[]) {
  const map = new Map<string, ChatListModeHints["messages"]>();
  for (const id of sessionIds) map.set(id, []);
  for (const row of rows) {
    const messages = map.get(row.sessionId);
    if (!messages) continue;
    messages.push({ metadata: row.metadata });
  }
  return map;
}

async function loadRecentJobsBySession(
  prisma: PrismaClient,
  sessionIds: string[],
) {
  return prisma.$queryRaw<JobRow[]>(Prisma.sql`
    SELECT id, chatSessionId, type, createdAt
    FROM (
      SELECT
        id,
        chatSessionId,
        type,
        createdAt,
        ROW_NUMBER() OVER (
          PARTITION BY chatSessionId ORDER BY createdAt DESC
        ) AS rn
      FROM generation_jobs
      WHERE chatSessionId IN (${Prisma.join(sessionIds)})
    ) ranked
    WHERE rn <= ${CHAT_LIST_MODE_JOB_TAKE}
  `);
}

async function loadRecentMessagesBySession(
  prisma: PrismaClient,
  sessionIds: string[],
) {
  return prisma.$queryRaw<MessageRow[]>(Prisma.sql`
    SELECT sessionId, metadata
    FROM (
      SELECT
        sessionId,
        metadata,
        ROW_NUMBER() OVER (
          PARTITION BY sessionId ORDER BY createdAt DESC
        ) AS rn
      FROM chat_messages
      WHERE sessionId IN (${Prisma.join(sessionIds)})
    ) ranked
    WHERE rn <= ${CHAT_LIST_MODE_MESSAGE_TAKE}
  `);
}

/** Batch indexed LIMIT queries — PARTITION BY session, safe for heavy sessions. */
export async function loadChatListModeHints(
  prisma: PrismaClient,
  sessionIds: string[],
): Promise<Map<string, ChatListModeHints>> {
  if (!sessionIds.length) return new Map();

  const jobRows = await loadRecentJobsBySession(prisma, sessionIds);
  const jobsBySession = groupJobsBySession(sessionIds, jobRows);

  const messageSessionIds = sessionIds.filter(
    (sessionId) => !jobsIndicateMode(jobsBySession.get(sessionId) ?? []),
  );

  const messagesBySession = new Map<string, ChatListModeHints["messages"]>();
  for (const sessionId of sessionIds) messagesBySession.set(sessionId, []);

  if (messageSessionIds.length) {
    const messageRows = await loadRecentMessagesBySession(
      prisma,
      messageSessionIds,
    );
    for (const [sessionId, messages] of groupMessagesBySession(
      messageSessionIds,
      messageRows,
    )) {
      messagesBySession.set(sessionId, messages);
    }
  }

  return new Map(
    sessionIds.map(
      (sessionId) =>
        [
          sessionId,
          {
            jobs: jobsBySession.get(sessionId) ?? [],
            messages: messagesBySession.get(sessionId) ?? [],
          },
        ] as const,
    ),
  );
}
