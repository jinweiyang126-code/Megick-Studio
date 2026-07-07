import type { OssAsset } from "@prisma/client";

export const FREE_IMAGE_WATERMARK_PROCESS = "style/megick";
/** Inline text watermark when the named OSS image style is not configured. */
export const FREE_IMAGE_WATERMARK_FALLBACK_PROCESS =
  "image/watermark,text_TWVnaWNr,size_36,color_FFFFFF,t_60,g_se,x_16,y_16";

export interface RawGenerationOutput {
  asset?: OssAsset;
  assetUrl?: string | null;
  providerUrl?: string | null;
}

export interface PublicGenerationOutput {
  url: string;
  thumbnailUrl?: string | null;
  fallbackUrl: string | null;
  sourceUrl: string | null;
  mediaId: string | null;
  assetId: string | null;
  assetKey: string | null;
}

export function generationOutputProxyUrl(jobId: string, index: number) {
  return `/api/generation/jobs/${encodeURIComponent(jobId)}/output/${index}/content`;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

export function listGenerationOutputCount(
  outputAssetIds: unknown,
  providerOutputUrls: unknown,
) {
  const assetIds = Array.isArray(outputAssetIds)
    ? outputAssetIds.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const providerUrls = stringArray(providerOutputUrls);
  return Math.max(assetIds.length, providerUrls.length);
}

/** Lightweight list rows use API proxy URLs instead of signed OSS/provider links. */
export function buildListGenerationOutputItems(
  jobId: string,
  type: string,
  outputCount: number,
): PublicGenerationOutput[] {
  if (outputCount <= 0) return [];

  const isImageOutput = type === "TEXT2IMAGE" || type === "IMAGE_EDIT";
  return Array.from({ length: outputCount }, (_, index) => {
    const url = generationOutputProxyUrl(jobId, index);
    return {
      url,
      thumbnailUrl: isImageOutput ? `${url}?variant=thumbnail` : null,
      fallbackUrl: null,
      sourceUrl: null,
      mediaId: null,
      assetId: null,
      assetKey: null,
    };
  });
}

export function mediaOutputProxyUrl(mediaId: string, variant?: "thumbnail") {
  const base = `/api/generation/jobs/provider-output/${encodeURIComponent(mediaId)}/content`;
  return variant ? `${base}?variant=${variant}` : base;
}

export type GenerationOutputProxyRef =
  | { type: "job-output"; jobId: string; outputIndex: number }
  | { type: "provider-output"; mediaId: string };

/** Parse Megick API proxy URLs that are valid in the browser but not upstream providers. */
export function parseGenerationOutputProxyUrl(
  value: string,
): GenerationOutputProxyRef | null {
  const raw = value.trim();
  if (!raw || raw.startsWith("data:")) return null;

  try {
    const url = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : new URL(raw.startsWith("/") ? raw : `/${raw}`, "http://local");
    const jobMatch = url.pathname.match(
      /^\/api\/generation\/jobs\/([^/]+)\/output\/(\d+)\/content$/i,
    );
    if (jobMatch) {
      return {
        type: "job-output",
        jobId: decodeURIComponent(jobMatch[1]),
        outputIndex: Number(jobMatch[2]),
      };
    }

    const mediaMatch = url.pathname.match(
      /^\/api\/generation\/jobs\/provider-output\/([^/]+)\/content$/i,
    );
    if (mediaMatch) {
      return {
        type: "provider-output",
        mediaId: decodeURIComponent(mediaMatch[1]),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function buildPublicGenerationOutputItems(
  jobId: string,
  type: string,
  outputs: RawGenerationOutput[],
  hasAdvancedAccess: boolean,
): PublicGenerationOutput[] {
  return outputs
    .map((output, index): PublicGenerationOutput | null => {
      const isImageOutput = type === "TEXT2IMAGE" || type === "IMAGE_EDIT";
      if (isImageOutput) {
        if (!output.asset || !output.assetUrl) return null;
        return {
          url: output.assetUrl,
          fallbackUrl: null,
          sourceUrl: null,
          mediaId: null,
          assetId: hasAdvancedAccess ? output.asset.id : null,
          assetKey: hasAdvancedAccess ? output.asset.key : null,
        };
      }

      const sourceUrl = output.providerUrl ?? null;
      const url = output.assetUrl ?? sourceUrl;
      if (!url) return null;
      return {
        url,
        fallbackUrl: null,
        sourceUrl: hasAdvancedAccess ? sourceUrl : null,
        mediaId: null,
        assetId: output.asset?.id ?? null,
        assetKey: output.asset?.key ?? null,
      };
    })
    .filter((item): item is PublicGenerationOutput => Boolean(item));
}

export function publicProviderOutputUrls(
  type: string,
  providerUrls: string[],
  hasAdvancedAccess: boolean,
) {
  if (type === "TEXT2IMAGE" || type === "IMAGE_EDIT") return [];
  return providerUrls;
}
