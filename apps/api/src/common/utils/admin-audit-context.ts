import type { Request } from "express";
import type { AuthUserContext } from "@/common/decorators/current-user.decorator";

export type AdminAuditContext = {
  adminId: string;
  ip?: string;
  userAgent?: string;
};

export type AdminAuditRequestContext = {
  audit: AdminAuditContext;
  request: Request;
};

const RECORDED_KEY = "adminAuditRecorded";

type AdminRequest = Request & {
  user?: AuthUserContext;
  adminAuditRecorded?: boolean;
};

function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim();
  }
  return req.ip || undefined;
}

export function adminAuditContextFromRequest(
  req: AdminRequest,
): AdminAuditContext | undefined {
  if (!req.user?.isSuperAdmin) return undefined;
  return {
    adminId: req.user.id,
    ip: clientIp(req),
    userAgent:
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : undefined,
  };
}

export function adminAuditRequestContext(
  req: AdminRequest,
): AdminAuditRequestContext | undefined {
  const audit = adminAuditContextFromRequest(req);
  if (!audit) return undefined;
  return { audit, request: req };
}

export function markAdminAuditRecorded(req: Request) {
  (req as AdminRequest).adminAuditRecorded = true;
}

export function isAdminAuditRecorded(req: Request) {
  return Boolean((req as AdminRequest).adminAuditRecorded);
}
