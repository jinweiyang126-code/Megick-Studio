-- Support audit log ORDER BY createdAt without sorting large JSON before/after columns.
CREATE INDEX `admin_audit_logs_createdAt_idx` ON `admin_audit_logs`(`createdAt`);
