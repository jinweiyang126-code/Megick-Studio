import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import { randomId } from "@/common/random-id";
import { AdvancedAccessService } from "@/common/services/advanced-access.service";
import { OssService } from "../oss/oss.service";
import {
  FREE_IMAGE_WATERMARK_FALLBACK_PROCESS,
  FREE_IMAGE_WATERMARK_PROCESS,
  mediaOutputProxyUrl,
  parseGenerationOutputProxyUrl,
} from "../generation/generation-output-urls";
import type { GenerationJobTypeEnum, OssAsset, Prisma } from "@prisma/client";

export const GENERATED_IMAGE_THUMBNAIL_PROCESS =
  "image/resize,m_lfit,w_320,h_320/format,webp/quality,q_72";

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

function mediaKindForAsset(type: GenerationJobTypeEnum | string | null, contentType: string) {
  if (type === "IMAGE2VIDEO" || contentType.startsWith("video/")) return "VIDEO";
  if (contentType.startsWith("image/")) return "IMAGE";
  if (contentType.startsWith("audio/")) return "AUDIO";
  return "FILE";
}

function shouldWatermarkGeneratedOutput(type: GenerationJobTypeEnum | string | null, kind: string) {
  return kind === "IMAGE" && (type === "TEXT2IMAGE" || type === "IMAGE_EDIT");
}

function nullableJson(value: Prisma.JsonValue | null | undefined) {
  return value === null || typeof value === "undefined"
    ? undefined
    : (value as Prisma.InputJsonValue);
}

@Injectable()
export class GenerationOutputMediaService {
  private readonly logger = new Logger(GenerationOutputMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oss: OssService,
    private readonly advancedAccess: AdvancedAccessService,
  ) {}

  async ensureForAsset(input: {
    userId: string;
    jobId: string;
    outputIndex: number;
    assetId: string;
  }) {
    const record = await this.prisma.generationOutputMedia.upsert({
      where: {
        jobId_outputIndex: {
          jobId: input.jobId,
          outputIndex: input.outputIndex,
        },
      },
      update: { userId: input.userId, assetId: input.assetId },
      create: {
        id: `media_${randomId(24)}`,
        userId: input.userId,
        jobId: input.jobId,
        outputIndex: input.outputIndex,
        assetId: input.assetId,
      },
      select: { id: true },
    });
    await this.ensureMediaCenterItem({
      id: record.id,
      userId: input.userId,
      jobId: input.jobId,
      outputIndex: input.outputIndex,
      assetId: input.assetId,
    });
    return record.id;
  }

  /**
   * Persist Studio session media (merged video / canvas export) into the media center.
   * Does not create generation_output_media (no generation job).
   */
  async registerStudioMedia(input: {
    userId: string;
    assetId: string;
    chatSessionId?: string | null;
    messageId?: string | null;
    prompt?: string | null;
    source?: "STUDIO_EDIT" | "STUDIO_MEDIA";
    metadata?: Prisma.InputJsonValue | null;
  }) {
    const asset = await this.prisma.ossAsset.findUnique({
      where: { id: input.assetId },
    });
    if (!asset) return null;

    const kind = mediaKindForAsset(null, asset.contentType);
    const source = input.source ?? "STUDIO_MEDIA";
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    const [originalOssUrl, signedUrl] = await Promise.all([
      this.oss.publicObjectUrl(asset.key),
      this.oss.signGet(asset.key, 24 * 3600),
    ]);

    const existing = await this.prisma.mediaCenterItem.findUnique({
      where: { ossAssetId: asset.id },
      select: { id: true },
    });
    const id = existing?.id ?? `media_${randomId(24)}`;

    await this.prisma.mediaCenterItem.upsert({
      where: { ossAssetId: asset.id },
      update: {
        userId: input.userId,
        kind,
        source,
        status: "READY",
        bucket: asset.bucket,
        ossKey: asset.key,
        originalOssUrl,
        signedUrl,
        signedUrlExpiresAt: signedUrl ? expiresAt : null,
        watermarkedUrl: null,
        watermarkedUrlExpiresAt: null,
        watermarkProcess: null,
        requiresWatermark: false,
        providerSourceUrl: null,
        prompt: input.prompt ?? null,
        chatSessionId: input.chatSessionId ?? null,
        messageId: input.messageId ?? null,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
        sha256: asset.sha256,
        visibility: asset.visibility,
        metadata: nullableJson(input.metadata ?? asset.metadata),
      },
      create: {
        id,
        userId: input.userId,
        kind,
        source,
        status: "READY",
        ossAssetId: asset.id,
        bucket: asset.bucket,
        ossKey: asset.key,
        originalOssUrl,
        signedUrl,
        signedUrlExpiresAt: signedUrl ? expiresAt : null,
        requiresWatermark: false,
        prompt: input.prompt ?? null,
        chatSessionId: input.chatSessionId ?? null,
        messageId: input.messageId ?? null,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
        sha256: asset.sha256,
        visibility: asset.visibility,
        metadata: nullableJson(input.metadata ?? asset.metadata),
        createdAt: asset.createdAt,
      },
    });

    return id;
  }

