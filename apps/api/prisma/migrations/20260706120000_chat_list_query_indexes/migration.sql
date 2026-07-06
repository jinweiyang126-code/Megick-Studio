-- CreateIndex
CREATE INDEX `chat_sessions_userId_archived_updatedAt_idx` ON `chat_sessions`(`userId`, `archived`, `updatedAt`);

-- CreateIndex
CREATE INDEX `generation_jobs_chatSessionId_createdAt_idx` ON `generation_jobs`(`chatSessionId`, `createdAt`);
