import type { TranslationKey } from "./i18n";

export type NavigationMenuArea = "HEADER" | "DASHBOARD_SIDEBAR";
export type NavigationMenuMetadata = Record<string, string | number | boolean | null>;

export interface NavigationMenuItem {
  id: string;
  area: NavigationMenuArea;
  code: string;
  label: string;
  labelEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  href: string;
  icon?: string | null;
  requiresAuth: boolean;
  isActive: boolean;
  sortOrder: number;
  metadata?: NavigationMenuMetadata | null;
}

const defaultNavigationLabelKeys: Record<string, TranslationKey> = {
  studio: "nav.aiStudio",
  templates: "nav.templates",
  "image-studio": "dashboard.nav.imageStudio.label",
  "video-studio": "dashboard.nav.videoStudio.label",
  "video-editor": "dashboard.nav.videoEditor.label",
  "media-center": "dashboard.nav.mediaCenter.label",
  history: "dashboard.nav.history.label",
  chats: "dashboard.nav.chats.label",
  profile: "dashboard.nav.profile.label",
};

const defaultNavigationDescriptionKeys: Record<string, TranslationKey> = {
  "image-studio": "dashboard.nav.imageStudio.description",
  "video-studio": "dashboard.nav.videoStudio.description",
  "video-editor": "dashboard.nav.videoEditor.description",
  templates: "dashboard.nav.templates.description",
  "media-center": "dashboard.nav.mediaCenter.description",
  history: "dashboard.nav.history.description",
  chats: "dashboard.nav.chats.description",
  profile: "dashboard.nav.profile.description",
};

export const DEFAULT_HEADER_MENU_ITEMS: NavigationMenuItem[] = [
  {
    id: "default-header-templates",
    area: "HEADER",
    code: "templates",
    label: "Templates",
    labelEn: "Templates",
    href: "/templates",
    requiresAuth: false,
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "default-header-studio",
    area: "HEADER",
    code: "studio",
    label: "AI Studio",
    labelEn: "AI Studio",
    href: "/dashboard/studio/image",
    requiresAuth: true,
    isActive: true,
    sortOrder: 30,
    metadata: { dashboardDefault: true },
  },
];

function shouldUseChineseMenuText(locale: string) {
  const normalized = locale.toLowerCase();
  return normalized === "zh-cn" || normalized === "zh-tw" || normalized.startsWith("zh-");
}

export function localizedMenuLabel(
  item: Pick<NavigationMenuItem, "code" | "label" | "labelEn">,
  locale: string,
  translate?: (key: TranslationKey) => string,
) {
  const defaultLabelKey = defaultNavigationLabelKeys[item.code];
  if (translate && defaultLabelKey) return translate(defaultLabelKey);
  return !shouldUseChineseMenuText(locale) && item.labelEn ? item.labelEn : item.label;
}

export function localizedMenuDescription(
  item: Pick<NavigationMenuItem, "code" | "description" | "descriptionEn">,
  locale: string,
  translate?: (key: TranslationKey) => string,
) {
  const defaultDescriptionKey = defaultNavigationDescriptionKeys[item.code];
  if (translate && defaultDescriptionKey) return translate(defaultDescriptionKey);
  return !shouldUseChineseMenuText(locale) && item.descriptionEn
    ? item.descriptionEn
    : (item.description ?? "");
}
