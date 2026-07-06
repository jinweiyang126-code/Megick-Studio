const SENSITIVE_KEYS = new Set([
  "accessKeySecret",
  "secretAccessKey",
  "apiKey",
  "password",
  "clientSecret",
  "accessKeySecretEnc",
  "apiKeyEnc",
  "webhookSecretEnc",
  "configEnc",
]);

const REDACTED = "__REDACTED__";

export function redactSecrets<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    if (SENSITIVE_KEYS.has(key)) {
      next[key] = REDACTED;
      continue;
    }
    next[key] = redactValue(nested);
  }
  return next;
}
