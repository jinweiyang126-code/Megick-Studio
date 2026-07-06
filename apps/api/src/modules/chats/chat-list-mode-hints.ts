import { Prisma } from "@prisma/client";
import type { GenerationJobTypeEnum, PrismaClient } from "@prisma/client";
import {
  CHAT_LIST_MODE_JOB_TAKE,
  CHAT_LIST_MODE_MESSAGE_TAKE,
} from "./chat-list-query";

export type ChatListModeHints = {
  jobs: Array<{ id: string; type: GenerationJobTypeEnum; createdAt: Date }>;
  messages: Array<{ metadata: unknown }>;
};

type RankedJobRow = {
  id: string;
  type: GenerationJobTypeEnum;
  createdAt: Date;
  chatSessionId: string;
};

type RankedMessageRow = {
  metadata: unknown;
  sessionId: string;
};

function emptyHintsMap(sessionIds: string[]) {
  return new Map(
    sessionIds.map((sessionId) => [
      sessionId,
      { jobs: [], messages: [] } satisfies ChatListModeHints,
    ]),
  );
}

/** Batched window queries — 2 SQL round trips instead of 2N per-session lookups. */
export async function loadChatListModeHints(
  prisma: PrismaClient,
  sessionIds: string[],
): Promise<Map<string, ChatListModeHints>> {
  if (!sessionIds.length) return new Map();

  const [jobRows, messageRows] = await Promise.all([
    prisma.$queryRaw<RankedJobRow[]>`
      SELECT id, type, createdAt, chatSessionId
      FROM (
        SELECT
          id,
          type,
          createdAt,
          chatSessionId,
          ROW_NUMBER() OVER (
            PARTITION BY chatSessionId
            ORDER BY createdAt DESC
          ) AS rn
        FROM generation_jobs
        WHERE chatSessionId IN (${Prisma.join(sessionIds)})
      ) ranked
      WHERE rn <= ${CHAT_LIST_MODE_JOB_TAKE}
    `,
    prisma.$queryRaw<RankedMessageRow[]>`
      SELECT metadata, sessionId
      FROM (
        SELECT
          metadata,
          sessionId,
          ROW_NUMBER() OVER (
            PARTITION BY sessionId
            ORDER BY createdAt DESC
          ) AS rn
        FROM chat_messages
        WHERE sessionId IN (${Prisma.join(sessionIds)})
      ) ranked
      WHERE rn <= ${CHAT_LIST_MODE_MESSAGE_TAKE}
    `,
  ]);

  const hints = emptyHintsMap(sessionIds);

  for (const row of jobRows) {
    hints.get(row.chatSessionId)?.jobs.push({
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
    });
  }

  for (const row of messageRows) {
    hints.get(row.sessionId)?.messages.push({ metadata: row.metadata });
  }

  return hints;
}
