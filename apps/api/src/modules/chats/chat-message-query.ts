export const CHAT_MESSAGE_DEFAULT_LIMIT = 50;
export const CHAT_MESSAGE_MAX_LIMIT = 100;

export function normalizeMessageLimit(limit?: number) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return CHAT_MESSAGE_DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.floor(limit), 1), CHAT_MESSAGE_MAX_LIMIT);
}

export function parseMessageLimitQuery(raw?: string) {
  if (raw === undefined || raw === "") return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
