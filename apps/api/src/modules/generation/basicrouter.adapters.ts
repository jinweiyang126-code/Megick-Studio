import type { GeneratedItem } from "./generation-provider.types";

export interface BasicRouterImageInput {
  baseUrl: string;
  modelName: string;
  prompt: string;
  params: Record<string, unknown>;
}

export interface BasicRouterImageParseResult {
  items: GeneratedItem[];
  error?: string;
}

function stringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberParam(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function appendPath(baseUrl: string, path: string) {
  return `${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, "")}`;
}

function formatTaskUrl(template: string, taskId: string) {
  if (template.includes("{taskId}"))
    return template.replaceAll("{taskId}", encodeURIComponent(taskId));
  if (template.includes("{task_id}"))
    return template.replaceAll("{task_id}", encodeURIComponent(taskId));
  const separator = template.includes("?") ? "&" : "?";
  return `${template}${separator}taskId=${encodeURIComponent(taskId)}`;
}

export function isBasicRouterUrl(url: string) {
  return url.toLowerCase().includes("basicrouter.ai");
}

export function isBasicRouterApiStyle(value: unknown) {
  const configured = stringParam(value)?.toLowerCase();
  return (
    configured === "basicrouter" ||
    configured === "basicrouter-image" ||
    configured === "basicrouter-video"
  );
}

export function isBasicRouterImageCreatePath(path: string) {
  return /\/ai\/createImage\/?$/i.test(path.trim());
}

export function isBasicRouterVideoCreatePath(path: string) {
  return /\/ai\/createVideo\/?$/i.test(path.trim());
}

function configuredEndpoint(params: Record<string, unknown>) {
  return stringParam(params.createUrl ?? params.endpoint ?? params.endpointPath);
}

function resolveConfiguredEndpoint(baseUrl: string, configured: string) {
  return /^https?:\/\//i.test(configured)
    ? configured
    : appendPath(baseUrl, configured);
}

export function resolveBasicRouterEndpoint(
  baseUrl: string,
  params: Record<string, unknown>,
  fallbackPath: "/ai/createImage" | "/ai/createVideo",
) {
  const configured = configuredEndpoint(params);
  if (configured) return resolveConfiguredEndpoint(baseUrl, configured);
  if (isBasicRouterUrl(baseUrl)) {
    const normalized = normalizeBaseUrl(baseUrl);
    if (
      (fallbackPath === "/ai/createImage" &&
        isBasicRouterImageCreatePath(normalized)) ||
      (fallbackPath === "/ai/createVideo" &&
        isBasicRouterVideoCreatePath(normalized))
    ) {
      return normalized;
    }
    return appendPath(normalized, fallbackPath);
  }
  return appendPath(baseUrl, fallbackPath);
}

export function usesBasicRouterImageApi(input: BasicRouterImageInput) {
  if (isBasicRouterApiStyle(input.params.apiStyle ?? input.params.provider)) {
    return true;
  }
  const configured = configuredEndpoint(input.params);
  if (configured) {
    const endpoint = resolveConfiguredEndpoint(input.baseUrl, configured);
    return isBasicRouterImageCreatePath(endpoint);
  }
  return isBasicRouterUrl(input.baseUrl);
}

export function usesBasicRouterVideoApi(
  baseUrl: string,
  params: Record<string, unknown>,
) {
  if (isBasicRouterApiStyle(params.apiStyle ?? params.provider)) {
    return true;
  }
  const configured = configuredEndpoint(params);
  if (configured) {
    const endpoint = resolveConfiguredEndpoint(baseUrl, configured);
    return isBasicRouterVideoCreatePath(endpoint);
  }
  return isBasicRouterUrl(baseUrl);
}

export function resolveBasicRouterVideoStatusUrl(
  createUrl: string,
  params: Record<string, unknown>,
  taskId: string,
) {
  const configured = stringParam(params.statusUrl ?? params.pollUrl);
  if (configured) return formatTaskUrl(configured, taskId);

  try {
    const parsed = new URL(createUrl);
    parsed.pathname = parsed.pathname.replace(
      /\/ai\/createVideo\/?$/i,
      "/ai/getVideoByTaskId",
    );
    parsed.search = "";
    parsed.searchParams.set("taskId", taskId);
    return parsed.toString();
  } catch {
    return formatTaskUrl(
      `${createUrl.replace(/\/ai\/createVideo\/?$/i, "/ai/getVideoByTaskId")}?taskId={taskId}`,
      taskId,
    );
  }
}

function normalizeVideoInputMode(value: unknown, modelName: string) {
  if (value === "T2V" || value === "I2V" || value === "R2V" || value === "EDIT") {
    return value;
  }
  const marker = modelName.toLowerCase();
  if (marker.includes("videoedit") || marker.includes("video-edit")) return "EDIT";
  if (marker.includes("r2v")) return "R2V";
  if (marker.includes("t2v")) return "T2V";
  if (marker.includes("i2v")) return "I2V";
  return "I2V";
}

export function basicRouterVideoType(
  params: Record<string, unknown>,
  modelName: string,
  imageUrls: string[],
) {
  const explicit = params.videoType ?? params.video_type;
  if (typeof explicit === "number" && explicit >= 1 && explicit <= 4) {
    return explicit;
  }
  if (typeof explicit === "string" && explicit.trim()) {
    const numeric = Number(explicit.trim());
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 4) {
      return numeric;
    }
  }

  const mode = normalizeVideoInputMode(params.videoInputMode, modelName);
  if (mode === "T2V") return 1;
  if (mode === "R2V") return 4;
  if (mode === "I2V") {
    return imageUrls.length >= 2 ? 3 : 2;
  }
  return imageUrls.length > 0 ? 2 : 1;
}

