import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "nestjs-prisma";
import type {
  ChatMessage,
  GenerationJob,
  GenerationJobTypeEnum,
  Prisma,
  PromptTemplate,
  PromptTemplateCategory,
  PromptTemplateStatus,
} from "@prisma/client";
import { OssService } from "../oss/oss.service";
import { SiteSettingsService } from "../site-settings/site-settings.service";
import type { AdminAuditRequestContext } from "@/common/utils/admin-audit-context";
import { AdminAuditService } from "@/modules/admin/admin-audit.service";
import {
  DIRECT_TEXT2IMAGE_ORIGINS_ENV,
  isDirectText2ImageProviderBaseUrl,
  parseDirectText2ImageOrigins,
} from "../generation/text2image.adapters";

interface UpsertTemplateInput {
  id?: string;
  type: GenerationJobTypeEnum;
  status?: PromptTemplateStatus;
  title: string;
  description?: string | null;
  textPrompt: string;
  materialPrompt?: string | null;
  referenceAssetKeys?: string[];
  exampleAssetKey?: string | null;
  modelCode?: string | null;
  params?: Record<string, unknown>;
  tags?: string[];
  category?: string | null;
  categories?: string[] | null;
  sortOrder?: number;
  isFeatured?: boolean;
  sourceChatSessionId?: string | null;
  sourceGenerationJobId?: string | null;
  sourceMessageId?: string | null;
}

interface ExtractTemplateInput extends Partial<UpsertTemplateInput> {
  sessionId: string;
  messageId?: string;
  generationJobId?: string;
}

type MessageWithJob = ChatMessage & { generationJob: GenerationJob | null };

const templateStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const templateTypes = ["TEXT2IMAGE", "IMAGE2VIDEO"] as const;
const templateWithCategoriesInclude = {
  categoryAssignments: { include: { category: true } },
} satisfies Prisma.PromptTemplateInclude;

type TemplateWithCategories = PromptTemplate & {
  categoryAssignments?: Array<{ category: PromptTemplateCategory }>;
};

interface CategoryInput {
  id?: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
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

function titleFromPrompt(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 40
    ? `${compact.slice(0, 40)}...`
    : compact || "Untitled template";
}

function normalizeStatus(status?: PromptTemplateStatus) {
  return templateStatuses.includes(status as (typeof templateStatuses)[number])
    ? (status as PromptTemplateStatus)
    : "DRAFT";
}

function normalizeType(type?: GenerationJobTypeEnum) {
  return templateTypes.includes(type as (typeof templateTypes)[number])
    ? (type as GenerationJobTypeEnum)
    : "TEXT2IMAGE";
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oss: OssService,
    private readonly config: ConfigService,
    private readonly settings: SiteSettingsService,
    private readonly audit: AdminAuditService,
  ) {}

  async listPublic(query: {
    type?: GenerationJobTypeEnum;
    category?: string;
    q?: string;
    compact?: boolean;
  }) {
    const { items } = await this.listPublicPage({
      ...query,
      skip: 0,
      take: 80,
    });
    return items;
  }

