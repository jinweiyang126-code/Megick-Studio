-- Support public template listing ORDER BY without sorting large TEXT columns.
CREATE INDEX `prompt_templates_public_list_idx` ON `prompt_templates`(`status`, `isFeatured`, `sortOrder`, `createdAt`);