  async publicRefForAsset(input: {
    userId: string;
    jobId: string;
    outputIndex: number;
    type: GenerationJobTypeEnum | string;
    asset: OssAsset;
    assetUrl: string | null;
    hasAdvancedAccess: boolean;
  }) {
    const mediaId = await this.ensureForAsset({
      userId: input.userId,
      jobId: input.jobId,
      outputIndex: input.outputIndex,
      assetId: input.asset.id,
    });
    if (input.type !== "TEXT2IMAGE" && input.type !== "IMAGE_EDIT") {
      return { url: input.assetUrl, mediaId };
    }
    if (input.hasAdvancedAccess) return { url: input.assetUrl, mediaId };
    const watermarkedUrl = await this.oss.signGet(input.asset.key, 24 * 3600, {
      process: FREE_IMAGE_WATERMARK_PROCESS,
    });
    return {
      url: watermarkedUrl ?? mediaOutputProxyUrl(mediaId),
      mediaId,
    };
  }

  async getOutputContent(
    mediaId: string,
    userId: string,
    input: { variant?: "thumbnail" } = {},
  ) {
    const item = await this.prisma.mediaCenterItem.findFirst({
      where: { id: mediaId, userId },
      include: { ossAsset: true },
    });
    if (item) {
      if (input.variant === "thumbnail" && item.kind === "IMAGE") {
        const content = await this.oss.getAuthorizedAssetContent(
          item.ossKey,
          { id: userId },
          { process: GENERATED_IMAGE_THUMBNAIL_PROCESS },
        );
        return {
          content: content.content,
          contentType: content.contentType,
          sizeBytes: content.sizeBytes,
        };
      }

      const hasAdvancedAccess = await this.advancedAccess.hasAdvancedAccess(userId);
      if (item.requiresWatermark && !hasAdvancedAccess) {
        const process = item.watermarkProcess ?? FREE_IMAGE_WATERMARK_PROCESS;
        const content = await this.getWatermarkedOutputContent(
          item.ossKey,
          userId,
          process,
        );
        const expiresAt = new Date(Date.now() + 3600 * 1000);
        const watermarkedUrl = await this.oss.signGet(item.ossKey, 3600, {
          process,
        });
        if (watermarkedUrl) {
          await this.prisma.mediaCenterItem.update({
            where: { id: item.id },
            data: {
              watermarkedUrl,
              watermarkedUrlExpiresAt: expiresAt,
            },
          });
        }
        return {
          content: content.content,
          contentType: content.contentType,
          sizeBytes: content.sizeBytes,
        };
      }

      const content = await this.oss.getAuthorizedAssetContent(item.ossKey, {
        id: userId,
      });
      return {
        content: content.content,
        contentType: content.contentType,
        sizeBytes: content.sizeBytes,
      };
    }

    throw new NotFoundException("REFERENCE_MEDIA_NOT_FOUND");
  }