  async listPublicPage(query: {
    type?: GenerationJobTypeEnum;
    category?: string;
    q?: string;
    compact?: boolean;
    skip?: number;
    take?: number;
  }) {
    const videoGenerationEnabled = await this.settings.isVideoGenerationEnabled();
    if (query.type === "IMAGE2VIDEO" && !videoGenerationEnabled) {
      return { items: [], total: 0 };
    }

    const where = this.templateWhere({
      type: query.type,
      category: query.category,
      q: query.q,
      status: "PUBLISHED",
      includeModelSearch: false,
    });
    if (!query.type && !videoGenerationEnabled) {
      where.type = { not: "IMAGE2VIDEO" };
    }

    const orderBy = [
      { isFeatured: "desc" as const },
      { sortOrder: "asc" as const },
      { createdAt: "desc" as const },
    ];
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 20, 80);
    const [items, total] = await Promise.all([
      this.findTemplatesPage({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.promptTemplate.count({ where }),
    ]);
    return {
      items: await Promise.all(
        items.map((item) =>
          this.toPublicTemplate(item, {
            includeReferenceUrls: !query.compact,
          }),
        ),
      ),
      total,
    };
  }

  async detailPublic(id: string) {
    const item = await this.prisma.promptTemplate.findFirst({
      where: { id, status: "PUBLISHED" },
      include: templateWithCategoriesInclude,
    });
    if (!item) throw new NotFoundException();
    if (item.type === "IMAGE2VIDEO" && !(await this.settings.isVideoGenerationEnabled())) {
      throw new NotFoundException();
    }
    return this.toPublicTemplate(item);
  }

  async incrementUsage(id: string) {
    const item = await this.prisma.promptTemplate.findFirst({
      where: { id, status: "PUBLISHED" },
      select: { type: true },
    });
    if (!item) throw new NotFoundException();
    if (item.type === "IMAGE2VIDEO" && !(await this.settings.isVideoGenerationEnabled())) {
      throw new NotFoundException();
    }
    const updated = await this.prisma.promptTemplate.updateMany({
      where: { id, status: "PUBLISHED" },
      data: { usageCount: { increment: 1 } },
    });
    if (!updated.count) throw new NotFoundException();
    return { ok: true };
  }

  listCategories(options: { activeOnly?: boolean } = {}) {
    return this.prisma.promptTemplateCategory.findMany({
      where: options.activeOnly ? { isActive: true } : {},
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async listAdmin(query: {
    type?: GenerationJobTypeEnum;
    status?: PromptTemplateStatus;
    category?: string;
    q?: string;
    skip?: number;
    take?: number;
  }) {
    const where = this.templateWhere({
      type: query.type,
      category: query.category,
      q: query.q,
      status: query.status,
      includeModelSearch: true,
    });

    const orderBy = [
      { type: "asc" as const },
      { status: "asc" as const },
      { sortOrder: "asc" as const },
      { createdAt: "desc" as const },
    ];
    const [items, total] = await Promise.all([
      this.findTemplatesPage({
        where,
        orderBy,
        skip: query.skip ?? 0,
        take: Math.min(query.take ?? 100, 200),
      }),
      this.prisma.promptTemplate.count({ where }),
    ]);
    return {
      items: await Promise.all(
        items.map((item) => this.toPublicTemplate(item)),
      ),
      total,
    };
  }

  async detailAdmin(id: string) {
    const item = await this.prisma.promptTemplate.findUnique({
      where: { id },
      include: {
        ...templateWithCategoriesInclude,
        createdByAdmin: { select: { id: true, email: true } },
        sourceChatSession: {
          select: {
            id: true,
            title: true,
            user: { select: { id: true, email: true } },
          },
        },
        sourceGenerationJob: true,
      },
    });
    if (!item) throw new NotFoundException();
    return this.toPublicTemplate(item);
  }

  async upsertAdmin(
    adminId: string,
    input: UpsertTemplateInput,
    auditCtx?: AdminAuditRequestContext,
  ) {
    const beforeRow = input.id
      ? await this.prisma.promptTemplate.findUnique({
          where: { id: input.id },
          include: templateWithCategoriesInclude,
        })
      : null;
    const before = beforeRow ? await this.toPublicTemplate(beforeRow) : undefined;
    const title = input.title?.trim();
    const textPrompt = input.textPrompt?.trim();
    if (!title || !textPrompt)
      throw new BadRequestException("TITLE_AND_PROMPT_REQUIRED");

    const status = normalizeStatus(input.status);
    const categories = await this.resolveCategories({
      category: input.category,
      categories: input.categories,
    });
    const categoryNames = categories.map((category) => category.name);
    const categoryName = categoryNames[0] ?? null;
    const publishedAt = status === "PUBLISHED" ? new Date() : null;
    const referenceAssetKeys = (input.referenceAssetKeys ?? [])
      .map((item) => this.normalizeTemplateAssetValue(item))
      .filter((item): item is string => Boolean(item));
    const exampleAssetKey = this.normalizeTemplateAssetValue(
      input.exampleAssetKey,
    );

    const data = {
      type: normalizeType(input.type),
      status,
      title,
      description: input.description?.trim() || null,
      textPrompt,
      materialPrompt: input.materialPrompt?.trim() || null,
      referenceAssetKeys: referenceAssetKeys as Prisma.InputJsonValue,
      exampleAssetKey,
      modelCode: input.modelCode?.trim() || null,
      params: (input.params ?? {}) as Prisma.InputJsonValue,
      tags: (input.tags ?? []) as Prisma.InputJsonValue,
      categoryName,
      sortOrder: input.sortOrder ?? 0,
      isFeatured: input.isFeatured ?? false,
      sourceChatSessionId: input.sourceChatSessionId ?? null,
      sourceGenerationJobId: input.sourceGenerationJobId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      createdByAdminId: adminId,
      publishedAt,
    } satisfies Prisma.PromptTemplateUncheckedCreateInput;

    if (input.id) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.promptTemplate.findUnique({
          where: { id: input.id },
        });
        if (!existing) throw new NotFoundException();
        const nextPublishedAt =
          status === "PUBLISHED" ? (existing.publishedAt ?? publishedAt) : null;
        await tx.promptTemplateCategoryAssignment.deleteMany({
          where: { templateId: input.id },
        });
        await tx.promptTemplate.update({
          where: { id: input.id },
          data: { ...data, publishedAt: nextPublishedAt },
        });
        if (categories.length) {
          await tx.promptTemplateCategoryAssignment.createMany({
            data: categories.map((category) => ({
              templateId: input.id as string,
              categoryId: category.id,
            })),
          });
        }
        return tx.promptTemplate.findUnique({
          where: { id: input.id },
          include: templateWithCategoriesInclude,
        });
      });
      if (!updated) throw new NotFoundException();
      const result = await this.toPublicTemplate(updated);
      await this.audit.logExplicit(auditCtx, {
        action: "UPDATE",
        targetType: "prompt_template",
        targetId: result.id,
        before,
        after: result,
      });
      return result;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.promptTemplate.create({ data });
      if (categories.length) {
        await tx.promptTemplateCategoryAssignment.createMany({
          data: categories.map((category) => ({
            templateId: item.id,
            categoryId: category.id,
          })),
        });
      }
      return tx.promptTemplate.findUnique({
        where: { id: item.id },
        include: templateWithCategoriesInclude,
      });
    });
    if (!created) throw new NotFoundException();
    const result = await this.toPublicTemplate(created);
    await this.audit.logExplicit(auditCtx, {
      action: "CREATE",
      targetType: "prompt_template",
      targetId: result.id,
      before,
      after: result,
    });
    return result;
  }

