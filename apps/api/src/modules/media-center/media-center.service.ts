import { BadGatewayException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import { AdvancedAccessService } from "@/common/services/advanced-access.service";
import { OssService } from "../oss/oss.service";
import { mediaOutputProxyUrl } from "../generation/generation-output-urls";
import type { Prisma } from "@prisma/client";
import type {
  MediaCenterKindEnum,
  MediaCenterSourceEnum,
  MediaCenterStatusEnum,
} from "@prisma/client";

const MEDIA_CENTER_LIST_SELECT = {
  id: true,
  kind: true,
  status: true,
  requiresWatermark: true,
  prompt: true,
  createdAt: true,
  source: true,
  jobId: true,
  chatSessionId: true,
  sizeBytes: true,
  width: true,
  height: true,
  durationMs: true,
} as const satisfies Prisma.MediaCenterItemSelect;

type MediaCenterListItem = Prisma.MediaCenterItemGetPayload<{
  select: typeof MEDIA_CENTER_LIST_SELECT;
}>;

export type MediaCenterKind = "all" | "image" | "video";

export interface ListMediaCenterInput {
  kind?: MediaCenterKind;
  limit?: number;
  offset?: number;
}

function apiKindToDbKind(kind: MediaCenterKind): MediaCenterKindEnum | null {
  if (kind === "image") return "IMAGE";
  if (kind === "video") return "VIDEO";
  return null;
}

function dbKindToApiKind(kind: MediaCenterKindEnum): "image" | "video" | null {
  if (kind === "IMAGE") return "image";
  if (kind === "VIDEO") return "video";
  return null;
}

function sourceToApiSource(source: MediaCenterSourceEnum) {
  if (source === "STUDIO_EDIT") return "studio_edit";
  if (source === "STUDIO_MEDIA") return "studio_media";
  if (source === "USER_UPLOAD") return "user_upload";
  if (source === "IMPORT") return "import";
  return "generation";
}

function statusToApiStatus(status: MediaCenterStatusEnum) {
  return status.toLowerCase();
}

@Injectable()
export class MediaCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oss: OssService,
    private readonly advancedAccess: AdvancedAccessService,
  ) {}

  async listForUser(userId: string, input: ListMediaCenterInput = {}) {
    const kind = input.kind ?? "all";
    const limit = Math.min(Math.max(input.limit ?? 48, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const dbKind = apiKindToDbKind(kind);
    const where = {
      userId,
      status: "READY" as const,
      ...(dbKind ? { kind: dbKind } : {}),
    };

    const [items, total, kindCountRows, hasAdvancedAccess] = await Promise.all([
      this.prisma.mediaCenterItem.findMany({
        where,
        select: MEDIA_CENTER_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.mediaCenterItem.count({ where }),
      this.prisma.mediaCenterItem.groupBy({
        by: ["kind"],
        where: { userId, status: "READY" },
        _count: { _all: true },
      }),
      this.advancedAccess.hasAdvancedAccess(userId),
    ]);

    const imageCount =
      kindCountRows.find((row) => row.kind === "IMAGE")?._count._all ?? 0;
    const videoCount =
      kindCountRows.find((row) => row.kind === "VIDEO")?._count._all ?? 0;
    const allCount = kindCountRows.reduce((sum, row) => sum + row._count._all, 0);

    return {
      items: await Promise.all(
        items.map((item) => this.toPublicItem(item, hasAdvancedAccess)),
      ).then((records) => records.filter((item): item is NonNullable<typeof item> => Boolean(item))),
      total,
      counts: {
        all: allCount,
        image: imageCount,
        video: videoCount,
      },
      limit,
      offset,
    };
  }

  async originalObjectUrlForMediaId(mediaId: string, userId: string) {
    const item = await this.prisma.mediaCenterItem.findFirst({
      where: {
        id: mediaId,
        userId,
        status: "READY",
        kind: { in: ["IMAGE", "VIDEO"] },
      },
      select: { id: true, ossKey: true, originalOssUrl: true },
    });
    if (!item) throw new NotFoundException("REFERENCE_MEDIA_NOT_FOUND");
    const original = item.originalOssUrl ?? await this.oss.publicObjectUrl(item.ossKey);
    if (!original) throw new BadGatewayException("REFERENCE_MEDIA_PUBLIC_URL_UNAVAILABLE");
    if (!item.originalOssUrl) {
      await this.prisma.mediaCenterItem.update({
        where: { id: item.id },
        data: { originalOssUrl: original },
      });
    }
    return original;
  }

  private async toPublicItem(
    item: MediaCenterListItem,
    hasAdvancedAccess: boolean,
  ) {
    const kind = dbKindToApiKind(item.kind);
    if (!kind) return null;
    const shouldHideOriginal = item.requiresWatermark && !hasAdvancedAccess;
    const src = mediaOutputProxyUrl(item.id);
    const thumbnailUrl = kind === "image" ? mediaOutputProxyUrl(item.id, "thumbnail") : null;

    return {
      id: item.id,
      kind,
      status: statusToApiStatus(item.status),
      src,
      downloadUrl: mediaOutputProxyUrl(item.id),
      thumbnailUrl,
      ossThumbnailUrl: thumbnailUrl,
      prompt: item.prompt ?? "",
      createdAt: item.createdAt.toISOString(),
      source: sourceToApiSource(item.source),
      jobId: item.jobId,
      chatSessionId: item.chatSessionId,
      originalAccess: hasAdvancedAccess
        ? "available"
        : shouldHideOriginal
          ? "locked"
          : "available",
      sizeBytes: item.sizeBytes,
      width: item.width,
      height: item.height,
      durationMs: item.durationMs,
    };
  }
}