  /** Resolve a browser-facing delivery URL (signed OSS / CDN). Used by API 302 redirects. */
  async getOutputRedirectUrl(
    mediaId: string,
    userId: string,
    input: { variant?: "thumbnail" } = {},
  ) {
    const item = await this.prisma.mediaCenterItem.findFirst({
      where: { id: mediaId, userId },
    });
    if (!item) throw new NotFoundException("REFERENCE_MEDIA_NOT_FOUND");

    const pickCached = (
      url: string | null | undefined,
      expiresAt: Date | null | undefined,
    ) => {
      if (!url || !expiresAt) return null;
      return expiresAt.getTime() > Date.now() + 60_000 ? url : null;
    };

    if (input.variant === "thumbnail" && item.kind === "IMAGE") {
      const url = await this.oss.signAuthorizedGet(
        item.ossKey,
        { id: userId },
        3600,
        { process: GENERATED_IMAGE_THUMBNAIL_PROCESS },
      );
      if (!url) {
        throw new BadGatewayException("REFERENCE_MEDIA_PUBLIC_URL_UNAVAILABLE");
      }
      return url;
    }

    const hasAdvancedAccess = await this.advancedAccess.hasAdvancedAccess(userId);
    if (item.requiresWatermark && !hasAdvancedAccess) {
      const cached = pickCached(item.watermarkedUrl, item.watermarkedUrlExpiresAt);
      if (cached) return cached;
      const process = item.watermarkProcess ?? FREE_IMAGE_WATERMARK_PROCESS;
      let url = await this.oss.signAuthorizedGet(item.ossKey, { id: userId }, 3600, {
        process,
      });
      if (!url) {
        throw new BadGatewayException("REFERENCE_MEDIA_PUBLIC_URL_UNAVAILABLE");
      }
      const expiresAt = new Date(Date.now() + 3600 * 1000);
      await this.prisma.mediaCenterItem.update({
        where: { id: item.id },
        data: { watermarkedUrl: url, watermarkedUrlExpiresAt: expiresAt },
      });
      return url;
    }

    const cached = pickCached(item.signedUrl, item.signedUrlExpiresAt);
    if (cached) return cached;
    const url = await this.oss.signAuthorizedGet(item.ossKey, { id: userId }, 3600);
    if (!url) {
      throw new BadGatewayException("REFERENCE_MEDIA_PUBLIC_URL_UNAVAILABLE");
    }
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    await this.prisma.mediaCenterItem.update({
      where: { id: item.id },
      data: { signedUrl: url, signedUrlExpiresAt: expiresAt },
    });
    return url;
  }

  private isOssImageStyleUnavailable(error: unknown) {
    if (!(error instanceof BadGatewayException)) return false;
    return error.message.includes("OSS_IMAGE_STYLE_UNAVAILABLE");
  }

  private async getWatermarkedOutputContent(
    ossKey: string,
    userId: string,
    process: string,
  ) {
    try {
      return await this.oss.getAuthorizedAssetContent(
        ossKey,
        { id: userId },
        { process },
      );
    } catch (error) {
      if (!this.isOssImageStyleUnavailable(error)) throw error;
      this.logger.warn(
        `OSS image style unavailable (${process}); trying inline watermark for ${ossKey}`,
      );
    }

    try {
      return await this.oss.getAuthorizedAssetContent(
        ossKey,
        { id: userId },
        { process: FREE_IMAGE_WATERMARK_FALLBACK_PROCESS },
      );
    } catch (error) {
      if (!this.isOssImageStyleUnavailable(error)) throw error;
      this.logger.warn(
        `Inline OSS watermark unavailable; serving original bytes for ${ossKey}`,
      );
    }

    return this.oss.getAuthorizedAssetContent(
      ossKey,
      { id: userId },
      { allowGeneratedImageDelivery: true },
    );
  }

  thumbnailUrl(mediaId: string | null | undefined) {
    return mediaId ? mediaOutputProxyUrl(mediaId, "thumbnail") : null;
  }

  async publicObjectUrlForMediaId(mediaId: string, userId: string) {
    const item = await this.prisma.mediaCenterItem.findFirst({
      where: {
        id: mediaId,
        userId,
        status: "READY",
        kind: { in: ["IMAGE", "VIDEO"] },
      },
      select: { id: true, ossKey: true, originalOssUrl: true },
    });
    if (item) {
      const original =
        item.originalOssUrl ?? (await this.exportableOssUrl(item.ossKey));
      if (!item.originalOssUrl) {
        await this.prisma.mediaCenterItem.update({
          where: { id: item.id },
          data: { originalOssUrl: original },
        });
      }
      return original;
    }
    throw new NotFoundException("REFERENCE_MEDIA_NOT_FOUND");
  }

  async publicObjectUrlForJobOutput(
    userId: string,
    jobId: string,
    outputIndex: number,
  ) {
    if (!Number.isInteger(outputIndex) || outputIndex < 0) {
      throw new BadRequestException("INVALID_OUTPUT_INDEX");
    }

    const job = await this.prisma.generationJob.findFirst({
      where: { id: jobId, userId },
      select: { outputAssetIds: true },
    });
    if (!job) throw new NotFoundException("REFERENCE_MEDIA_NOT_FOUND");

    const assetIds = (job.outputAssetIds as string[] | null) ?? [];
    const assetId = assetIds[outputIndex];
    if (!assetId) throw new NotFoundException("REFERENCE_MEDIA_NOT_FOUND");

    const mediaId = await this.ensureForAsset({
      userId,
      jobId,
      outputIndex,
      assetId,
    });
    return this.publicObjectUrlForMediaId(mediaId, userId);
  }

