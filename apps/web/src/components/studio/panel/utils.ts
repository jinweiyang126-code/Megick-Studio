import type {
  AIModelPublic,
  GenerationJobPublic,
  PromptTemplatePublic,
  VideoModelInputMode,
} from "@megick/api-types";
import { RATIO_PRESETS } from "@/components/studio/presets";
import type { TranslationKey } from "@/lib/i18n";
import {
  clampStudioVideoDuration,
  defaultStudioSettings,
  newStudioId,
  type StudioMode,
  type StudioResult,
  type StudioSettings,
} from "@/routes/-dashboard-types";
import type { StudioSearch } from "@/routes/-studio-search";
import {
  MAX_STUDIO_REFERENCE_IMAGES,
  STUDIO_HANDOFF_PREFIX,
  VIDEO_INPUT_MODES,
  VIDEO_REFERENCE_MAX_SECONDS,
  VIDEO_REFERENCE_MIN_SECONDS,
} from "./constants";
import type {
  ConcreteVideoInputMode,
  StudioHandoff,
  StudioHandoffReferenceSnapshot,
  StudioMediaReference,
  StudioReferenceKind,
  StudioVideoMediaType,
  VideoModeDraft,
  VideoModeDrafts,
} from "./types";

export function isNewSessionSearch(value: StudioSearch["newSession"]) {
  return value === true || value === "true" || value === "1";
}

export function isTruthySearchFlag(value: boolean | string | undefined) {
  return value === true || value === "true" || value === "1";
}

export function isInsufficientCreditsError(value: string | null | undefined) {
  const message = value?.trim().toUpperCase();
  return message === "INSUFFICIENT_CREDITS";
}

export function isAdvancedAccessRequiredError(value: string | null | undefined) {
  const message = value?.trim().toUpperCase();
  return message === "ADVANCED_ACCESS_REQUIRED" || message === "PAID_MODEL_REQUIRED";
}

export function referenceBoundsForModel(mode: StudioMode, model: AIModelPublic | null | undefined) {
  if (mode === "image") {
    const supportsReferenceImages = Boolean(model?.supportsReferenceImages);
    const requiresReferenceImages =
      supportsReferenceImages && Boolean(model?.requiresReferenceImages);
    return {
      supportsReferenceImages,
      requiresReferenceImages,
      minReferenceImages: requiresReferenceImages
        ? Math.max(model?.minReferenceImages ?? 1, 1)
        : 0,
      maxReferenceImages: supportsReferenceImages
        ? Math.max(model?.maxReferenceImages ?? MAX_STUDIO_REFERENCE_IMAGES, 1)
        : 0,
    };
  }

  return {
    supportsReferenceImages: Boolean(model?.supportsReferenceImages),
    requiresReferenceImages: Boolean(model?.requiresReferenceImages),
    minReferenceImages: Math.max(model?.minReferenceImages ?? 0, 0),
    maxReferenceImages: Math.max(model?.maxReferenceImages ?? 0, 0),
  };
}

export function normalizeVideoMode(value: unknown): VideoModelInputMode {
  return value === "T2V" || value === "I2V" || value === "R2V" || value === "EDIT" ? value : "T2V";
}

export function modelCreditLabel(
  model: Pick<AIModelPublic, "category" | "costCredits">,
  t: (key: TranslationKey, values?: Record<string, string | number | null | undefined>) => string,
  formatNumber: (value: number) => string,
) {
  if (model.category === "IMAGE2VIDEO") {
    return t("studio.creditsPerSecond", {
      credits: formatNumber(model.costCredits),
    });
  }
  return t("studio.creditsPerGeneration", {
    credits: formatNumber(model.costCredits),
  });
}

export function estimatedGenerationCredits(
  model: Pick<AIModelPublic, "category" | "costCredits"> | null | undefined,
  durationSeconds: number,
) {
  if (!model) return 0;
  return model.category === "IMAGE2VIDEO" ? model.costCredits * durationSeconds : model.costCredits;
}

export function defaultVideoModeForModels(models: AIModelPublic[]) {
  const explicitDefault = models.find(
    (model) => model.isDefault && model.videoInputMode,
  )?.videoInputMode;
  if (explicitDefault) return normalizeVideoMode(explicitDefault);
  const firstMode = models.find((model) => model.videoInputMode)?.videoInputMode;
  return firstMode ? normalizeVideoMode(firstMode) : "T2V";
}

export function mediaKindFromUrl(url: string): StudioReferenceKind {
  return /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(url) ? "video" : "image";
}

export function referenceKindFromFile(file: File): StudioReferenceKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name)) return "video";
  return null;
}