  async deleteAdmin(id: string, auditCtx?: AdminAuditRequestContext) {
    const existing = await this.prisma.promptTemplate.findUnique({
      where: { id },
      include: templateWithCategoriesInclude,
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.promptTemplate.delete({ where: { id } });
    const result = await this.toPublicTemplate(existing);
    await this.audit.logExplicit(auditCtx, {
      action: "DELETE",
      targetType: "prompt_template",
      targetId: id,
      before: result,
      after: result,
    });
    return result;
  }

  async extractFromChat(
    adminId: string,
    input: ExtractTemplateInput,
    auditCtx?: AdminAuditRequestContext,
  ) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: input.sessionId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException("CHAT_SESSION_NOT_FOUND");

    const messageInclude = { include: { generationJob: true } } as const;
    let sourceMessage: MessageWithJob | null = null;

    if (input.messageId) {
      sourceMessage = await this.prisma.chatMessage.findFirst({
        where: { id: input.messageId, sessionId: input.sessionId },
        ...messageInclude,
      });
    }
    if (!sourceMessage && input.generationJobId) {
      sourceMessage = await this.prisma.chatMessage.findFirst({
        where: {
          generationJobId: input.generationJobId,
          sessionId: input.sessionId,
        },
        ...messageInclude,
      });
    }
    if (!sourceMessage) {
      sourceMessage = await this.prisma.chatMessage.findFirst({
        where: {
          sessionId: input.sessionId,
          role: "assistant",
          generationJobId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        ...messageInclude,
      });
    }
    if (!sourceMessage) throw new NotFoundException("MESSAGE_NOT_FOUND");

    const nearbyJobMessage = await this.findNearbyJobMessageQuery(
      input.sessionId,
      sourceMessage.createdAt,
      input.type,
    );
    const sourceJob =
      sourceMessage.generationJob ??
      (input.generationJobId
        ? await this.prisma.generationJob.findUnique({
            where: { id: input.generationJobId },
          })
        : null) ??
      nearbyJobMessage?.generationJob ??
      null;
    const promptMessage =
      sourceMessage.role === "user"
        ? sourceMessage
        : ((await this.prisma.chatMessage.findFirst({
            where: {
              sessionId: input.sessionId,
              role: "user",
              createdAt: { lt: sourceMessage.createdAt },
            },
            orderBy: { createdAt: "desc" },
          })) ?? sourceMessage);
    const promptMetadata = asRecord(promptMessage.metadata);
    const outputMessage = sourceJob
      ? ((await this.prisma.chatMessage.findFirst({
          where: {
            sessionId: input.sessionId,
            generationJobId: sourceJob.id,
          },
          orderBy: { createdAt: "asc" },
        })) ?? sourceMessage)
      : sourceMessage;
    const sourceMetadata = asRecord(outputMessage.metadata);
    const settings = asRecord(
      promptMetadata.settings ?? sourceMetadata.settings,
    );
    const refs = Array.isArray(promptMetadata.refs)
      ? promptMetadata.refs
          .map((ref) =>
            ref && typeof ref === "object"
              ? (ref as { src?: unknown }).src
              : null,
          )
          .map((src) =>
            typeof src === "string"
              ? this.normalizeTemplateAssetValue(src)
              : null,
          )
          .filter(
            (src): src is string => typeof src === "string" && src.length > 0,
          )
      : [];
    const jobParams = sourceJob ? asRecord(sourceJob.params) : {};
    const outputAssetIds = sourceJob
      ? stringArray(sourceJob.outputAssetIds)
      : [];
    const firstOutputAsset = outputAssetIds.length
      ? await this.prisma.ossAsset.findFirst({
          where: { id: { in: outputAssetIds } },
        })
      : null;
    const textPrompt = (
      input.textPrompt ??
      promptMessage.content ??
      sourceJob?.prompt ??
      ""
    ).trim();
    if (!textPrompt) throw new BadRequestException("PROMPT_REQUIRED");

    const type =
      input.type ??
      sourceJob?.type ??
      (settings.mode === "video" ? "IMAGE2VIDEO" : "TEXT2IMAGE");
    const normalizedType = normalizeType(type);
    const modelCode =
      input.modelCode ??
      sourceJob?.modelCode ??
      (typeof settings.model === "string" ? settings.model : null);
    const exampleAssetKey = await this.resolveExampleAssetKey({
      explicitValue: input.exampleAssetKey,
      firstOutputAssetKey: firstOutputAsset?.key,
      sourceMetadata,
      sourceJob,
      type: normalizedType,
      adminId,
      sessionId: session.id,
    });
    if (!exampleAssetKey && sourceJob) {
      throw new BadRequestException("TEMPLATE_EXAMPLE_OSS_ASSET_REQUIRED");
    }

    return this.upsertAdmin(adminId, {
      id: input.id,
      type: normalizedType,
      status: input.status ?? "DRAFT",
      title: input.title?.trim() || titleFromPrompt(textPrompt),
      description: input.description ?? null,
      textPrompt,
      materialPrompt: input.materialPrompt ?? null,
      referenceAssetKeys: input.referenceAssetKeys ?? refs,
      exampleAssetKey,
      modelCode,
      params: input.params ?? { ...jobParams, settings },
      tags: input.tags ?? [],
      category: input.category ?? null,
      categories: input.categories ?? null,
      sortOrder: input.sortOrder ?? 0,
      isFeatured: input.isFeatured ?? false,
      sourceChatSessionId: session.id,
      sourceGenerationJobId: sourceJob?.id ?? null,
      sourceMessageId: sourceMessage.id,
    }, auditCtx);
  }

  async upsertCategoryAdmin(input: CategoryInput, auditCtx?: AdminAuditRequestContext) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("TEMPLATE_CATEGORY_NAME_REQUIRED");

    const duplicate = await this.prisma.promptTemplateCategory.findUnique({
      where: { name },
    });
    if (duplicate && duplicate.id !== input.id) {
      throw new BadRequestException("TEMPLATE_CATEGORY_NAME_EXISTS");
    }

    const data = {
      name,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    };

    if (input.id) {
      const existing = await this.prisma.promptTemplateCategory.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new NotFoundException();
      const row = await this.prisma.promptTemplateCategory.update({
        where: { id: input.id },
        data,
      });
      await this.audit.logExplicit(auditCtx, {
        action: "UPDATE",
        targetType: "template_category",
        targetId: row.id,
        before: existing,
        after: row,
      });
      return row;
    }

    const row = await this.prisma.promptTemplateCategory.create({ data });
    await this.audit.logExplicit(auditCtx, {
      action: "CREATE",
      targetType: "template_category",
      targetId: row.id,
      before: undefined,
      after: row,
    });
    return row;
  }

  async deleteCategoryAdmin(id: string, auditCtx?: AdminAuditRequestContext) {
    const existing = await this.prisma.promptTemplateCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException();
    const row = await this.prisma.promptTemplateCategory.delete({ where: { id } });
    await this.audit.logExplicit(auditCtx, {
      action: "DELETE",
      targetType: "template_category",
      targetId: id,
      before: existing,
      after: row,
    });
    return row;
  }

  private templateWhere(query: {
    type?: GenerationJobTypeEnum;
    status?: PromptTemplateStatus;
    category?: string;
    q?: string;
    includeModelSearch?: boolean;
  }) {
    const where: Prisma.PromptTemplateWhereInput = {
      ...(query.type ? { type: normalizeType(query.type) } : {}),
      ...(query.status ? { status: normalizeStatus(query.status) } : {}),
    };
    const and: Prisma.PromptTemplateWhereInput[] = [];
    const category = query.category?.trim();
    if (category) {
      and.push({
        OR: [
          { categoryName: category },
          { categoryAssignments: { some: { category: { name: category } } } },
        ],
      });
    }

    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { textPrompt: { contains: q } },
          { materialPrompt: { contains: q } },
          { categoryName: { contains: q } },
          {
            categoryAssignments: {
              some: { category: { name: { contains: q } } },
            },
          },
          ...(query.includeModelSearch ? [{ modelCode: { contains: q } }] : []),
        ],
      });
    }

    if (and.length) where.AND = and;
    return where;
  }

  private async toPublicTemplate(
    item: TemplateWithCategories,
    options: { includeReferenceUrls?: boolean } = {},
  ) {
    const includeReferenceUrls = options.includeReferenceUrls ?? true;
    const referenceAssetKeys = stringArray(item.referenceAssetKeys);
    const assignedCategoryNames = (item.categoryAssignments ?? [])
      .map((assignment) => assignment.category)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((category) => category.name);
    const categories = Array.from(
      new Set([item.categoryName, ...assignedCategoryNames].filter(Boolean)),
    ) as string[];
    const previewAssetKey = item.exampleAssetKey ?? referenceAssetKeys[0] ?? null;
    const [exampleUrl, referenceUrls] = await Promise.all([
      this.resolveAsset(previewAssetKey),
      includeReferenceUrls
        ? Promise.all(referenceAssetKeys.map((key) => this.resolveAsset(key)))
        : Promise.resolve([]),
    ]);

    return {
      id: item.id,
      type: item.type,
      status: item.status,
      title: item.title,
      description: item.description,
      textPrompt: item.textPrompt,
      materialPrompt: item.materialPrompt,
      referenceAssetKeys,
      referenceUrls: referenceUrls.filter((url): url is string => Boolean(url)),
      exampleAssetKey: item.exampleAssetKey,
      exampleUrl,
      modelCode: item.modelCode,
      params: item.params,
      tags: stringArray(item.tags),
      category: item.categoryName ?? categories[0] ?? null,
      categories,
      sortOrder: item.sortOrder,
      isFeatured: item.isFeatured,
      usageCount: item.usageCount,
      sourceChatSessionId: item.sourceChatSessionId,
      sourceGenerationJobId: item.sourceGenerationJobId,
      sourceMessageId: item.sourceMessageId,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  /**
   * Sort/paginate by id first so MySQL does not filesort huge TEXT/JSON columns
   * (error 1038: Out of sort memory) after bulk template imports.
   */
  private async findTemplatesPage(input: {
    where: Prisma.PromptTemplateWhereInput;
    orderBy: Prisma.PromptTemplateOrderByWithRelationInput[];
    skip: number;
    take: number;
  }) {
    const page = await this.prisma.promptTemplate.findMany({
      where: input.where,
      select: { id: true },
      orderBy: input.orderBy,
      skip: input.skip,
      take: input.take,
    });
    if (!page.length) return [] as TemplateWithCategories[];

    const ids = page.map((row) => row.id);
    const rows = await this.prisma.promptTemplate.findMany({
      where: { id: { in: ids } },
      include: templateWithCategoriesInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is TemplateWithCategories => Boolean(row));
  }

  private async resolveCategories(input: {
    category?: string | null;
    categories?: string[] | null;
  }) {
    const names = Array.from(
      new Set(
        [
          ...(input.categories ?? []),
          ...(input.category ? [input.category] : []),
        ]
          .map((item) => item?.trim())
          .filter((item): item is string => Boolean(item)),
      ),
    );
    if (!names.length) return [];

    const existing = await this.prisma.promptTemplateCategory.findMany({
      where: { name: { in: names } },
    });
    const byName = new Map(existing.map((item) => [item.name, item]));
    const missing = names.filter((name) => !byName.has(name));
    if (missing.length) {
      throw new BadRequestException("TEMPLATE_CATEGORY_NOT_FOUND");
    }
    return names.map((name) => byName.get(name) as PromptTemplateCategory);
  }

  private async resolveAsset(key: string | null) {
    const value = this.normalizeTemplateAssetValue(key);
    if (!value) return null;
    const assetKey = this.oss.assetKeyFromUrl(value);
    if (assetKey) return (await this.oss.signGet(assetKey, 24 * 3600)) ?? null;
    if (/^(https?:|data:)/i.test(value)) return value;
    return null;
  }

  private normalizeTemplateAssetValue(value: string | null | undefined) {
    const raw = value?.trim();
    if (!raw) return null;
    const assetKey = this.oss.assetKeyFromUrl(raw);
    if (assetKey) return assetKey;
    if (/^(https?:|data:)/i.test(raw)) return raw;
    return raw.replace(/^\/+/, "");
  }

  private async findNearbyJobMessageQuery(
    sessionId: string,
    anchorCreatedAt: Date,
    type?: GenerationJobTypeEnum,
  ) {
    const normalizedType = type ? normalizeType(type) : null;
    const baseWhere: Prisma.ChatMessageWhereInput = {
      sessionId,
      generationJobId: { not: null },
      ...(normalizedType ? { generationJob: { type: normalizedType } } : {}),
    };

    const forward = await this.prisma.chatMessage.findFirst({
      where: {
        ...baseWhere,
        createdAt: { gte: anchorCreatedAt },
      },
      orderBy: { createdAt: "asc" },
      include: { generationJob: true },
    });
    if (forward) return forward;

    const backward = await this.prisma.chatMessage.findFirst({
      where: {
        ...baseWhere,
        createdAt: { lt: anchorCreatedAt },
      },
      orderBy: { createdAt: "desc" },
      include: { generationJob: true },
    });
    if (backward) return backward;

    return this.prisma.chatMessage.findFirst({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      include: { generationJob: true },
    });
  }

  private firstResultOssAssetFromMetadata(
    metadata: Record<string, unknown>,
    type: GenerationJobTypeEnum,
  ) {
    const results = metadata.results;
    if (!Array.isArray(results)) return null;

    for (const item of results) {
      if (typeof item === "string") {
        const key = this.oss.assetKeyFromUrl(item);
        if (key) return key;
        continue;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const result = item as Record<string, unknown>;
      const kind = typeof result.kind === "string" ? result.kind : "";
      const contentType =
        typeof result.contentType === "string" ? result.contentType : "";
      if (
        type === "TEXT2IMAGE" &&
        (kind === "video" || contentType.startsWith("video/"))
      ) {
        continue;
      }
      if (
        type === "IMAGE2VIDEO" &&
        (kind === "image" || contentType.startsWith("image/"))
      ) {
        continue;
      }

      const value =
        this.stringField(result, "key") ??
        this.stringField(result, "assetKey") ??
        this.stringField(result, "url") ??
        this.stringField(result, "src");
      const key = this.oss.assetKeyFromUrl(value);
      if (key) return key;
    }

    return null;
  }

  private stringField(record: Record<string, unknown>, key: string) {
    const value = record[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private async resolveExampleAssetKey(input: {
    explicitValue?: string | null;
    firstOutputAssetKey?: string | null;
    sourceMetadata: Record<string, unknown>;
    sourceJob: GenerationJob | null;
    type: GenerationJobTypeEnum;
    adminId: string;
    sessionId: string;
  }) {
    const explicit = input.explicitValue?.trim();
    const explicitKey = this.oss.assetKeyFromUrl(explicit);
    if (explicitKey) return explicitKey;
    if (explicit && /^(https?:|data:)/i.test(explicit)) return explicit;
    if (input.firstOutputAssetKey) return input.firstOutputAssetKey;

    const metadataKey = this.firstResultOssAssetFromMetadata(
      input.sourceMetadata,
      input.type,
    );
    if (metadataKey) return metadataKey;

    return this.copyProviderOutputToOss(input.sourceJob, input);
  }

  private async copyProviderOutputToOss(
    job: GenerationJob | null,
    context: {
      type: GenerationJobTypeEnum;
      adminId: string;
      sessionId: string;
    },
  ) {
    if (!job || job.type !== context.type) return null;
    const providerUrls = stringArray(job.providerOutputUrls);
    if (
      context.type === "TEXT2IMAGE" &&
      (await this.shouldUseProviderOutputDirectly(job))
    ) {
      return providerUrls[0] ?? null;
    }

    for (const url of providerUrls) {
      const existingKey = this.oss.assetKeyFromUrl(url);
      if (existingKey) return existingKey;

      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) {
          this.logger.warn(
            `Template example download failed for job ${job.id}: HTTP ${res.status}`,
          );
          continue;
        }

        const contentType =
          res.headers.get("content-type") ??
          (context.type === "IMAGE2VIDEO" ? "video/mp4" : "image/png");
        const buffer = Buffer.from(await res.arrayBuffer());
        if (!buffer.length) continue;

        const { key } = await this.oss.putBuffer(
          `templates/examples/${context.adminId}/${context.sessionId}`,
          buffer,
          contentType,
          {
            userId: context.adminId,
            visibility: "PRIVATE",
            requireUpload: true,
          },
        );
        return key;
      } catch (err) {
        this.logger.warn(
          `Template example OSS copy failed for job ${job.id}: ${(err as Error).message}`,
        );
      }
    }

    return null;
  }

  private async shouldUseProviderOutputDirectly(job: GenerationJob) {
    const model = await this.prisma.aIModel.findUnique({
      where: { code: job.modelCode },
      select: { baseUrl: true },
    });
    if (!model) return false;
    return isDirectText2ImageProviderBaseUrl(
      model.baseUrl,
      parseDirectText2ImageOrigins(
        this.config.get<string>(DIRECT_TEXT2IMAGE_ORIGINS_ENV),
      ),
    );
  }
}
