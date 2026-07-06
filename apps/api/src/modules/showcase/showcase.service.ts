import { Injectable } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import type { ShowcaseTypeEnum } from "@prisma/client";
import type { AdminAuditRequestContext } from "@/common/utils/admin-audit-context";
import { AdminAuditService } from "@/modules/admin/admin-audit.service";
import { OssService } from "../oss/oss.service";

@Injectable()
export class ShowcaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oss: OssService,
    private readonly audit: AdminAuditService,
  ) {}

  async listPublic(type?: ShowcaseTypeEnum) {
    const items = await this.prisma.showcaseItem.findMany({
      where: { isActive: true, ...(type ? { type } : {}) },
      orderBy: { sortOrder: "asc" },
    });
    return Promise.all(
      items.map(async (item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        prompt: item.prompt,
        templateId: this.templateIdFromSource(item.source),
        beforeUrl: await this.resolveShowcaseAsset(item.beforeAssetKey),
        afterUrl:
          (await this.resolveShowcaseAsset(item.afterAssetKey)) ??
          item.afterAssetKey,
        durationMs: item.durationMs,
        sortOrder: item.sortOrder,
      })),
    );
  }

  listAdmin() {
    return this.prisma.showcaseItem.findMany({ orderBy: { sortOrder: "asc" } });
  }

  findBySource(source: string) {
    return this.prisma.showcaseItem.findFirst({ where: { source } });
  }

  async upsert(
    input: {
      id?: string;
      type: ShowcaseTypeEnum;
      title: string;
      prompt: string;
      beforeAssetKey?: string | null;
      afterAssetKey: string;
      durationMs?: number | null;
      source?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
    auditCtx?: AdminAuditRequestContext,
  ) {
    const before = input.id
      ? await this.prisma.showcaseItem.findUnique({ where: { id: input.id } })
      : null;
    const data = {
      type: input.type,
      title: input.title.trim(),
      prompt: input.prompt.trim(),
      beforeAssetKey: this.optionalString(input.beforeAssetKey),
      afterAssetKey: input.afterAssetKey.trim(),
      durationMs: input.durationMs ?? null,
      source: this.optionalString(input.source),
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    };

    const row = input.id
      ? await this.prisma.showcaseItem.update({
          where: { id: input.id },
          data,
        })
      : await this.prisma.showcaseItem.create({ data });

    await this.audit.logExplicit(auditCtx, {
      action: before ? "UPDATE" : "CREATE",
      targetType: "showcase",
      targetId: row.id,
      before,
      after: row,
    });
    return row;
  }

  async delete(id: string, auditCtx?: AdminAuditRequestContext) {
    const before = await this.prisma.showcaseItem.findUnique({ where: { id } });
    const row = await this.prisma.showcaseItem.delete({ where: { id } });
    await this.audit.logExplicit(auditCtx, {
      action: "DELETE",
      targetType: "showcase",
      targetId: id,
      before,
      after: row,
    });
    return row;
  }

  private async resolveShowcaseAsset(value?: string | null) {
    const raw = value?.trim();
    if (!raw) return null;
    if (/^(https?:|data:)/i.test(raw)) return raw;

    const key =
      this.oss.assetKeyFromUrl(raw) ??
      this.assetKeyFromOssRoute(raw) ??
      raw.split("?")[0].replace(/^\/+/, "");
    return (await this.oss.signGet(key)) ?? raw;
  }

  private optionalString(value?: string | null) {
    return value?.trim() || null;
  }

  private templateIdFromSource(source?: string | null) {
    const match = source?.trim().match(/^template:([A-Za-z0-9_-]+)$/);
    return match?.[1] ?? null;
  }

  private assetKeyFromOssRoute(value: string) {
    try {
      const url = new URL(value, "http://local");
      if (
        url.pathname === "/api/oss/assets/content" ||
        url.pathname === "/api/oss/sign"
      ) {
        return url.searchParams.get("key")?.trim().replace(/^\/+/, "") || null;
      }
    } catch {
      return null;
    }
    return null;
  }
}
