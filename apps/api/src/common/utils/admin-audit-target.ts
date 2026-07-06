import type { AdminAction } from "@prisma/client";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const TARGET_TYPE_RULES: Array<{ prefix: string; targetType: string }> = [
  { prefix: "cloud-resources/oss-config", targetType: "oss_config" },
  { prefix: "cloud-resources/r2-config", targetType: "r2_config" },
  { prefix: "ai-image-edit-modes", targetType: "ai_image_edit_mode" },
  { prefix: "model-providers", targetType: "model_provider" },
  { prefix: "oauth-providers", targetType: "oauth_provider" },
  { prefix: "navigation-menus", targetType: "navigation_menu" },
  { prefix: "desktop-updates", targetType: "desktop_release" },
  { prefix: "site-settings", targetType: "site_setting" },
  { prefix: "ai-models", targetType: "ai_model" },
  { prefix: "rbac/roles", targetType: "role" },
  { prefix: "auth/login", targetType: "admin_login" },
  { prefix: "templates", targetType: "prompt_template" },
  { prefix: "showcase", targetType: "showcase" },
  { prefix: "users", targetType: "user" },
  { prefix: "smtp", targetType: "smtp_config" },
  { prefix: "chats", targetType: "chat_session" },
];

function normalizePathname(pathname: string) {
  const base = pathname.split("?")[0]?.trim() || "/";
  return base.replace(/\/+$/, "") || "/";
}

export function adminRequestPathname(url: string | undefined, path?: string) {
  if (path?.trim()) return normalizePathname(path);
  if (!url?.trim()) return "/";
  try {
    return normalizePathname(new URL(url, "http://localhost").pathname);
  } catch {
    return normalizePathname(url);
  }
}

export function shouldAuditAdminWriteRequest(method: string, pathname: string) {
  const normalizedMethod = method.toUpperCase();
  if (!WRITE_METHODS.has(normalizedMethod)) return false;
  if (!pathname.startsWith("/api/admin")) return false;
  if (/\/test$/i.test(pathname)) return false;
  return true;
}

export function resolveAdminAuditAction(
  method: string,
  pathname: string,
): AdminAction {
  const normalizedMethod = method.toUpperCase();
  if (pathname.includes("/auth/login")) return "EXEC";
  if (/\/credits\/adjust/i.test(pathname)) return "EXEC";
  if (/\/set-latest$/i.test(pathname)) return "EXEC";

  if (normalizedMethod === "POST") return "CREATE";
  if (normalizedMethod === "DELETE") return "DELETE";
  return "UPDATE";
}

export function resolveAdminAuditTarget(pathname: string) {
  const relative = pathname.replace(/^\/api\/admin\/?/, "");
  const rule = TARGET_TYPE_RULES.find((item) => relative.startsWith(item.prefix));
  const targetType = rule?.targetType ?? relative.split("/")[0] ?? "admin_route";
  return { targetType, relative };
}

export function extractAdminAuditTargetId(
  params: Record<string, string | undefined>,
) {
  for (const key of ["id", "code", "key"]) {
    const value = params[key]?.trim();
    if (value) return value;
  }
  return undefined;
}
