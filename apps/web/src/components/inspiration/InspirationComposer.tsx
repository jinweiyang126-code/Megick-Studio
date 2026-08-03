import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import type { AIModelPublic } from "@megick/api-types";
import { Textarea } from "@/components/ui/textarea";
import { MagiCoreIcon, magiCoreIcons } from "@/components/brand/MagiCoreIcon";
import { RATIO_PRESETS, STYLE_PRESETS } from "@/components/studio/presets";
import {
  STUDIO_REFERENCE_IMAGE_EXTENSIONS,
  STUDIO_REFERENCE_IMAGE_MAX_BYTES,
} from "@/components/studio/panel/constants";
import {
  extensionFromName,
  referenceBoundsForModel,
  referenceKindFromFile,
  writeStudioHandoff,
} from "@/components/studio/panel/utils";
import { apiGet } from "@/lib/api-client";
import { styleLabelKey, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { newStudioId } from "@/routes/-dashboard-types";
import { referenceSrcFromBlob } from "@/routes/-studio-shared";
import { toast } from "sonner";

const MODEL_ICON_DIR = "/brand/magicore/inspiration";

function modelChipIcon(displayName: string, code: string): string | null {
  const key = `${displayName} ${code}`.toLowerCase();
  if (key.includes("seedream")) return `${MODEL_ICON_DIR}/icon-seedream.svg`;
  if (key.includes("gpt") || key.includes("openai")) return `${MODEL_ICON_DIR}/icon-gpt.svg`;
  if (key.includes("banana") || key.includes("nano")) return `${MODEL_ICON_DIR}/icon-banana.svg`;
  if (key.includes("kling")) return `${MODEL_ICON_DIR}/icon-kling.svg`;
  if (key.includes("wan")) return `${MODEL_ICON_DIR}/icon-wan.svg`;
  return null;
}

type InspirationReference = {
  id: string;
  src: string;
  name: string;
};

function PillButton({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm transition",
        active
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border bg-transparent text-[#8b8e94] hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function InspirationComposer() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(STYLE_PRESETS[0]?.id ?? "none");
  const [ratio, setRatio] = useState(RATIO_PRESETS[0]?.id ?? "1:1");
  const [modelCode, setModelCode] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [refs, setRefs] = useState<InspirationReference[]>([]);
  const [uploading, setUploading] = useState(false);

  const modelsQ = useQuery({
    queryKey: ["ai-models", "active", "inspiration"],
    queryFn: () => apiGet<AIModelPublic[]>("/api/ai-models"),
    staleTime: 300_000,
  });

  const imageModels = useMemo(() => {
    const rows = (modelsQ.data ?? []).filter(
      (model) => model.isActive !== false && model.category === "TEXT2IMAGE",
    );
    return rows.slice(0, 8);
  }, [modelsQ.data]);

  const selectedModel =
    imageModels.find((model) => model.code === modelCode) ?? imageModels[0] ?? null;
  const referenceBounds = referenceBoundsForModel("image", selectedModel);
  const maxRefs = Math.max(referenceBounds.maxReferenceImages || 4, 1);
  const canAddMore = refs.length < maxRefs;

  const handleAddFiles = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;

    if (!referenceBounds.supportsReferenceImages) {
      toast.message(t("studio.modelNoReferenceImages"), {
        description: t("inspiration.composer.referenceModelHint"),
      });
    }

    const acceptedFiles = selectedFiles.filter((file) => {
      const kind = referenceKindFromFile(file);
      const ext = extensionFromName(file.name);
      if (!kind || kind !== "image") return false;
      return (
        STUDIO_REFERENCE_IMAGE_EXTENSIONS.includes(ext) ||
        STUDIO_REFERENCE_IMAGE_EXTENSIONS.some((v) => file.type.toLowerCase().includes(v))
      );
    });
    if (!acceptedFiles.length) {
      toast.error(t("studio.invalidReferenceFile"));
      return;
    }
    if (acceptedFiles.length !== selectedFiles.length) {
      toast.error(t("studio.invalidReferenceFile"));
    }

    const remaining = maxRefs - refs.length;
    if (remaining <= 0) {
      toast.error(t("studio.referenceImageTooMany", { count: maxRefs }));
      return;
    }
    const filesToUpload = acceptedFiles.slice(0, remaining);
    if (acceptedFiles.length > remaining) {
      toast.error(t("studio.referenceImageTooMany", { count: maxRefs }));
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        filesToUpload.map(async (file) => {
          if (file.size > STUDIO_REFERENCE_IMAGE_MAX_BYTES) {
            throw new Error(t("studio.referenceImageTooLarge"));
          }
          const src = await referenceSrcFromBlob(
            file,
            file.name || t("studio.reference"),
            "image",
          );
          return {
            id: newStudioId(),
            src,
            name: file.name || t("studio.reference"),
          } satisfies InspirationReference;
        }),
      );
      setRefs((prev) => [...prev, ...uploaded].slice(0, maxRefs));
      toast.success(t("studio.refAdded"));
    } catch (err) {
      toast.error(t("studio.referenceFileReadFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerate = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error(t("studio.composer.empty"), {
        description: t("studio.composer.emptyDesc"),
      });
      return;
    }

    const handoffPayload =
      refs.length > 0
        ? {
            prompt: trimmed,
            refs: refs.map((ref) => ({ src: ref.src, name: ref.name })),
          }
        : null;
    const handoffId = handoffPayload ? writeStudioHandoff(handoffPayload) : null;

    void navigate({
      to: "/dashboard/studio/image",
      search: {
        prompt: trimmed,
        style,
        ratio,
        newSession: true,
        autoSubmit: true,
        ...(handoffId
          ? { handoffId }
          : refs[0]
            ? { sourceImage: refs[0].src, sourceImageName: refs[0].name }
            : {}),
      },
    });
  };

  return (
    <section className="mx-auto flex w-full max-w-[1352px] flex-col items-center gap-8">
      <div className="w-full rounded-xl border border-[#26282b] bg-[#1b1c21] p-4 sm:p-6">
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={STUDIO_REFERENCE_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
            multiple={maxRefs > 1}
            className="hidden"
            onChange={(event) => void handleAddFiles(event.target.files)}
          />
          {refs.length ? (
            <div className="flex h-[106px] shrink-0 gap-2 overflow-x-auto">
              {refs.map((ref) => (
                <div
                  key={ref.id}
                  className="group relative h-[106px] w-[90px] shrink-0 overflow-hidden rounded-lg bg-[#1e2025] sm:w-[106px]"
                >
                  <img src={ref.src} alt={ref.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setRefs((prev) => prev.filter((item) => item.id !== ref.id))}
                    className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={t("studio.remove")}
                    title={t("studio.remove")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {canAddMore ? (
                <button
                  type="button"
                  disabled={uploading}
                  className="flex h-[106px] w-[90px] shrink-0 items-center justify-center rounded-lg bg-[#1e2025] text-muted-foreground transition hover:text-primary disabled:opacity-50 sm:w-[106px]"
                  aria-label={t("inspiration.composer.addReference")}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MagiCoreIcon src={magiCoreIcons.fileAdd} className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              className="flex h-[106px] w-[90px] shrink-0 items-center justify-center rounded-lg bg-[#1e2025] text-muted-foreground transition hover:text-primary disabled:opacity-50 sm:w-[106px]"
              aria-label={t("inspiration.composer.addReference")}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MagiCoreIcon src={magiCoreIcons.fileAdd} className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                handleGenerate();
              }
            }}
            placeholder={t("inspiration.composer.placeholder")}
            rows={4}
            className="min-h-[96px] flex-1 resize-none border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-[#8b8e94] focus-visible:ring-0"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative">
              <PillButton
                onClick={() => {
                  setStyleOpen((v) => !v);
                  setRatioOpen(false);
                }}
              >
                <MagiCoreIcon src={magiCoreIcons.composerStyle} className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{t(styleLabelKey(style))}</span>
              </PillButton>
              {styleOpen ? (
                <div className="absolute left-0 top-10 z-20 max-h-56 w-40 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                  {STYLE_PRESETS.slice(0, 8).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="flex w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        setStyle(preset.id);
                        setStyleOpen(false);
                      }}
                    >
                      {t(styleLabelKey(preset.id))}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <PillButton
                onClick={() => {
                  setRatioOpen((v) => !v);
                  setStyleOpen(false);
                }}
              >
                <MagiCoreIcon src={magiCoreIcons.composerRatio} className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{ratio}</span>
              </PillButton>
              {ratioOpen ? (
                <div className="absolute left-0 top-10 z-20 w-28 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                  {RATIO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="flex w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        setRatio(preset.id);
                        setRatioOpen(false);
                      }}
                    >
                      {preset.id}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {selectedModel ? (
              <PillButton active>
                <MagiCoreIcon src={magiCoreIcons.composerModel} className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[140px] truncate whitespace-nowrap">
                  {selectedModel.displayName}
                </span>
              </PillButton>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={uploading}
            className="flex h-8 w-[88px] shrink-0 items-center justify-center gap-2 rounded-xl text-[#0a0a0a] transition hover:brightness-110 disabled:opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(96.12deg, #57d9fa 1.88%, #72aefc 82.03%, #9f66ff 109.58%, #ba4dfe 132.12%)",
            }}
          >
            <span className="flex items-center gap-1">
              <MagiCoreIcon src={magiCoreIcons.pointsBlack} className="h-3.5 w-3.5" />
              <span className="text-xs font-medium leading-none">
                {selectedModel?.costCredits ?? 1}
              </span>
            </span>
            <span className="text-sm font-medium leading-none">
              {t("inspiration.composer.generate")}
            </span>
          </button>
        </div>
      </div>

      {/* Figma Frame 13 — model chips under composer with icons */}
      {imageModels.length > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {imageModels.map((model) => {
            const active = selectedModel?.code === model.code;
            const icon = modelChipIcon(model.displayName, model.code);
            return (
              <button
                key={model.code}
                type="button"
                onClick={() => setModelCode(model.code)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm tracking-[0.28px] transition",
                  active
                    ? "border-primary bg-[rgba(87,217,250,0.08)] text-primary"
                    : "border-[rgba(182,187,195,0.3)] bg-transparent text-[#8b8e94] hover:text-foreground",
                )}
              >
                {icon ? (
                  <img
                    src={`${icon}?v=1`}
                    alt=""
                    className="h-4 w-4 shrink-0"
                    draggable={false}
                  />
                ) : null}
                {model.displayName}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
