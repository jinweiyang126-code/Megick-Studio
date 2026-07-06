import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import type { AuthUserContext } from "@/common/decorators/current-user.decorator";
import { isAdminAuditRecorded } from "@/common/utils/admin-audit-context";
import {
  adminRequestPathname,
  extractAdminAuditTargetId,
  resolveAdminAuditAction,
  resolveAdminAuditTarget,
  shouldAuditAdminWriteRequest,
} from "@/common/utils/admin-audit-target";
import { redactSecrets } from "@/common/utils/redact-secrets";
import { AdminAuditService } from "@/modules/admin/admin-audit.service";

type AdminRequest = Request & {
  user?: AuthUserContext;
  body?: unknown;
};

function clientIp(req: AdminRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim();
  }
  return req.ip || undefined;
}

function adminIdFromLoginResponse(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const id = record.id;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const pathname = adminRequestPathname(req.originalUrl, req.path);
    if (!shouldAuditAdminWriteRequest(req.method, pathname)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        void this.record(req, pathname, responseBody);
      }),
    );
  }

  private async record(
    req: AdminRequest,
    pathname: string,
    responseBody: unknown,
  ) {
    if (isAdminAuditRecorded(req)) return;

    const isLogin = pathname.endsWith("/auth/login");
    const adminId =
      (req.user?.isSuperAdmin ? req.user.id : undefined) ??
      (isLogin ? adminIdFromLoginResponse(responseBody) : undefined);
    if (!adminId) return;

    const { targetType } = resolveAdminAuditTarget(pathname);
    const params = (req.params ?? {}) as Record<string, string | undefined>;
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? redactSecrets(req.body)
        : undefined;

    await this.audit.logSafe({
      adminId,
      action: resolveAdminAuditAction(req.method, pathname),
      targetType,
      targetId: extractAdminAuditTargetId(params),
      after: {
        method: req.method.toUpperCase(),
        path: pathname,
        ...(body ? { body } : {}),
      },
      ip: clientIp(req),
      userAgent:
        typeof req.headers["user-agent"] === "string"
          ? req.headers["user-agent"]
          : undefined,
    });
  }
}
