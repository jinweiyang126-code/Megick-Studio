import { BadRequestException, Injectable } from "@nestjs/common";
import { NavigationMenuArea, Prisma } from "@prisma/client";
import { PrismaService } from "nestjs-prisma";
import type { AdminAuditRequestContext } from "@/common/utils/admin-audit-context";
import { AdminAuditService } from "@/modules/admin/admin-audit.service";
import type { NavigationMenuItemDto } from "./navigation-menus.dto";

type PublicMenuItem = {
  id: string;
  area: NavigationMenuArea;
  code: string;
  label: string;
  labelEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  href: string;
  icon: string | null;
  requiresAuth: boolean;
  isActive: boolean;
  sortOrder: number;
  metadata: Prisma.JsonValue | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const defaultHeaderItems: PublicMenuItem[] = [
  {
    id: "default-header-templates",
    area: NavigationMenuArea.HEADER,
    code: "templates",
    label: "Templates",
    labelEn: "Templates",
    description: null,
    descriptionEn: null,
    href: "/templates",
    icon: null,
    requiresAuth: false,
    isActive: true,
    sortOrder: 10,
    metadata: null,
  },
  {
    id: "default-header-studio",
    area: NavigationMenuArea.HEADER,
    code: "studio",
    label: "AI Studio",
    labelEn: "AI Studio",
    description: null,
    descriptionEn: null,
    href: "/dashboard/studio/image",
    icon: null,
    requiresAuth: true,
    isActive: true,
    sortOrder: 30,
    metadata: { dashboardDefault: true },
  },
];

const defaultDashboardItems: PublicMenuItem[] = [
  ["image-studio", "Image AI Studio", "Image AI Studio", "Generate and refine images", "Generate and refine images", "/dashboard/studio/image", "image", 10, { studioMode: "image" }],
  ["video-studio", "Video AI Studio", "Video AI Studio", "Generate videos from prompts and images", "Generate videos from prompts and images", "/dashboard/studio/video", "video", 20, { studioMode: "video", badge: "Advanced" }],
  ["video-editor", "Video Editor", "Video Editor", "Edit and trim your videos", "Edit and trim your videos", "/dashboard/video-editor", "scissors", 30, null],
  ["templates", "Templates", "Templates", "Browse image and video templates", "Browse image and video templates", "/dashboard/template", "layout-template", 40, null],
  ["media-center", "Media Center", "Media Center", "View all generated media", "View all generated media", "/dashboard/media-center", "images", 50, null],
  ["history", "Generation History", "Generation History", "Review generation history", "Review generation history", "/dashboard/history", "history", 80, null],
  ["chats", "Chat History", "Chat History", "Pinned and recent Studio sessions", "Pinned and recent Studio sessions", "/dashboard/chats", "message-square", 90, null],
  ["profile", "Profile", "Profile", "Manage account and preferences", "Manage account and preferences", "/dashboard/profile", "user", 100, null],
].map(
  ([code, label, labelEn, description, descriptionEn, href, icon, sortOrder, metadata]) =>
    ({
      id: `default-dashboard-${code}`,
      area: NavigationMenuArea.DASHBOARD_SIDEBAR,
      code,
      label,
      labelEn,
      description,
      descriptionEn,
      href,
      icon,
      requiresAuth: true,
      isActive: true,
      sortOrder,
      metadata,
    }) as PublicMenuItem,
);

const defaultItemsByArea: Record<NavigationMenuArea, PublicMenuItem[]> = {
  [NavigationMenuArea.HEADER]: defaultHeaderItems,
  [NavigationMenuArea.DASHBOARD_SIDEBAR]: defaultDashboardItems,
};

function isRemovedAboutMenuItem(item: Pick<PublicMenuItem, "area" | "code" | "href">) {
  return (
    item.area === NavigationMenuArea.HEADER &&
    (item.code === "about" || item.href === "/about")
  );
}

@Injectable()
export class NavigationMenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async listPublic(area: NavigationMenuArea) {
    if (!Object.values(NavigationMenuArea).includes(area)) {
      throw new BadRequestException("INVALID_NAVIGATION_MENU_AREA");
    }

    const rows = await this.prisma.navigationMenuItem.findMany({
      where: { area, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const visibleRows = rows.filter((item) => !isRemovedAboutMenuItem(item));
    return visibleRows.length ? visibleRows : defaultItemsByArea[area];
  }

  async listAdmin() {
    const rows = await this.prisma.navigationMenuItem.findMany({
      orderBy: [{ area: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.filter((item) => !isRemovedAboutMenuItem(item));
  }

  async upsert(input: NavigationMenuItemDto, auditCtx?: AdminAuditRequestContext) {
    const before = input.id
      ? await this.prisma.navigationMenuItem.findUnique({ where: { id: input.id } })
      : null;
    const data = this.inputToData(input);
    const row = input.id
      ? await this.prisma.navigationMenuItem.update({
          where: { id: input.id },
          data,
        })
      : await this.prisma.navigationMenuItem.create({ data });

    await this.audit.logExplicit(auditCtx, {
      action: before ? "UPDATE" : "CREATE",
      targetType: "navigation_menu",
      targetId: row.id,
      before,
      after: row,
    });
    return row;
  }

  async delete(id: string, auditCtx?: AdminAuditRequestContext) {
    const before = await this.prisma.navigationMenuItem.findUnique({ where: { id } });
    const row = await this.prisma.navigationMenuItem.delete({ where: { id } });
    await this.audit.logExplicit(auditCtx, {
      action: "DELETE",
      targetType: "navigation_menu",
      targetId: id,
      before,
      after: row,
    });
    return row;
  }

  private inputToData(input: NavigationMenuItemDto) {
    const code = input.code.trim();
    const label = input.label.trim();
    const href = input.href.trim();
    if (!code || !label || !href) {
      throw new BadRequestException("MENU_CODE_LABEL_HREF_REQUIRED");
    }

    return {
      area: input.area,
      code,
      label,
      labelEn: input.labelEn?.trim() || null,
      description: input.description?.trim() || null,
      descriptionEn: input.descriptionEn?.trim() || null,
      href,
      icon: input.icon?.trim() || null,
      requiresAuth: input.requiresAuth ?? false,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      metadata:
        input.metadata == null
          ? Prisma.JsonNull
          : (input.metadata as Prisma.InputJsonValue),
    };
  }
}
