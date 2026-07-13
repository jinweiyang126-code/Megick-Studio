import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { StudioResult } from "@/routes/-dashboard-types";
import { saveBlob } from "@/components/studio/panel/utils";
import { useI18n } from "@/lib/i18n";
import { SessionVideoMediaCenter, exportMergedVideo } from "./video-media-center";

function mergedVideoExtension(blob: Blob) {
  const type = blob.type.toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("quicktime")) return "mov";
  return "mp4";
}

export function MediaCenterDialog({
  open,
  onOpenChange,
  title,
  description,
  videos,
  fetchMediaBlob,
  objectUrlFromBlob,
  appendMergedVideoToSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  videos: StudioResult[];
  fetchMediaBlob: (item: StudioResult) => Promise<Blob>;
  objectUrlFromBlob: (blob: Blob) => string;
  appendMergedVideoToSession: (blob: Blob, videos: StudioResult[]) => Promise<void>;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-5xl overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <SessionVideoMediaCenter
          videos={videos}
          onClose={() => onOpenChange(false)}
          onMerge={async (selectedVideos) => {
            const blob = await exportMergedVideo(selectedVideos, fetchMediaBlob, objectUrlFromBlob);
            try {
              await appendMergedVideoToSession(blob, selectedVideos);
            } catch (err) {
              saveBlob(blob, `megick-merged-${Date.now()}.${mergedVideoExtension(blob)}`);
              toast.error(t("studio.mergeVideos.saveFailed"), {
                description: err instanceof Error ? err.message : undefined,
              });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
