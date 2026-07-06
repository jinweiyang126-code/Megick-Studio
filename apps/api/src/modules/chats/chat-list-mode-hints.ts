import type { GenerationJobType, PrismaClient } from "@prisma/client";
import {
  CHAT_LIST_MODE_JOB_TAKE,
  CHAT_LIST_MODE_MESSAGE_TAKE,
} from "./chat-list-query";

export type ChatListModeHints = {
  jobs: Array<{ id: string; type: GenerationJobType; createdAt: Date }>;
  messages: Array<{ metadata: unknown }>;
};

/** Per-session indexed lookups — avoids Prisma nested include global sort. */
export async function loadChatListModeHints(
  prisma: PrismaClient,
  sessionIds: string[],
): Promise<Map<string, ChatListModeHints>> {
  if (!sessionIds.length) return new Map();

  const entries = await Promise.all(
    sessionIds.map(async (sessionId) => {
      const [jobs, messages] = await Promise.all([
        prisma.generationJob.findMany({
          where: { chatSessionId: sessionId },
          orderBy: { createdAt: "desc" },
          take: CHAT_LIST_MODE_JOB_TAKE,
          select: { id: true, type: true, createdAt: true },
        }),
        prisma.chatMessage.findMany({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
          take: CHAT_LIST_MODE_MESSAGE_TAKE,
          select: { metadata: true },
        }),
      ]);
      return [sessionId, { jobs, messages }] as const;
    }),
  );

  return new Map(entries);
}