export function extensionFromName(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function referenceMediaTypeFor(
  mode: VideoModelInputMode | null | undefined,
  kind: StudioReferenceKind,
  index: number,
): StudioVideoMediaType {
  const normalizedMode = normalizeVideoMode(mode);
  if (normalizedMode === "I2V") return kind === "video" ? "first_clip" : "first_frame";
  if (normalizedMode === "EDIT") {
    return kind === "video" && index === 0
      ? "video"
      : kind === "video"
        ? "reference_video"
        : "reference_image";
  }
  if (normalizedMode === "R2V") return kind === "video" ? "reference_video" : "reference_image";
  return kind === "video" ? "reference_video" : "reference_image";
}

export function withVideoReferenceTypes(
  refs: StudioMediaReference[],
  mode: VideoModelInputMode | null | undefined,
) {
  const normalizedMode = normalizeVideoMode(mode);
  let editSourceVideoAssigned = false;
  return refs.map((ref, index) => {
    const kind = ref.kind ?? mediaKindFromUrl(ref.src);
    if (normalizedMode === "EDIT" && kind === "video") {
      const mediaType: StudioVideoMediaType = editSourceVideoAssigned ? "reference_video" : "video";
      editSourceVideoAssigned = true;
      return {
        ...ref,
        kind,
        mediaType,
      };
    }
    return {
      ...ref,
      kind,
      mediaType: ref.mediaType ?? referenceMediaTypeFor(normalizedMode, kind, index),
    };
  });
}

export function videoModeLabelKey(mode: VideoModelInputMode): TranslationKey {
  switch (mode) {
    case "I2V":
      return "studio.videoMode.i2v";
    case "R2V":
      return "studio.videoMode.r2v";
    case "EDIT":
      return "studio.videoMode.edit";
    case "T2V":
    default:
      return "studio.videoMode.t2v";
  }
}

export function videoModeDescriptionKey(mode: VideoModelInputMode): TranslationKey {
  switch (mode) {
    case "I2V":
      return "studio.videoModeDescription.i2v";
    case "R2V":
      return "studio.videoModeDescription.r2v";
    case "EDIT":
      return "studio.videoModeDescription.edit";
    case "T2V":
    default:
      return "studio.videoModeDescription.t2v";
  }
}

export function defaultVideoSettingsForMode(
  mode: ConcreteVideoInputMode,
  override?: Partial<StudioSettings>,
) {
  return defaultStudioSettings({
    ...override,
    mode: "video",
    style: "none",
    ratio: override?.ratio ?? "16:9",
    resolution: override?.resolution === "1080P" ? "1080P" : "720P",
    model: override?.model ?? "",
    videoInputMode: mode,
  });
}

export function createDefaultVideoDrafts(base?: Partial<StudioSettings>): VideoModeDrafts {
  return VIDEO_INPUT_MODES.reduce((drafts, mode) => {
    drafts[mode] = {
      prompt: "",
      refs: [],
      settings: defaultVideoSettingsForMode(mode, base),
      referenceUrlInput: "",
    };
    return drafts;
  }, {} as VideoModeDrafts);
}

export function normalizeVideoDraft(
  mode: ConcreteVideoInputMode,
  draft: VideoModeDraft,
): VideoModeDraft {
  return {
    prompt: draft.prompt,
    refs: withVideoReferenceTypes(draft.refs, mode),
    settings: defaultVideoSettingsForMode(mode, draft.settings),
    referenceUrlInput: draft.referenceUrlInput,
  };
}

export function handoffReferenceName(
  mode: StudioMode,
  t: (key: TranslationKey, values?: Record<string, string | number | null | undefined>) => string,
) {
  return mode === "video" ? t("studio.videoReference") : t("studio.reference");
}

export function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function numericParam(value: unknown) {
  const numeric =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function stringParam(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function stringArrayParam(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function stringArraySlotsParam(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : ""));
}

export function ratioFromJobParams(params: Record<string, unknown>, fallback: string) {
  const explicit = stringParam(params.ratio) ?? stringParam(params.aspect_ratio);
  if (explicit) return explicit;
  const size = stringParam(params.size);
  return RATIO_PRESETS.find((preset) => preset.size === size)?.id ?? fallback;
}

type JobReferenceParam = { src: string; mediaId?: string; mediaType?: StudioVideoMediaType };

export function refsFromGenerationJobParams(
  job: GenerationJobPublic,
  mode: StudioMode,
  referenceName: string,
): StudioMediaReference[] {
  const params = asPlainRecord(job.params);
  const media: JobReferenceParam[] = Array.isArray(params.media)
    ? params.media.flatMap((item): JobReferenceParam[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        const src = stringParam(record.url) ?? stringParam(record.src);
        if (!src) return [];
        const mediaType =
          typeof record.type === "string" ? (record.type as StudioVideoMediaType) : undefined;
        const mediaId = stringParam(record.mediaId);
        return [{ src, ...(mediaId ? { mediaId } : {}), ...(mediaType ? { mediaType } : {}) }];
      })
    : [];
  const referenceImageUrls = stringArrayParam(params.reference_images);
  const referenceMediaIds = stringArraySlotsParam(params.reference_media_ids);
  const referenceMediaIdsCamel = stringArraySlotsParam(params.referenceMediaIds);
  const urls: JobReferenceParam[] =
    mode === "video"
      ? [
          ...media,
          ...stringArrayParam(params.imageUrls).map((src): JobReferenceParam => ({ src })),
          ...stringArrayParam(params.videoUrls).map((src): JobReferenceParam => ({ src })),
          ...stringArrayParam(params.reference_images).map((src): JobReferenceParam => ({ src })),
          ...stringArrayParam(params.referenceImages).map((src): JobReferenceParam => ({ src })),
          ...stringArrayParam(params.reference_videos).map((src): JobReferenceParam => ({ src })),
          ...stringArrayParam(params.referenceVideos).map((src): JobReferenceParam => ({ src })),
        ]
      : [
          ...referenceImageUrls.map((src, index): JobReferenceParam => ({
            src,
            ...(referenceMediaIds[index] ? { mediaId: referenceMediaIds[index] } : {}),
          })),
          ...stringArrayParam(params.referenceImages).map((src, index): JobReferenceParam => ({
            src,
            ...(referenceMediaIdsCamel[index] ? { mediaId: referenceMediaIdsCamel[index] } : {}),
          })),
          ...(stringParam(params.reference_image)
            ? [{ src: stringParam(params.reference_image)! }]
            : []),
          ...(stringParam(params.referenceImage)
            ? [{ src: stringParam(params.referenceImage)! }]
            : []),
        ];
  const seen = new Set<string>();
  return urls
    .filter((item) => {
      const key = item.mediaId ?? item.src;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, index) => {
      const kind = mediaKindFromUrl(item.src);
      return {
        id: newStudioId(),
        src: item.src,
        name: referenceName,
        mediaId: item.mediaId,
        kind,
        mediaType:
          mode === "video"
            ? (item.mediaType ??
              referenceMediaTypeFor(normalizeVideoMode(params.videoInputMode), kind, index))
            : undefined,
      };
    });
}

export function settingsPatchFromGenerationJob(
  job: GenerationJobPublic,
  mode: StudioMode,
): Partial<StudioSettings> {
  const params = asPlainRecord(job.params);
  const videoInputMode = normalizeVideoMode(params.videoInputMode);
  return {
    mode,
    model: job.modelCode,
    style: "none",
    ratio: ratioFromJobParams(params, mode === "video" ? "16:9" : "1:1"),
    count: Math.min(
      Math.max(Math.round(numericParam(params.n) ?? numericParam(params.count) ?? 1), 1),
      4,
    ),
    seed: null,
    negative: "",
    duration: clampStudioVideoDuration(params.duration ?? params.seconds),
    resolution: params.resolution === "1080P" ? "1080P" : "720P",
    videoInputMode: mode === "video" ? videoInputMode : null,
  };
}

export function apiErrorStatus(value: unknown) {
  if (!value || typeof value !== "object" || !("status" in value)) return null;
  const status = (value as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function isImageReferenceUrl(url: string | null | undefined) {
  if (!url) return false;
  return /^data:image\//i.test(url) || !/\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(url);
}

export function normalizeReferenceInput(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^(https?:\/\/|data:image\/|\/api\/oss\/(?:sign|assets\/content))/i.test(raw)) return raw;
  return /^(generations|showcase|studio-edits|templates)\//.test(raw)
    ? `/api/oss/sign?key=${encodeURIComponent(raw)}`
    : "";
}

export function imageExtension(type: string | undefined) {
  const lower = type?.toLowerCase() ?? "";
  if (lower.includes("jpeg")) return "jpg";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("png")) return "png";
  if (lower.includes("mp4")) return "mp4";
  if (lower.includes("quicktime")) return "mov";
  if (lower.includes("webm")) return "webm";
  return "jpg";
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Invalid image data"));
    reader.onerror = () => reject(new Error("Image failed to load"));
    reader.readAsDataURL(blob);
  });
}

