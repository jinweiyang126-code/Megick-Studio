import { useCallback, useState } from "react";
import { Eye } from "lucide-react";
import { MagiCoreIcon, magiCoreIcons } from "@/components/brand/MagiCoreIcon";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const PREVIEW_TOOLBAR_CLASS =
  "flex flex-wrap justify-end gap-2 px-0 text-white";
export const PREVIEW_TOOL_BUTTON_CLASS =
  "h-10 gap-1.5 rounded-xl border border-border bg-[#17181d] px-4 text-sm text-white hover:bg-[#1e2025] hover:text-white";
export const PREVIEW_TOOL_ACCENT_BUTTON_CLASS =
  "h-10 gap-1.5 rounded-xl border border-primary bg-transparent px-4 text-sm font-medium text-primary hover:bg-primary/10 hover:text-primary";
export const PREVIEW_TOOL_DANGER_BUTTON_CLASS =
  "h-10 gap-1.5 rounded-xl border border-border bg-[#17181d] px-4 text-sm text-white hover:bg-destructive/20 hover:text-white";
const PREVIEW_TOOL_TOGGLE_BUTTON_CLASS = `${PREVIEW_TOOL_BUTTON_CLASS} w-10 px-0`;
const PREVIEW_TOOLBAR_VISIBILITY_STORAGE_KEY = "megick.studio.previewToolbarVisible";

function readPreviewToolbarVisiblePreference() {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(PREVIEW_TOOLBAR_VISIBILITY_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function writePreviewToolbarVisiblePreference(visible: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREVIEW_TOOLBAR_VISIBILITY_STORAGE_KEY, String(visible));
  } catch {
    // localStorage may be unavailable in private browsing.
  }
}

export function usePreviewToolbarVisibility() {
  const [toolbarVisible, setToolbarVisibleState] = useState(readPreviewToolbarVisiblePreference);
  const setToolbarVisible = useCallback((visible: boolean) => {
    setToolbarVisibleState(visible);
    writePreviewToolbarVisiblePreference(visible);
  }, []);

  return [toolbarVisible, setToolbarVisible] as const;
}

export function PreviewToolbarToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const label = visible ? t("studio.hidePreviewToolbar") : t("studio.showPreviewToolbar");

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={PREVIEW_TOOL_TOGGLE_BUTTON_CLASS}
    >
      {visible ? (
        <MagiCoreIcon src={magiCoreIcons.previewEye} className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </Button>
  );
}
