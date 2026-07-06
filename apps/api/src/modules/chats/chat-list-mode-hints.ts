import type { GenerationJobTypeEnum, PrismaClient } from "@prisma/client";
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

function jobsIndicateMode(
  jobs: Array<Pick<ChatListModeHints["jobs"][number], "type">>,
) {
  return jobs.some((job) => MODE_JOB_TYPES.has(job.type));
}

/** Indexed per-session LIMIT queries — safe for heavy sessions (no global window sort). */
export async function loadChatListModeHints(
  prisma: PrismaClient,
  sessionIds: string[],
): Promise<Map<string, ChatListModeHints>> {
  if (!sessionIds.length) return new Map();

  const entries = await Promise.all(
    sessionIds.map(async (sessionId) => {
      const jobs = await prisma.generationJob.findMany({
        where: { chatSessionId: sessionId },
        orderBy: { createdAt: "desc" },
        take: CHAT_LIST_MODE_JOB_TAKE,
        select: { id: true, type: true, createdAt: true },
      });

      const messages = jobsIndicateMode(jobs)
        ? []
        : await prisma.chatMessage.findMany({
            where: { sessionId },
            orderBy: { createdAt: "desc" },
            take: CHAT_LIST_MODE_MESSAGE_TAKE,
            select: { metadata: true },
          });

      return [sessionId, { jobs, messages }] as const;
    }),
  );

  return new Map(entries);
}
