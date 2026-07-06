import type {
  GeneratedItem,
  VideoTaskResult,
} from "./generation-provider.types";

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

function normalizeBasicRouterAspectRatio(ratio: string | undefined) {
  if (!ratio) return "16:9";
  return ratio.replace(/\s+/g, "").replace(/：/g, ":");
}

function detectBasicRouterResolutionTier(resolution: string | undefined) {
  const normalized = resolution?.trim().toLowerCase().replace(/\s/g, "") ?? "";
  if (!normalized) return "720";
  if (normalized.includes("1080") || normalized === "2k" || normalized === "fhd") {
    return "1080";
  }
  if (normalized.includes("480") || normalized === "sd") return "480";
  if (normalized.includes("720") || normalized === "hd") return "720";
  return "720";
}

const BASIC_ROUTER_VIDEO_PIXELS: Record<string, Record<string, string>> = {
  "16:9": {
    "480": "854x480",
    "720": "1280x720",
    "1080": "1920x1080",
  },
  "9:16": {
    "480": "480x832",
    "720": "720x1280",
    "1080": "1080x1920",
  },
  "4:3": {
    "480": "640x480",
    "720": "960x720",
    "1080": "1440x1080",
  },
  "3:4": {
    "480": "480x640",
    "720": "720x960",
    "1080": "1080x1440",
  },
  "1:1": {
    "480": "480x480",
    "720": "720x720",
    "1080": "1080x1080",
  },
};

/** BasicRouter wan video models expect pixel sizes like `1280x720`, not labels like `720P`. */
export function normalizeBasicRouterVideoResolution(
  resolution: string | undefined,
  ratio: string | undefined,
) {
  const res = resolution?.trim();
  if (res && /^\d+\s*[x*×]\s*\d+$/i.test(res)) {
    return res.replace(/\s*[x*×]\s*/gi, "x");
  }

  const aspect = normalizeBasicRouterAspectRatio(ratio);
  const tier = detectBasicRouterResolutionTier(res);
  return (
    BASIC_ROUTER_VIDEO_PIXELS[aspect]?.[tier] ??
    BASIC_ROUTER_VIDEO_PIXELS["16:9"]?.[tier] ??
    "1280x720"
  );
}

export function isBasicRouterEnvelope(payload: unknown) {
  const record = asRecord(payload);
  return Number.isFinite(Number(record.code)) && record.data != null;
}

function isBasicRouterGenericMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === "success" ||
    normalized === "ok" ||
    normalized === "successful"
  );
}

export function basicRouterEnvelopeError(payload: unknown) {
  const record = asRecord(payload);
  const code = Number(record.code);
  if (!Number.isFinite(code) || code === 200) return undefined;
  const dataMessage = stringParam(asRecord(record.data).message);
  const envelopeMessage = stringParam(record.message);
  return (
    (dataMessage && !isBasicRouterGenericMessage(dataMessage)
      ? dataMessage
      : undefined) ??
    (envelopeMessage && !isBasicRouterGenericMessage(envelopeMessage)
      ? envelopeMessage
      : undefined) ??
    `BasicRouter request failed with code ${code}`
  );
}

/** Parse `/ai/getVideoByTaskId` poll payloads from BasicRouter's `{ code, message, data }` envelope. */
export function parseBasicRouterVideoPollResult(
  payload: unknown,
  fallbackTaskId?: string,
): VideoTaskResult {
  const envelope = asRecord(payload);
  const code = Number(envelope.code);
  if (Number.isFinite(code) && code !== 200) {
    return {
      providerJobId: fallbackTaskId?.trim() ?? "",
      status: "failed",
      items: [],
      error:
        basicRouterEnvelopeError(payload) ??
        `BasicRouter request failed with code ${code}`,
      raw: payload,
    };
  }

  const data = asRecord(envelope.data);
  const status = stringParam(data.status);
  const videoUrl = stringParam(data.videoUrl ?? data.video_url);
  const taskMessage = stringParam(data.message);
  const providerJobId =
    stringParam(data.taskId ?? data.task_id) ?? fallbackTaskId?.trim() ?? "";

  const items: GeneratedItem[] = videoUrl
    ? [
        {
          url: videoUrl,
          contentType: "video/mp4",
          providerJobId: providerJobId || undefined,
        },
      ]
    : [];

  const normalizedStatus = status?.trim().toLowerCase();
  const failed =
    normalizedStatus === "failed" ||
    normalizedStatus === "failure" ||
    normalizedStatus === "error";
  let error: string | undefined;
  if (failed) {
    error =
      taskMessage && !isBasicRouterGenericMessage(taskMessage)
        ? taskMessage
        : "BasicRouter video generation failed";
  }

  return {
    providerJobId,
    status: status ?? undefined,
    items,
    error,
    raw: payload,
  };
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
  const ratio = normalizeBasicRouterAspectRatio(
    stringParam(params.ratio ?? params.aspect_ratio ?? params.aspectRatio),
  );
  const resolution = normalizeBasicRouterVideoResolution(
    stringParam(params.resolution),
    ratio,
  );
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
