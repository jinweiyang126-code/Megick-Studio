import { useState } from "react";
import { toast } from "sonner";
import type { AIModelPublic, VideoModelInputMode } from "@megick/api-types";
import {
  FileVideo,
  HelpCircle,
  Loader2,
  Lock,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { MagiCoreIcon, magiCoreIcons } from "@/components/brand/MagiCoreIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { RATIO_PRESETS } from "@/components/studio/presets";
import { useI18n } from "@/lib/i18n";
import { modelDisplayName } from "@/lib/model-display";
import { cn } from "@/lib/utils";
import { clampStudioVideoDuration, type StudioSettings } from "@/routes/-dashboard-types";
import { VIDEO_INPUT_MODES } from "./constants";
import type { StudioGenerationPayload, StudioMediaReference } from "./types";
import { estimatedGenerationCredits, mediaKindFromUrl, videoModeLabelKey } from "./utils";

const MAGICORE_GENERATE_GRADIENT =
  "linear-gradient(97deg, #57d9fa 1.88%, #72aefc 82.03%, #9f66ff 109.58%, #ba4dfe 132.12%)";
const videoChipClass =
  "flex h-9 items-center justify-center rounded-xl border text-sm transition";
const videoChipActiveClass = "border-primary bg-primary/15 text-foreground";
const videoChipIdleClass =
  "border-border bg-[#17181d] text-[#8b8e94] hover:border-primary/40 hover:text-foreground";

export function VideoGenerationPanel({
  prompt,
  setPrompt,
  settings,
  updateSettings,
  selectedVideoMode,
  enabledVideoModes,
  modelLabelForCredits,
  currentModel,
  currentModelLabel,
  currentModelLocked,
  modelsForMode,
  modelsLoading,
  hasAdvancedAccess,
  studioRefs,
  addReferenceFiles,
  removeImageReference,
  referenceFileInputRef,
  referenceUploading,
  referenceUrlInput,
  setReferenceUrlInput,
  addReferenceUrl,
  videoReferenceLimit,
  videoDropzoneAccept,
  durationMinSeconds,
  durationMaxSeconds,
  promptTipsOpen,
  setPromptTipsOpen,
  submitting,
  handleGenerate,
  onReset,
  startNewSession,
  openMediaCenter,
  formatNumber,
  sessionTitle,
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  settings: StudioSettings;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  selectedVideoMode: VideoModelInputMode;
  enabledVideoModes: VideoModelInputMode[];
  modelLabelForCredits: (model: AIModelPublic) => string;
  currentModel: AIModelPublic | null;
  currentModelLabel: string;
  currentModelLocked: boolean;
  modelsForMode: AIModelPublic[];
  modelsLoading: boolean;
  hasAdvancedAccess: boolean;
  studioRefs: StudioMediaReference[];
  addReferenceFiles: (files: FileList | File[] | null | undefined) => Promise<void>;
  removeImageReference: (id: string) => void;
  referenceFileInputRef: { current: HTMLInputElement | null };
  referenceUploading: boolean;
  referenceUrlInput: string;
  setReferenceUrlInput: (value: string) => void;
  addReferenceUrl: (value?: string) => boolean;
  videoReferenceLimit: number;
  videoDropzoneAccept: string;
  durationMinSeconds: number;
  durationMaxSeconds: number;
  promptTipsOpen: boolean;
  setPromptTipsOpen: (open: boolean) => void;
  submitting: boolean;
  handleGenerate: (payload?: StudioGenerationPayload) => Promise<void>;
  onReset: () => void;
  startNewSession: () => void;
  openMediaCenter: () => void;
  formatNumber: (value: number) => string;
  sessionTitle?: string;
}) {
  const { locale, t } = useI18n();
  const showMediaPicker = selectedVideoMode !== "T2V";
  const showAspectRatio = selectedVideoMode !== "I2V";
  const estimatedCredits = estimatedGenerationCredits(currentModel, settings.duration);
  const promptPlaceholder =
    selectedVideoMode === "I2V"
      ? t("studio.videoPanel.promptPlaceholder.i2v")
      : selectedVideoMode === "R2V"
        ? t("studio.videoPanel.promptPlaceholder.r2v")
        : selectedVideoMode === "EDIT"
          ? t("studio.videoPanel.promptPlaceholder.edit")
          : t("studio.composer.videoPlaceholder");

  const [modelOpen, setModelOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const selectModel = (model: AIModelPublic) => {
    const locked = !hasAdvancedAccess && model.accessLevel === "PAID";
    if (locked) {
      toast.error(t("studio.advancedAccessRequired"), {
        description:
          "Open-source edition: ask an administrator to grant access or adjust credits.",
      });
      return;
    }
    updateSettings({ model: model.code });
    setModelOpen(false);
  };

  const selectVideoMode = (mode: VideoModelInputMode) => {
    updateSettings({
      videoInputMode: mode,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Title bar — MagiCore / Figma 77:1512 workspace */}
      <div className="shrink-0 border-b border-border px-6 pb-4 pt-6">
        {sessionTitle ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-base uppercase text-white" title={sessionTitle}>
              {sessionTitle}
            </p>
            <button
              type="button"
              onClick={startNewSession}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm text-white transition hover:border-primary/50"
              title={t("studio.new")}
            >
              <MagiCoreIcon src={magiCoreIcons.fileAdd} className="h-3.5 w-3.5" />
              {t("studio.new")}
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-onboarding-target="video-model-selector"
                className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border bg-[#17181d] px-4 text-left text-sm transition hover:border-primary/40"
                title={currentModelLabel}
              >
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-[#8b8e94]">
                    {t("studio.videoPanel.model")}
                  </span>
                  <span className="block truncate text-white">{currentModelLabel}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-[#8b8e94]">
                  <MagiCoreIcon src={magiCoreIcons.composerModelMuted} className="h-3.5 w-3.5" />
                  {currentModel ? (
                    <>
                      {currentModelLocked ? (
                        <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                          <Lock className="h-3 w-3" />
                          {t("dashboard.advancedAccess")}
                        </Badge>
                      ) : currentModel.accessLevel === "PAID" ? (
                        <Badge className="h-5 px-1.5 text-[10px]">
                          {t("dashboard.advancedAccess")}
                        </Badge>
                      ) : null}
                      {modelLabelForCredits(currentModel)}
                    </>
                  ) : null}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-2 p-2" align="start" sideOffset={8}>
              {modelsLoading ? (
                <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : modelsForMode.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">
                  {t("studio.videoPanel.noModelForMode")}
                </p>
              ) : (
                modelsForMode.map((model) => {
                  const locked = !hasAdvancedAccess && model.accessLevel === "PAID";
                  return (
                    <button
                      key={model.code}
                      type="button"
                      onClick={() => selectModel(model)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md border px-2 py-2 text-left text-xs transition",
                        settings.model === model.code
                          ? "border-primary bg-primary/15 text-foreground"
                          : locked
                            ? "border-border bg-background/30 text-muted-foreground opacity-75"
                            : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="min-w-0 truncate">{modelDisplayName(model, locale)}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[10px]">
                        {locked ? <Lock className="h-3 w-3" /> : null}
                        {modelLabelForCredits(model)}
                      </span>
                    </button>
                  );
                })
              )}
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={openMediaCenter}
            title={t("studio.mediaCenter")}
            aria-label={t("studio.mediaCenter")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-[#17181d] text-white transition hover:border-primary/40"
          >
            <MagiCoreIcon src={magiCoreIcons.asset} className="h-3.5 w-3.5" />
          </button>
          {!sessionTitle ? (
            <button
              type="button"
              onClick={startNewSession}
              title={t("studio.new")}
              aria-label={t("studio.new")}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-[#17181d] text-white transition hover:border-primary/40"
            >
              <MagiCoreIcon src={magiCoreIcons.fileAdd} className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-[#17181d] p-1">
          {VIDEO_INPUT_MODES.map((mode) => {
            const disabled = !enabledVideoModes.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => selectVideoMode(mode)}
                className={cn(
                  "min-h-8 rounded-lg px-2 text-xs font-medium transition",
                  selectedVideoMode === mode
                    ? "bg-[#1b1c21] text-white shadow-sm"
                    : "text-[#8b8e94] hover:text-white",
                  disabled ? "cursor-not-allowed opacity-45" : "",
                )}
              >
                {t(videoModeLabelKey(mode))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-5">
          {showMediaPicker ? (
            <div className="space-y-2">
              <input
                ref={referenceFileInputRef}
                type="file"
                accept={videoDropzoneAccept}
                multiple={selectedVideoMode !== "I2V"}
                className="hidden"
                onChange={(event) => {
                  void addReferenceFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                disabled={referenceUploading}
                onClick={() => referenceFileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void addReferenceFiles(event.dataTransfer.files);
                }}
                className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-[#17181d] p-4 text-center text-sm text-[#8b8e94] transition hover:border-primary/50 hover:text-foreground disabled:cursor-wait disabled:opacity-70"
              >
                {referenceUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : selectedVideoMode === "EDIT" ? (
                  <FileVideo className="h-6 w-6 text-primary" />
                ) : (
                  <MagiCoreIcon src={magiCoreIcons.composerReference} className="h-6 w-6" />
                )}
                <span className="font-medium text-white">
                  {selectedVideoMode === "I2V"
                    ? t("studio.videoPanel.dropImage")
                    : t("studio.videoPanel.dropMedia")}
                </span>
                <span className="text-xs">
                  {selectedVideoMode === "I2V"
                    ? t("studio.referenceLimit", { count: 1 })
                    : t("studio.referenceLimit", { count: videoReferenceLimit })}
                </span>
              </button>
              {selectedVideoMode === "R2V" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("studio.videoPanel.referenceRules")}
                </p>
              ) : null}
              {selectedVideoMode === "EDIT" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("studio.videoPanel.referenceRules")}
                </p>
              ) : null}
              {showMediaPicker ? (
                <div className="flex gap-2">
                  <Input
                    value={referenceUrlInput}
                    onChange={(event) => setReferenceUrlInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addReferenceUrl();
                      }
                    }}
                    placeholder={t("studio.referenceImageUrlPlaceholder")}
                    className="h-9 bg-background/60 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addReferenceUrl()}
                    className="h-9"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
              {studioRefs.length ? (
                <div className="grid grid-cols-5 gap-2">
                  {studioRefs.map((ref, index) => {
                    const kind = ref.kind ?? mediaKindFromUrl(ref.src);
                    const isSourceVideo =
                      selectedVideoMode === "EDIT" &&
                      kind === "video" &&
                      (ref.mediaType === "video" ||
                        !studioRefs
                          .slice(0, index)
                          .some((item) => (item.kind ?? mediaKindFromUrl(item.src)) === "video"));
                    return (
                      <div
                        key={ref.id}
                        className="group relative aspect-square overflow-hidden rounded-md border border-border/70 bg-black"
                        title={ref.name}
                      >
                        {kind === "video" ? (
                          <video
                            src={ref.src}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={ref.src}
                            alt={ref.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                        <span className="absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[9px] text-white">
                          {isSourceVideo
                            ? t("studio.videoPanel.source")
                            : kind === "video"
                              ? `V${index + 1}`
                              : t("studio.videoPanel.imageIndex", { index: index + 1 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeImageReference(ref.id)}
                          className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/85 text-muted-foreground opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-foreground"
                          aria-label={t("studio.remove")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#8b8e94]">{t("common.prompt")}</p>
              <button
                type="button"
                onClick={() => setPromptTipsOpen(true)}
                className="inline-flex items-center gap-1 rounded-xl px-1.5 py-1 text-xs text-[#8b8e94] transition hover:bg-[#17181d] hover:text-white"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {t("studio.videoPanel.promptTips")}
              </button>
            </div>
            <div className="rounded-xl bg-white/5 py-2 pl-4 pr-2">
              <Textarea
                data-onboarding-target="video-prompt-input"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onFocus={() => setPromptExpanded(true)}
                onBlur={() => setPromptExpanded(false)}
                rows={promptExpanded ? 14 : 7}
                placeholder={promptPlaceholder}
                className={cn(
                  "resize-none border-0 bg-transparent px-0 py-0 text-sm leading-5 shadow-none placeholder:text-[#8b8e94] focus-visible:ring-0 transition-all duration-200",
                  promptExpanded ? "min-h-72" : "min-h-40",
                )}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleGenerate();
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2" data-onboarding-target="video-duration-selector">
              <p className="text-xs font-medium text-[#8b8e94]">{t("studio.videoPanel.resolution")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["720P", "1080P"] as const).map((resolution) => (
                  <button
                    key={resolution}
                    type="button"
                    onClick={() => updateSettings({ resolution })}
                    className={cn(
                      videoChipClass,
                      settings.resolution === resolution ? videoChipActiveClass : videoChipIdleClass,
                    )}
                  >
                    {resolution.replace("P", "")}
                  </button>
                ))}
              </div>
            </div>

            {showAspectRatio ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#8b8e94]">
                  {t("studio.videoPanel.aspectRatio")}
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {RATIO_PRESETS.map((ratio) => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => updateSettings({ ratio: ratio.id })}
                      className={cn(
                        videoChipClass,
                        "text-xs",
                        settings.ratio === ratio.id ? videoChipActiveClass : videoChipIdleClass,
                      )}
                    >
                      {ratio.id}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#8b8e94]">{t("studio.videoDuration")}</p>
                <span className="text-xs tabular-nums text-[#8b8e94]">
                  {formatNumber(settings.duration)}
                  {t("studio.videoDurationSuffix")}
                </span>
              </div>
              <Slider
                value={[settings.duration]}
                min={durationMinSeconds}
                max={durationMaxSeconds}
                step={1}
                onValueChange={(value) =>
                  updateSettings({
                    duration: Math.min(
                      durationMaxSeconds,
                      Math.max(durationMinSeconds, clampStudioVideoDuration(value[0])),
                    ),
                  })
                }
              />
              <div className="flex justify-between text-[10px] text-[#8b8e94]">
                <span>
                  {formatNumber(durationMinSeconds)}
                  {t("studio.videoDurationSuffix")}
                </span>
                <span>
                  {formatNumber(durationMaxSeconds)}
                  {t("studio.videoDurationSuffix")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-4">
        <div className="flex gap-2">
          <button
            type="button"
            data-onboarding-target="video-generate-button"
            onClick={() => void handleGenerate()}
            disabled={submitting || modelsForMode.length === 0}
            className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[#0a0a0a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundImage: MAGICORE_GENERATE_GRADIENT }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("studio.generating")}
              </>
            ) : (
              <>
                <MagiCoreIcon src={magiCoreIcons.pointsBlack} className="h-3.5 w-3.5" />
                <span className="min-w-0 truncate text-sm font-medium">
                  {currentModel
                    ? `${t("studio.generate")} · ${t("studio.estimatedCostInline", {
                        credits: formatNumber(estimatedCredits),
                      })}`
                    : t("studio.generate")}
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={submitting}
            title={t("studio.videoPanel.reset")}
            aria-label={t("studio.videoPanel.reset")}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-[#17181d] px-4 text-sm text-white transition hover:border-primary/40 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">{t("studio.reset")}</span>
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[#8b8e94]">
          {t("studio.videoPanel.resultSession")}
        </p>
      </div>

      <PromptTipsDialog open={promptTipsOpen} onOpenChange={setPromptTipsOpen} />
    </div>
  );
}

function PromptTipsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t("studio.videoPanel.promptTips")}</DialogTitle>
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h3 className="text-sm font-semibold text-foreground">
              {t("studio.videoTips.t2v.title")}
            </h3>
            <p>{t("studio.videoTips.t2v.body")}</p>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-foreground">
              {t("studio.videoTips.i2v.title")}
            </h3>
            <p>{t("studio.videoTips.i2v.body")}</p>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-foreground">
              {t("studio.videoTips.r2v.title")}
            </h3>
            <p>{t("studio.videoTips.r2v.body")}</p>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-foreground">
              {t("studio.videoTips.shots.title")}
            </h3>
            <p>{t("studio.videoTips.shots.body")}</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