  /** Turn browser-only Megick proxy URLs into provider-fetchable HTTPS links. */
  async resolveProviderReferenceUrl(userId: string, reference: string) {
    const proxy = parseGenerationOutputProxyUrl(reference);
    if (proxy?.type === "provider-output") {
      return this.publicObjectUrlForMediaId(proxy.mediaId, userId);
    }
    if (proxy?.type === "job-output") {
      return this.publicObjectUrlForJobOutput(
        userId,
        proxy.jobId,
        proxy.outputIndex,
      );
    }
    return reference;
  }

  private async exportableOssUrl(ossKey: string) {
    const publicUrl = await this.oss.publicObjectUrl(ossKey);
    if (publicUrl) return publicUrl;
    const signed = await this.oss.signGet(ossKey, 24 * 3600);
    if (!signed) {
      throw new BadGatewayException("REFERENCE_MEDIA_PUBLIC_URL_UNAVAILABLE");
    }
    return signed;
  }

  private async ensureMediaCenterItem(input: {
    id: string;
    userId: string;
    jobId: string;
    outputIndex: number;
    assetId: string;
  }) {
    const [asset, job] = await Promise.all([
      this.prisma.ossAsset.findUnique({ where: { id: input.assetId } }),
      this.prisma.generationJob.findUnique({
        where: { id: input.jobId },
        select: {
          type: true,
          prompt: true,
          params: true,
          providerOutputUrls: true,
          chatSessionId: true,
          finishedAt: true,
          createdAt: true,
        },
      }),
    ]);
    if (!asset) return;

    const kind = mediaKindForAsset(job?.type ?? null, asset.contentType);
    const requiresWatermark = shouldWatermarkGeneratedOutput(job?.type ?? null, kind);
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    const [originalOssUrl, signedUrl, watermarkedUrl] = await Promise.all([
      this.oss.publicObjectUrl(asset.key),
      this.oss.signGet(asset.key, 24 * 3600),
      requiresWatermark
        ? this.oss.signGet(asset.key, 24 * 3600, {
            process: FREE_IMAGE_WATERMARK_PROCESS,
          })
        : Promise.resolve(null),
    ]);
    const providerSourceUrl =
      stringArray(job?.providerOutputUrls)[input.outputIndex] ?? null;

    await this.prisma.mediaCenterItem.upsert({
      where: {
        jobId_outputIndex: {
          jobId: input.jobId,
          outputIndex: input.outputIndex,
        },
      },
      update: {
        userId: input.userId,
        kind,
        source: "GENERATION",
        status: "READY",
        ossAssetId: asset.id,
        bucket: asset.bucket,
        ossKey: asset.key,
        originalOssUrl,
        signedUrl,
        signedUrlExpiresAt: signedUrl ? expiresAt : null,
        watermarkedUrl,
        watermarkedUrlExpiresAt: watermarkedUrl ? expiresAt : null,
        watermarkProcess: requiresWatermark ? FREE_IMAGE_WATERMARK_PROCESS : null,
        requiresWatermark,
        providerSourceUrl,
        prompt: job?.prompt ?? null,
        chatSessionId: job?.chatSessionId ?? null,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
        sha256: asset.sha256,
        visibility: asset.visibility,
        metadata: nullableJson(asset.metadata),
        sourceParams: nullableJson(job?.params),
      },
      create: {
        id: input.id,
        userId: input.userId,
        kind,
        source: "GENERATION",
        status: "READY",
        ossAssetId: asset.id,
        bucket: asset.bucket,
        ossKey: asset.key,
        originalOssUrl,
        signedUrl,
        signedUrlExpiresAt: signedUrl ? expiresAt : null,
        watermarkedUrl,
        watermarkedUrlExpiresAt: watermarkedUrl ? expiresAt : null,
        watermarkProcess: requiresWatermark ? FREE_IMAGE_WATERMARK_PROCESS : null,
        requiresWatermark,
        providerSourceUrl,
        prompt: job?.prompt ?? null,
        jobId: input.jobId,
        outputIndex: input.outputIndex,
        chatSessionId: job?.chatSessionId ?? null,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
        sha256: asset.sha256,
        visibility: asset.visibility,
        metadata: nullableJson(asset.metadata),
        sourceParams: nullableJson(job?.params),
        createdAt: job?.finishedAt ?? job?.createdAt ?? asset.createdAt,
      },
    });
  }
}
