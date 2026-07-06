-- Improve message pagination within a session (ORDER BY createdAt + LIMIT).
CREATE INDEX `chat_messages_sessionId_createdAt_idx` ON `chat_messages`(`sessionId`, `createdAt`);
