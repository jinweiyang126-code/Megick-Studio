import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import type { AdminAction } from "@prisma/client";
import {
  type AdminAuditRequestContext,
  markAdminAuditRecorded,
} from "@/common/utils/admin-audit-context";
import { redactSecrets } from "@/common/utils/redact-secrets";

export type AdminAuditLogInput = {
  adminId?: string | null;
  action: AdminAction;
  targetType: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logExplicit(
    ctx: AdminAuditRequestContext | undefined,
    input: Omit<AdminAuditLogInput, "adminId" | "ip" | "userAgent">,
  ) {
    if (!ctx?.audit.adminId) return;
    await this.logSafe({
      ...input,
      adminId: ctx.audit.adminId,
      ip: ctx.audit.ip,
      userAgent: ctx.audit.userAgent,
      before:
        input.before === undefined ? undefined : redactSecrets(input.before),
      after: input.after === undefined ? undefined : redactSecrets(input.after),
    });
    markAdminAuditRecorded(ctx.request);
  }

  async logSafe(input: AdminAuditLogInput) {
    try {
      await this.log(input);
    } catch (err) {
      this.logger.warn(
        `Failed to write admin audit log for ${input.action} ${input.targetType}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  log(input: AdminAuditLogInput) {
    return this.prisma.adminAuditLog.create({
      data: {
        adminId: input.adminId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: input.before as object,
        after: input.after as object,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  }
}
