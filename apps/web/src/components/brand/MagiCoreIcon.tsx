import { cn } from "@/lib/utils";

const ICON_BASE = "/brand/magicore/icons";

export const magiCoreIcons = {
  navInspiration: `${ICON_BASE}/nav-inspiration.svg`,
  navInspirationIdle: `${ICON_BASE}/nav-inspiration-idle.svg`,
  navImage: `${ICON_BASE}/nav-image.svg`,
  navImageActive: `${ICON_BASE}/nav-image-active.svg`,
  navVideo: `${ICON_BASE}/nav-video.svg`,
  navVideoActive: `${ICON_BASE}/nav-video-active.svg`,
  navEdit: `${ICON_BASE}/nav-edit.svg`,
  navEditActive: `${ICON_BASE}/nav-edit-active.svg`,
  composerStyle: `${ICON_BASE}/composer-style.svg`,
  composerStyleWhite: `${ICON_BASE}/composer-style-white.svg`,
  composerRatio: `${ICON_BASE}/composer-ratio.svg`,
  composerRatioWhite: `${ICON_BASE}/composer-ratio-white.svg`,
  composerModel: `${ICON_BASE}/composer-model.svg`,
  composerModelMuted: `${ICON_BASE}/composer-model-muted.svg`,
  composerModelWhite: `${ICON_BASE}/composer-model-white.svg`,
  composerReference: `${ICON_BASE}/composer-reference.svg`,
  composerTemplate: `${ICON_BASE}/composer-template.svg`,
  composerExpand: `${ICON_BASE}/composer-expand.svg`,
  fileAdd: `${ICON_BASE}/icon-file-add.svg`,
  asset: `${ICON_BASE}/icon-asset.svg?v=6`,
  guide: `${ICON_BASE}/icon-guide.svg?v=6`,
  more: `${ICON_BASE}/icon-more.svg?v=5`,
  pointsBlack: `${ICON_BASE}/icon-points-black.svg`,
  pointsGradient: `${ICON_BASE}/icon-points-gradient.svg`,
  previewEye: `${ICON_BASE}/icon-preview-eye.svg`,
  previewExpand: `${ICON_BASE}/icon-preview-expand.svg`,
  previewVideo: `${ICON_BASE}/icon-preview-video.svg`,
  previewDownload: `${ICON_BASE}/icon-preview-download.svg`,
} as const;

const primaryRailIcons: Record<
  string,
  { idle: string; active: string }
> = {
  templates: {
    idle: magiCoreIcons.navInspirationIdle,
    active: magiCoreIcons.navInspiration,
  },
  "image-studio": {
    idle: magiCoreIcons.navImage,
    active: magiCoreIcons.navImageActive,
  },
  "video-studio": {
    idle: magiCoreIcons.navVideo,
    active: magiCoreIcons.navVideoActive,
  },
  "video-editor": {
    idle: magiCoreIcons.navEdit,
    active: magiCoreIcons.navEditActive,
  },
};

export function primaryRailIconSrc(value: string, active: boolean) {
  const entry = primaryRailIcons[value];
  if (!entry) return null;
  return active ? entry.active : entry.idle;
}

export function MagiCoreIcon({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("pointer-events-none select-none object-contain", className)}
    />
  );
}

/** Figma studio control pill (image/video composer). */
export const magiCorePillClass =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-[#17181d] px-4 text-sm text-foreground transition hover:border-primary/40";