export function loadBrowserImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load"));
    image.src = src;
  });
}

function isInlineImageSrc(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

function isExternalHttpUrl(src: string) {
  if (isInlineImageSrc(src)) return false;
  if (typeof window === "undefined") return /^https?:\/\//i.test(src);
  try {
    const url = new URL(src, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function isStreamingAssetProxyUrl(src: string) {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(src, window.location.origin);
    return url.pathname === "/api/oss/assets/content";
  } catch {
    return false;
  }
}

function isRedirectContentProxyUrl(src: string) {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    return /\/api\/generation\/jobs\/[^/]+\/(?:output\/\d+|provider-output\/[^/]+)\/content$/i.test(
      url.pathname,
    );
  } catch {
    return false;
  }
}

/** Prefer API streaming proxies over 302 redirect endpoints for canvas pixel access. */
export function canvasImageCandidates(item: StudioResult) {
  const jobOutputs = jobOutputContentCandidates(item);
  const proxied = dedupeUrls([
    assetContentUrl(item.src),
    assetContentUrl(item.fallbackSrc),
    assetContentUrl(item.sourceSrc),
  ]);
  const refs = referenceCandidates(item);
  const redirectProxies = refs.filter(
    (url) => isRedirectContentProxyUrl(url) && !proxied.includes(url) && !jobOutputs.includes(url),
  );
  const external = refs.filter(
    (url) => isExternalHttpUrl(url) && !proxied.includes(url) && !jobOutputs.includes(url),
  );
  const sameOrigin = refs.filter(
    (url) =>
      !isExternalHttpUrl(url) &&
      !proxied.includes(url) &&
      !jobOutputs.includes(url) &&
      !isStreamingAssetProxyUrl(url) &&
      !isRedirectContentProxyUrl(url),
  );
  return dedupeUrls([...jobOutputs, ...proxied, ...sameOrigin, ...redirectProxies, ...external]);
}

export async function loadCanvasImageFromCandidates(candidates: string[]): Promise<HTMLImageElement> {
  const urls = dedupeUrls(candidates);
  let lastError: unknown;

  for (const candidate of urls) {
    if (isInlineImageSrc(candidate)) {
      try {
        return await loadBrowserImage(candidate);
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (!isExternalHttpUrl(candidate)) {
      try {
        const blob = await fetchBlobFromUrl(candidate);
        const objectUrl = URL.createObjectURL(blob);
        try {
          return await loadBrowserImage(objectUrl);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        lastError = err;
      }
      continue;
    }

    try {
      const blob = await fetchBlobFromUrl(candidate);
      const objectUrl = URL.createObjectURL(blob);
      try {
        return await loadBrowserImage(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Image failed to load");
}

/** Load an image for canvas drawing — fetches same-origin API URLs with cookies instead of crossOrigin. */
export async function loadCanvasImage(
  src: string,
  fallbackSrc?: string,
  extraCandidates?: string[],
): Promise<HTMLImageElement> {
  return loadCanvasImageFromCandidates(
    dedupeUrls([
      ...(extraCandidates ?? []),
      assetContentUrl(src),
      src,
      assetContentUrl(fallbackSrc),
      fallbackSrc,
    ]),
  );
}

export async function loadCanvasImageForResult(item: StudioResult) {
  return loadCanvasImageFromCandidates(canvasImageCandidates(item));
}

export function templateReferenceUrls(template: PromptTemplatePublic, limit: number) {
  const urls = [...template.referenceUrls];
  if (
    template.exampleUrl &&
    isImageReferenceUrl(template.exampleUrl) &&
    !urls.includes(template.exampleUrl)
  ) {
    urls.push(template.exampleUrl);
  }
  return urls.slice(0, limit);
}

export function writeStudioHandoff(payload: StudioHandoff) {
  if (typeof window === "undefined") return null;
  const id = newStudioId();
  try {
    window.sessionStorage.setItem(`${STUDIO_HANDOFF_PREFIX}${id}`, JSON.stringify(payload));
    return id;
  } catch {
    return null;
  }
}

export function readStudioHandoff(id: string | undefined): StudioHandoff | null {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${STUDIO_HANDOFF_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudioHandoff>;
    window.sessionStorage.removeItem(`${STUDIO_HANDOFF_PREFIX}${id}`);
    const refs = Array.isArray(parsed.refs)
      ? parsed.refs.filter((item): item is { src: string; name?: string } =>
          Boolean(item && typeof item === "object" && typeof item.src === "string" && item.src),
        )
      : [];
    if (refs.length > 0) {
      return {
        ...parsed,
        refs,
        videoInputMode: normalizeVideoMode(parsed.videoInputMode) as ConcreteVideoInputMode,
      };
    }
    return typeof parsed.src === "string" && parsed.src
      ? {
          ...(parsed as StudioHandoff),
          videoInputMode: normalizeVideoMode(parsed.videoInputMode) as ConcreteVideoInputMode,
        }
      : null;
  } catch {
    return null;
  }
}

export function assetContentUrl(src: string | undefined) {
  const raw = src?.trim();
  if (!raw || raw.startsWith("data:") || typeof window === "undefined") return null;

  const normalizeKey = (value: string | null | undefined) => {
    const key = value?.trim().replace(/^\/+/, "").split(/[!@?]/)[0];
    if (!key || key.includes("..")) return null;
    return /^(generations|showcase|studio-edits|templates)\//.test(key) ? key : null;
  };

  try {
    const url = new URL(raw, window.location.origin);
    if (url.pathname === "/api/oss/assets/content" || url.pathname === "/api/oss/sign") {
      const key = normalizeKey(url.searchParams.get("key"));
      return key ? `/api/oss/assets/content?key=${encodeURIComponent(key)}` : null;
    }
    const key = normalizeKey(decodeURIComponent(url.pathname.replace(/^\/+/, "")));
    return key ? `/api/oss/assets/content?key=${encodeURIComponent(key)}` : null;
  } catch {
    const key = normalizeKey(raw);
    return key ? `/api/oss/assets/content?key=${encodeURIComponent(key)}` : null;
  }
}

function mediaSrcIdentity(src: string | undefined | null) {
  if (!src?.trim()) return null;
  const key = ossAssetKeyFromMediaSrc(src);
  if (key) return `key:${key}`;
  return src.trim();
}

function mediaSrcsMatch(
  a: string | undefined | null,
  b: string | undefined | null,
) {
  if (!a?.trim() || !b?.trim()) return false;
  if (a === b) return true;
  const idA = mediaSrcIdentity(a);
  const idB = mediaSrcIdentity(b);
  return idA !== null && idA === idB;
}

export function studioResultCoversMediaUrl(item: StudioResult, url: string) {
  return (
    mediaSrcsMatch(item.src, url) ||
    mediaSrcsMatch(item.fallbackSrc, url) ||
    mediaSrcsMatch(item.sourceSrc, url)
  );
}

/** Recover job/output slot from primary results or `{jobId}-fallback-{n}` ids. */
export function inferStudioResultJobContext(item: StudioResult) {
  let jobId = item.jobId;
  let outputIndex = item.outputIndex;
  if (!jobId) {
    const fallback = item.id.match(/^(.+)-fallback-(\d+)$/);
    if (fallback) {
      jobId = fallback[1];
      if (outputIndex === undefined) outputIndex = Number(fallback[2]);
    }
  }
  return { jobId, outputIndex };
}

export function resolveJobOutputIndexForUrl(
  job: Pick<
    GenerationJobPublic,
    "outputItems" | "outputUrls" | "providerOutputUrls"
  >,
  url: string,
  fallbackArrayIndex?: number,
) {
  const items = job.outputItems ?? [];
  for (let i = 0; i < items.length; i++) {
    const output = items[i];
    if (
      mediaSrcsMatch(output.url, url) ||
      mediaSrcsMatch(output.fallbackUrl, url) ||
      mediaSrcsMatch(output.sourceUrl, url)
    ) {
      return i;
    }
  }
  const outputUrls = job.outputUrls ?? [];
  const outputIdx = outputUrls.findIndex((candidate) => mediaSrcsMatch(candidate, url));
  if (outputIdx >= 0) return outputIdx;
  const providerUrls = job.providerOutputUrls ?? [];
  const providerIdx = providerUrls.findIndex((candidate) => mediaSrcsMatch(candidate, url));
  if (providerIdx >= 0) return providerIdx;
  const slotCount = Math.max(items.length, outputUrls.length, providerUrls.length);
  if (
    typeof fallbackArrayIndex === "number" &&
    fallbackArrayIndex >= 0 &&
    fallbackArrayIndex < slotCount
  ) {
    return fallbackArrayIndex;
  }
  return undefined;
}

function isFallbackStudioResultId(id: string) {
  return /-fallback-\d+$/.test(id);
}

/** Prefer canonical job outputs over legacy `{jobId}-fallback-{n}` duplicates. */
export function dedupeSessionVideosForMerge(videos: StudioResult[]) {
  const bySlot = new Map<string, StudioResult>();
  const extras: StudioResult[] = [];
  for (const video of videos) {
    const { jobId, outputIndex } = inferStudioResultJobContext(video);
    if (jobId && typeof outputIndex === "number" && outputIndex >= 0) {
      const key = `${jobId}:${outputIndex}`;
      const existing = bySlot.get(key);
      if (
        !existing ||
        (isFallbackStudioResultId(existing.id) && !isFallbackStudioResultId(video.id))
      ) {
        bySlot.set(key, video);
      }
      continue;
    }
    extras.push(video);
  }
  return [...bySlot.values(), ...extras];
}

export function jobOutputContentUrl(item: StudioResult, variant?: "thumbnail") {
  const { jobId, outputIndex } = inferStudioResultJobContext(item);
  if (!jobId || !Number.isInteger(outputIndex) || (outputIndex ?? -1) < 0) {
    return null;
  }
  const base = `/api/generation/jobs/${encodeURIComponent(jobId)}/output/${outputIndex}/content`;
  return variant ? `${base}?variant=${variant}` : base;
}

function jobOutputContentCandidates(item: StudioResult, variant?: "thumbnail") {
  const urls: string[] = [];
  const primary = jobOutputContentUrl(item, variant);
  if (primary) urls.push(primary);
  const { jobId, outputIndex } = inferStudioResultJobContext(item);
  if (jobId && typeof outputIndex === "number" && outputIndex > 0) {
    const atZero = jobOutputContentUrl({ ...item, jobId, outputIndex: 0 }, variant);
    if (atZero && !urls.includes(atZero)) urls.push(atZero);
  }
  return urls;
}

function isLikelyUpstreamProviderUrl(src: string) {
  if (!src.trim()) return false;
  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://local";
    const url = new URL(src, origin);
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return false;
    }
    return /(?:volces|volcengine|dashscope|ark-acc|ark-cn|byteimg|ibyteimg|aliyuncs\.com)/i.test(
      url.hostname,
    );
  } catch {
    return false;
  }
}

function dedupeUrls(urls: Array<string | null | undefined>) {
  return urls.filter(
    (src, index, items): src is string => Boolean(src) && items.indexOf(src) === index,
  );
}

export function providerOutputContentUrl(item: StudioResult, variant?: "thumbnail") {
  if (!item.mediaId) return null;
  const base = `/api/generation/jobs/provider-output/${encodeURIComponent(item.mediaId)}/content`;
  return variant ? `${base}?variant=${variant}` : base;
}

/** Cross-origin OSS/provider URLs must not send cookies — CORS rejects `*` with credentials. */
export function fetchCredentialsForUrl(src: string): RequestCredentials {
  if (typeof window === "undefined") return "include";
  try {
    const url = new URL(src, window.location.origin);
    return url.origin === window.location.origin ? "include" : "omit";
  } catch {
    return src.startsWith("/") ? "include" : "omit";
  }
}

function isSameOriginUrl(src: string) {
  if (typeof window === "undefined") return src.startsWith("/");
  try {
    return new URL(src, window.location.origin).origin === window.location.origin;
  } catch {
    return src.startsWith("/");
  }
}

/**
 * Force same-origin streaming for generation content URLs.
 * Default /content responses 302 to signed OSS; browser fetch of that OSS URL fails CORS
 * (including Megick's own aliyuncs bucket). `delivery=proxy` streams bytes via the API.
 */
export function withContentProxyDelivery(src: string) {
  if (typeof window === "undefined") return src;
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin !== window.location.origin) return src;
    const path = url.pathname;
    const isJobOutput = /\/api\/generation\/jobs\/[^/]+\/output\/\d+\/content$/.test(path);
    const isProvider =
      /\/api\/generation\/jobs\/provider-output\/[^/]+\/content$/.test(path);
    if (!isJobOutput && !isProvider) return src;
    url.searchParams.set("delivery", "proxy");
    return `${url.pathname}${url.search}`;
  } catch {
    return src;
  }
}

/**
 * Download media as a Blob.
 * Prefer `delivery=proxy` on generation content URLs so the browser never follows a 302 to OSS.
 * Remaining same-origin redirects still use manual follow with credentials omitted.
 */
export async function fetchBlobFromUrl(src: string) {
  const requestUrl = withContentProxyDelivery(src);
  const credentials = fetchCredentialsForUrl(requestUrl);
  const sameOrigin = isSameOriginUrl(requestUrl);
  const alreadyProxied =
    sameOrigin &&
    typeof window !== "undefined" &&
    (() => {
      try {
        return new URL(requestUrl, window.location.origin).searchParams.get("delivery") === "proxy";
      } catch {
        return false;
      }
    })();

  const res = await fetch(requestUrl, {
    credentials,
    // Proxied content returns 200 with a body; other same-origin content may still 302.
    redirect: sameOrigin && !alreadyProxied ? "manual" : "follow",
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("Location");
    if (!location) throw new Error(`HTTP ${res.status}`);
    const absolute = new URL(
      location,
      typeof window !== "undefined" ? window.location.origin : "http://local",
    ).href;
    // Prefer same-origin asset stream when the redirect points at a Megick OSS object key.
    const streamed = assetContentUrl(absolute);
    if (streamed) {
      const viaApi = await fetch(streamed, {
        credentials: "include",
        redirect: "follow",
      });
      if (!viaApi.ok) throw new Error(`HTTP ${viaApi.status}`);
      return viaApi.blob();
    }
    // Never follow redirects onto upstream provider hosts — they block browser CORS.
    if (isLikelyUpstreamProviderUrl(absolute)) {
      throw new Error("Upstream provider media is not browser-fetchable");
    }
    const redirected = await fetch(absolute, {
      credentials: "omit",
      redirect: "follow",
    });
    if (!redirected.ok) throw new Error(`HTTP ${redirected.status}`);
    return redirected.blob();
  }

  if (res.type === "opaqueredirect") {
    throw new Error("HTTP redirect blocked");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export function referenceCandidates(item: StudioResult) {
  const direct = [
    assetContentUrl(item.src),
    item.src,
    assetContentUrl(item.fallbackSrc),
    item.fallbackSrc,
    assetContentUrl(item.sourceSrc),
    item.sourceSrc,
  ];
  const safeDirect = direct.filter((src) => src && !isLikelyUpstreamProviderUrl(src));
  const providerDirect = direct.filter((src) => src && isLikelyUpstreamProviderUrl(src));
  return dedupeUrls([
    ...jobOutputContentCandidates(item),
    providerOutputContentUrl(item),
    ...safeDirect,
    ...providerDirect,
  ]);
}

export function downloadCandidates(item: StudioResult) {
  const assetStreams = [
    assetContentUrl(item.src),
    assetContentUrl(item.fallbackSrc),
    assetContentUrl(item.sourceSrc),
  ];
  const direct = [item.src, item.fallbackSrc, item.sourceSrc];
  // Merge/download use fetch(); upstream provider hosts (volces/dashscope/...) block CORS.
  // Prefer /api/oss/assets/content and delivery=proxy job content — never raw OSS URLs.
  const safeDirect = direct.filter((src) => src && !isLikelyUpstreamProviderUrl(src));
  return dedupeUrls([
    ...assetStreams,
    ...jobOutputContentCandidates(item),
    providerOutputContentUrl(item),
    ...safeDirect,
  ]);
}

/**
 * URLs for `<video src>` during merge/export.
 * Must stay same-origin: 302→OSS plays in a preview tag, but without CORS it taints
 * canvas and MediaRecorder merge fails — then fetch fallback also dies on OSS CORS.
 */
export function playableVideoSrcCandidates(item: StudioResult) {
  return dedupeUrls([
    assetContentUrl(item.src),
    assetContentUrl(item.fallbackSrc),
    assetContentUrl(item.sourceSrc),
    ...jobOutputContentCandidates(item).map(withContentProxyDelivery),
    providerOutputContentUrl(item)
      ? withContentProxyDelivery(providerOutputContentUrl(item)!)
      : null,
  ]);
}

/**
 * URLs for studio preview `<video src>`.
 * Prefer signed/direct playback (302→OSS is fine for media elements), then proxy as last resort.
 */
export function previewVideoSrcCandidates(item: StudioResult) {
  const isApiPath = (src: string) => {
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "http://local";
      const url = new URL(src, origin);
      return url.pathname.startsWith("/api/");
    } catch {
      return src.startsWith("/api/");
    }
  };
  const direct = [item.src, item.fallbackSrc, item.sourceSrc].filter(
    (src): src is string => Boolean(src) && !isApiPath(src),
  );
  return dedupeUrls([
    ...direct,
    ...jobOutputContentCandidates(item),
    providerOutputContentUrl(item),
    item.src,
    item.fallbackSrc,
    item.sourceSrc,
    ...jobOutputContentCandidates(item).map(withContentProxyDelivery),
    providerOutputContentUrl(item)
      ? withContentProxyDelivery(providerOutputContentUrl(item)!)
      : null,
  ]);
}

export function signUrlForAssetKey(key: string) {
  return `/api/oss/sign?key=${encodeURIComponent(key)}`;
}

function ossAssetKeyFromMediaSrc(src: string | undefined) {
  if (!src?.trim()) return null;
  const content = assetContentUrl(src);
  if (content) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "http://local";
      return new URL(content, origin).searchParams.get("key");
    } catch {
      return null;
    }
  }
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://local";
    const url = new URL(src, origin);
    if (url.pathname === "/api/oss/sign" || url.pathname === "/api/oss/assets/content") {
      return url.searchParams.get("key");
    }
  } catch {
    return null;
  }
  return null;
}

/** Job output keys are blocked on GET /api/oss/sign for free-tier generated images. */
function isProtectedGenerationOutputKey(key: string) {
  if (!key.startsWith("generations/")) return false;
  if (key.startsWith("generations/references/")) return false;
  const parts = key.split("/").filter(Boolean);
  return parts.length >= 4 && parts[0] === "generations";
}

function signUrlFromMediaSrc(src: string | undefined) {
  const key = ossAssetKeyFromMediaSrc(src);
  if (!key || isProtectedGenerationOutputKey(key)) return null;
  return signUrlForAssetKey(key);
}

function isInstantVideoHandoffSrc(src: string) {
  if (!src?.trim() || src.startsWith("data:")) return false;
  if (isLikelyUpstreamProviderUrl(src)) return false;
  if (isExternalHttpUrl(src)) return true;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://local";
    const url = new URL(src, origin);
    if (url.pathname === "/api/oss/sign") {
      const key = url.searchParams.get("key");
      return Boolean(key && !isProtectedGenerationOutputKey(key));
    }
    if (url.origin === origin) {
      return /\/api\/generation\/jobs\/[^/]+\/(?:output\/\d+|provider-output\/[^/]+)\/content$/.test(
        url.pathname,
      );
    }
  } catch {
    return false;
  }
  return false;
}

/** Resolve a video handoff reference without blocking on download+re-upload when OSS/API URL exists. */
export function resolveVideoHandoffReference(item: StudioResult) {
  const jobOutputs = jobOutputContentCandidates(item);
  if (jobOutputs[0]) {
    return { src: jobOutputs[0], ready: true as const };
  }

  const provider = providerOutputContentUrl(item);
  if (provider) {
    return { src: provider, ready: true as const };
  }

  for (const candidate of dedupeUrls([item.src, item.sourceSrc, item.fallbackSrc])) {
    if (!candidate?.trim() || candidate.startsWith("data:")) continue;
    if (isLikelyUpstreamProviderUrl(candidate)) continue;

    if (isExternalHttpUrl(candidate)) {
      return { src: candidate, ready: true as const };
    }

    if (
      candidate.startsWith("/api/generation/jobs/") &&
      candidate.includes("/content")
    ) {
      return { src: candidate, ready: true as const };
    }

    const sign = signUrlFromMediaSrc(candidate);
    if (sign) return { src: sign, ready: true as const };

    if (isInstantVideoHandoffSrc(candidate)) {
      return { src: candidate, ready: true as const };
    }
  }

  const referenceResult: StudioHandoffReferenceSnapshot = {
    id: item.id,
    src: item.src,
    fallbackSrc: item.fallbackSrc,
    sourceSrc: item.sourceSrc,
    jobId: item.jobId,
    outputIndex: item.outputIndex,
    mediaId: item.mediaId,
    kind: item.kind,
  };
  return { src: item.src, ready: false as const, referenceResult };
}

export function mediaExtension(blob: Blob, item: StudioResult) {
  const type = blob.type.toLowerCase();
  if (item.kind === "video") {
    if (type.includes("webm")) return "webm";
    if (type.includes("quicktime")) return "mov";
    return "mp4";
  }
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function objectUrlFromBlob(blob: Blob) {
  return URL.createObjectURL(blob);
}

export async function readImageDimensions(blob: Blob) {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = await loadBrowserImage(url);
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function validateReferenceVideoDuration(file: File) {
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (
        Number.isFinite(duration) &&
        duration >= VIDEO_REFERENCE_MIN_SECONDS &&
        duration <= VIDEO_REFERENCE_MAX_SECONDS
      ) {
        resolve();
      } else {
        reject(new Error("VIDEO_REFERENCE_DURATION_INVALID"));
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Video metadata failed to load"));
    };
    video.src = url;
  });
}

export function ratioParts(ratio: string) {
  const [rawW, rawH] = ratio.split(":").map((part) => Number(part));
  const w = Number.isFinite(rawW) && rawW > 0 ? rawW : 1;
  const h = Number.isFinite(rawH) && rawH > 0 ? rawH : 1;
  return { w, h, css: `${w} / ${h}`, value: w / h };
}
