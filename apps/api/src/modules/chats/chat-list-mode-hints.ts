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

/** One round trip; each branch uses (sessionId, createdAt) index LIMIT — no window sort. */
function unionPerSessionLimit(
  sessionIds: string[],
  build: (sessionId: string) => Prisma.Sql,
) {
  return Prisma.join(
    sessionIds.map((sessionId) => Prisma.sql`(${build(sessionId)})`),
    " UNION ALL ",
  );
}

async function loadRecentJobsBySession(
  prisma: PrismaClient,
  sessionIds: string[],
) {
  return prisma.$queryRaw<JobRow[]>(
    unionPerSessionLimit(sessionIds, (sessionId) => Prisma.sql`
      SELECT id, chatSessionId, type, createdAt
      FROM generation_jobs
      WHERE chatSessionId = ${sessionId}
      ORDER BY createdAt DESC
      LIMIT ${CHAT_LIST_MODE_JOB_TAKE}
    `),
  );
}

async function loadRecentMessagesBySession(
  prisma: PrismaClient,
  sessionIds: string[],
) {
  return prisma.$queryRaw<MessageRow[]>(
    unionPerSessionLimit(sessionIds, (sessionId) => Prisma.sql`
      SELECT sessionId, metadata
      FROM chat_messages
      WHERE sessionId = ${sessionId}
      ORDER BY createdAt DESC
      LIMIT ${CHAT_LIST_MODE_MESSAGE_TAKE}
    `),
  );
}

/**
 * Batch mode hints in 1–2 SQL round trips.
 * Uses UNION ALL of per-session indexed LIMIT (not ROW_NUMBER) to avoid MySQL 1038.
 */
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