export function basicRouterEnvelopeError(payload: unknown) {
  const record = asRecord(payload);
  const code = Number(record.code);
  if (!Number.isFinite(code) || code === 200) return undefined;
  return (
    stringParam(record.message) ??
    stringParam(asRecord(record.data).message) ??
    `BasicRouter request failed with code ${code}`
  );
}

export function buildBasicRouterImagePayload(
  input: BasicRouterImageInput,
  extra: Record<string, unknown>,
) {
  const references = [
    ...stringArray(input.params.reference_images),
    ...stringArray(input.params.referenceImages),
    ...stringArray(input.params.image_urls),
    ...stringArray(input.params.imageUrls),
    ...stringArray(input.params.images),
    ...(typeof input.params.image === "string" ? [input.params.image] : []),
    ...(typeof input.params.imageUrl === "string" ? [input.params.imageUrl] : []),
    ...(typeof input.params.input_reference === "string"
      ? [input.params.input_reference]
      : []),
  ].filter(
    (item, index, items) => item.trim() && items.indexOf(item) === index,
  );
  const ratio = stringParam(
    input.params.ratio ??
      input.params.aspect_ratio ??
      input.params.aspectRatio,
  );
  const resolution = stringParam(input.params.resolution);
  const count = Math.max(
    0,
    Math.round(numberParam(input.params.count ?? input.params.n, 1)),
  );

  return {
    ...extra,
    model: input.modelName,
    text: input.prompt,
    count,
    ...(resolution ? { resolution } : {}),
    ...(ratio ? { ratio } : {}),
    ...(references.length ? { imageUrls: references } : {}),
  };
}

export function buildBasicRouterVideoPayload(input: {
  modelName: string;
  prompt: string;
  params: Record<string, unknown>;
  imageUrls?: string[];
  extra?: Record<string, unknown>;
}) {
  const params = input.params;
  const imageUrls = (input.imageUrls ?? []).filter(Boolean);
  const duration = Math.max(1, Math.round(numberParam(params.duration, 5)));
  const ratio = stringParam(
    params.ratio ?? params.aspect_ratio ?? params.aspectRatio,
  );
  const resolution = stringParam(params.resolution);
  const videoType = basicRouterVideoType(params, input.modelName, imageUrls);

  return {
    ...(input.extra ?? {}),
    model: input.modelName,
    text: input.prompt,
    videoType,
    duration,
    urls: videoType === 1 ? [] : imageUrls,
    ...(resolution ? { resolution } : {}),
    ...(ratio ? { ratio } : {}),
  };
}

export function parseBasicRouterImageResponse(
  payload: unknown,
  resolveUrl: (url: string, baseUrl: string) => string | undefined,
  input: BasicRouterImageInput,
): BasicRouterImageParseResult {
  const envelopeError = basicRouterEnvelopeError(payload);
  if (envelopeError) {
    return { items: [], error: envelopeError };
  }

  const record = asRecord(payload);
  const data = asRecord(record.data);
  const urls = stringArray(data.imageUrls);
  const items = urls
    .map((url): GeneratedItem | null => {
      const resolved = resolveUrl(url, input.baseUrl) ?? url;
      if (!resolved) return null;
      return {
        url: resolved,
        contentType: "image/png",
        persistence: "project-oss",
      };
    })
    .filter((item): item is GeneratedItem => Boolean(item));

  const dataMessage = stringParam(data.message);
  return {
    items,
    error:
      items.length > 0
        ? undefined
        : dataMessage ??
          stringParam(record.message) ??
          (urls.length ? "BasicRouter returned image URLs that could not be resolved" : "BasicRouter returned no image URLs"),
  };
}
