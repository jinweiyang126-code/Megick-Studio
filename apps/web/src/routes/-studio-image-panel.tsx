import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type {
  AIModelPublic,
  AIImageEditModePublic,
  GenerationJobPublic,
  PromptTemplatePublic,
  StudioEditedResultPublic,
} from "@megick/api-types";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Hash,
  Layers,
  Loader2,
  Lock,
  Repeat,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MagiCoreIcon, magiCoreIcons, magiCorePillClass } from "@/components/brand/MagiCoreIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiImageEditDialog } from "@/components/studio/AiImageEditDialog";
import { cn } from "@/lib/utils";
import { ossThumbnailUrl } from "@/lib/oss-upload";
import { api, apiGet, apiPost } from "@/lib/api-client";
import { styleLabelKey, useI18n } from "@/lib/i18n";
import { modelDisplayName } from "@/lib/model-display";
import {
  type StudioMode,
  type StudioSettings,
  type StudioResult,
  defaultStudioSettings,
  newStudioId,
  studioPathForMode,
} from "@/routes/-dashboard-types";
import { STYLE_PRESETS, RATIO_PRESETS } from "@/components/studio/presets";
import {
  asPlainRecord,
  dedupeSessionVideosForMerge,
  extensionFromName,
  imageExtension,
  mediaKindFromUrl,
  modelCreditLabel,
  normalizeReferenceInput,
  ratioParts,
  referenceBoundsForModel,
  referenceKindFromFile,
  referenceMediaTypeFor,
  settingsPatchFromGenerationJob,
  handoffReferenceName,
  refsFromGenerationJobParams,
  resolveVideoHandoffReference,
  templateReferenceUrls,
  writeStudioHandoff,
  readStudioHandoff,
} from "@/components/studio/panel/utils";
import { studioGenerationErrorNotice } from "@/components/studio/panel/generation-error-presenter";
import type {
  ConcreteVideoInputMode,
  StudioEditTarget,
  StudioMediaReference,
  StudioReference,
  StudioReferenceKind,
  StudioResultAction,
  StudioVideoMediaType,
} from "@/components/studio/panel/types";
import {
  STUDIO_REFERENCE_IMAGE_MAX_BYTES,
  STUDIO_REFERENCE_IMAGE_EXTENSIONS,
} from "@/components/studio/panel/constants";
import {
  EmptyPreview,
  FailedJobPreview,
  ImagePreviewPanel,
  StudioJobHistoryStrip,
  VideoPreviewPanel,
} from "@/components/studio/panel/preview-panels";
import { GenerationPlaceholderGrid } from "@/components/studio/panel/placeholders";
import { TemplateCenterDialog } from "@/components/studio/panel/template-center-dialog";
import { MediaCenterDialog } from "@/components/studio/panel/media-center-dialog";
import { ReferenceUploadDialog } from "@/components/studio/panel/reference-upload-dialog";
import { StudioEditorDialog } from "@/components/studio/panel/studio-editor-dialog";
import { ZoomPreviewDialog } from "@/components/studio/panel/zoom-preview-dialog";
import {
  AiEditModeIcon,
  ManualEditModeIcon,
  localizedImageEditModeName,
  type UseStudioSessionParams,
  useStudioSession,
  fetchMediaBlob,
  mediaExtension,
  saveBlob,
  psdBlobFromImageBlob,
  referenceSrcFromBlob,
  referenceSrcFromResult,
  objectUrlFromBlob,
} from "./-studio-shared";
import { EmptyState } from "./-dashboard-components";
import type { TemplateSearch } from "./dashboard.templates.index";

type AiImageEditDialogState = {
  mode: AIImageEditModePublic;
  target: StudioEditTarget;
};

interface ImageStudioPanelProps {
  sessionId?: string;
  userId?: string;
  newSession?: boolean;
  onboardingDemo?: boolean;
  autoSubmit?: boolean;
  focusJobId?: string;
  templateId?: string;
  handoffId?: string;
  sourceImage?: string;
  sourceImageName?: string;
  searchVideoInputMode?: ConcreteVideoInputMode;
  searchPrompt?: string;
  prompt: string;
  setPrompt: (value: string) => void;
  settings: StudioSettings;
  setSettings: (settings: StudioSettings) => void;
  models: AIModelPublic[];
  modelsLoading: boolean;
  videoGenerationEnabled: boolean;
  hasAdvancedAccess: boolean;
  embedded?: boolean;
  resultActionLabel?: string;
  onResultAction?: StudioResultAction;
}

function useStackedWorkspaceLayout() {
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setStacked(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return stacked;
}

export function ImageStudioPanel({
  sessionId,
  userId,
  newSession: newSessionFromSearch,
  onboardingDemo,
  autoSubmit,
  focusJobId,
  templateId,
  handoffId,
  sourceImage,
  sourceImageName,
  searchVideoInputMode,
  searchPrompt,
  prompt,
  setPrompt,
  settings,
  setSettings,
  models,
  modelsLoading,
  videoGenerationEnabled,
  hasAdvancedAccess,
  embedded = false,
  resultActionLabel,
  onResultAction,
}: ImageStudioPanelProps) {
  const { locale, t, formatNumber } = useI18n();
  const navigate = useNavigate();
  const stackedLayout = useStackedWorkspaceLayout();

  // ── Image-specific state ────────────────────────────────────────
  const referenceFileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const handoffAppliedRef = useRef<string | null>(null);
  const templateAppliedRef = useRef<string | null>(null);
  const autoSubmitRequestedRef = useRef<string | null>(null);

  const [studioRefs, setStudioRefs] = useState<StudioMediaReference[]>([]);
  const studioRefsRef = useRef<StudioMediaReference[]>([]);
  const [referenceUrlInput, setReferenceUrlInput] = useState("");
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<StudioEditTarget | null>(null);
  const [aiEditDialog, setAiEditDialog] = useState<AiImageEditDialogState | null>(null);
  const [aiEditSubmitting, setAiEditSubmitting] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [referencePreview, setReferencePreview] = useState<StudioResult | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [mediaCenterOpen, setMediaCenterOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptTipsOpen, setPromptTipsOpen] = useState(false);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
  const [templateSearch, setTemplateSearch] = useState<TemplateSearch>(() => ({
    type: settings.mode,
  }));

  // ── Queries ─────────────────────────────────────────────────────
  const imageEditModesQ = useQuery({
    queryKey: ["ai-image-edit-modes"],
    queryFn: () => apiGet<AIImageEditModePublic[]>("/api/ai-image-edit-modes"),
    enabled: true,
  });

  // ── Shared session hook ─────────────────────────────────────────
  const sharedParams: UseStudioSessionParams = useMemo(
    () => ({
      userId,
      sessionId,
      newSession: newSessionFromSearch,
      onboardingDemo,
      autoSubmit,
      focusJobId,
      routeMode: "image" as StudioMode,
      templateId,
      handoffId,
      sourceImage,
      sourceImageName,
      searchVideoInputMode,
      searchPrompt,
      models,
      modelsLoading,
      videoGenerationEnabled,
      hasAdvancedAccess,
      embedded,
      onResultAction,
    }),
    [
      userId,
      sessionId,
      newSessionFromSearch,
      onboardingDemo,
      autoSubmit,
      focusJobId,
      templateId,
      handoffId,
      sourceImage,
      sourceImageName,
      searchVideoInputMode,
      searchPrompt,
      models,
      modelsLoading,
      videoGenerationEnabled,
      hasAdvancedAccess,
      embedded,
      onResultAction,
    ],
  );

  const {
    activeSessionId,
    sessionTitle,
    titleDraft,
    titleEditing,
    titleSaving,
    sessionLoading,
    messages,
    results,
    selectedId,
    selectedJobId,
    submitting,
    studioJobs,
    studioJobsRefreshing,
    refreshStudioJobs,
    selected,
    selectedJobStatusPreview,
    scrollRef,
    startTitleEdit,
    cancelTitleEdit,
    saveTitleEdit,
    addResult: addResultFromHook,
    previewJob: previewJobFromHook,
    startNewSession: startNewSessionFromHook,
    refreshStudioQueries,
    handleImageGenerate,
    copyToClipboard,
    messageForResult,
    resolveResultTarget,
    appendMergedVideoToSession,
    reuseUserMessageDraft,
    retryGenerationJob: _unusedRetryGenerationJob,
    loadMoreMessages,
    hasMoreMessages,
    loadSessionDetail,
  } = useStudioSession(sharedParams);

  // Scroll-up to load older messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollTop < 80 && hasMoreMessages) {
        void loadMoreMessages();
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollRef, hasMoreMessages, loadMoreMessages]);

  // ── Derived image state ─────────────────────────────────────────
  const currentModel =
    models.filter((m) => m.category === "TEXT2IMAGE").find((m) => m.code === settings.model) ??
    models.filter((m) => m.category === "TEXT2IMAGE").find((m) => m.isDefault) ??
    models.filter((m) => m.category === "TEXT2IMAGE")[0] ??
    null;
  const currentModelLabel =
    currentModel ? modelDisplayName(currentModel, locale) : t("studio.noActiveModels");
  const currentModelLocked = Boolean(!hasAdvancedAccess && currentModel?.accessLevel === "PAID");
  const modelsForMode = useMemo(() => models.filter((m) => m.category === "TEXT2IMAGE"), [models]);
  const referenceBounds = referenceBoundsForModel("image", currentModel);

  // ── Refs sync ───────────────────────────────────────────────────
  useEffect(() => {
    studioRefsRef.current = studioRefs;
  }, [studioRefs]);

  useEffect(() => {
    if (!currentModel || referenceBounds.supportsReferenceImages) return;
    if (!studioRefs.length) return;
    studioRefsRef.current = [];
    setStudioRefs([]);
    setReferenceUrlInput("");
    setReferenceDialogOpen(false);
    if (referenceFileInputRef.current) referenceFileInputRef.current.value = "";
  }, [currentModel, referenceBounds.supportsReferenceImages, studioRefs.length]);

  // ── Reference helpers ───────────────────────────────────────────
  const clearReferenceDraft = () => {
    studioRefsRef.current = [];
    setStudioRefs([]);
    setReferenceUrlInput("");
    setReferenceDialogOpen(false);
    if (referenceFileInputRef.current) referenceFileInputRef.current.value = "";
  };

  const addImageReferences = (
    refs: Array<{
      src: string;
      name: string;
      kind?: StudioReferenceKind;
      mediaType?: StudioVideoMediaType;
      mediaId?: string;
    }>,
    options: { replace?: boolean; closeDialog?: boolean } = {},
  ) => {
    if (!referenceBounds.supportsReferenceImages) {
      toast.error(t("studio.modelNoReferenceImages"));
      return 0;
    }
    const base = options.replace ? [] : studioRefsRef.current;
    const seen = new Set(base.map((r) => r.mediaId ?? r.src));
    const next = [...base];
    let added = 0;
    const maxRefs = Math.max(referenceBounds.maxReferenceImages, 0);
    for (const ref of refs) {
      const refKey = ref.mediaId ?? ref.src;
      if (!ref.src || seen.has(refKey)) continue;
      if (next.length >= maxRefs) break;
      seen.add(refKey);
      const kind = ref.kind ?? mediaKindFromUrl(ref.src);
      next.push({
        id: newStudioId(),
        src: ref.src,
        name: ref.name,
        mediaId: ref.mediaId,
        kind,
        mediaType: ref.mediaType ?? referenceMediaTypeFor(undefined, kind, next.length),
      });
      added += 1;
    }
    if (added > 0) {
      studioRefsRef.current = next;
      setStudioRefs(next);
      setReferenceUrlInput("");
      if (options.closeDialog) setReferenceDialogOpen(false);
    }
    return added;
  };

  const removeImageReference = (id: string) => {
    const next = studioRefsRef.current.filter((ref) => ref.id !== id);
    studioRefsRef.current = next;
    setStudioRefs(next);
  };

  const addReferenceUrl = (value = referenceUrlInput) => {
    const src = normalizeReferenceInput(value);
    if (!value.trim()) return false;
    if (!src) {
      toast.error(t("studio.invalidReferenceUrl"));
      return false;
    }
    const kind = mediaKindFromUrl(src);
    const added = addImageReferences([{ src, name: t("studio.reference"), kind }]);
    return added > 0 || studioRefsRef.current.some((ref) => ref.src === src);
  };

  const addReferenceFiles = async (files: FileList | File[] | null | undefined) => {
    if (!referenceBounds.supportsReferenceImages) {
      toast.error(t("studio.modelNoReferenceImages"));
      return;
    }
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
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
    if (acceptedFiles.length !== selectedFiles.length)
      toast.error(t("studio.invalidReferenceFile"));
    const maxRefs = referenceBounds.maxReferenceImages;
    const remaining = maxRefs - studioRefsRef.current.length;
    if (remaining <= 0) {
      toast.error(t("studio.referenceImageTooMany", { count: maxRefs }));
      return;
    }
    const filesToUpload = acceptedFiles.slice(0, remaining);
    if (acceptedFiles.length > remaining)
      toast.error(t("studio.referenceImageTooMany", { count: maxRefs }));

    setReferenceUploading(true);
    try {
      const refs = await Promise.all(
        filesToUpload.map(async (file) => {
          if (file.size > STUDIO_REFERENCE_IMAGE_MAX_BYTES)
            throw new Error(t("studio.referenceImageTooLarge"));
          return {
            src: await referenceSrcFromBlob(file, file.name || t("studio.reference"), "image"),
            name: file.name || t("studio.reference"),
            kind: "image" as const,
          };
        }),
      );
      addImageReferences(refs);
    } catch (err) {
      toast.error(t("studio.referenceFileReadFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setReferenceUploading(false);
    }
  };

  // Apply inspiration / external handoff references into the image composer.
  useEffect(() => {
    const handoff = handoffId ? readStudioHandoff(handoffId) : null;
    const direct = sourceImage?.trim()
      ? { src: sourceImage.trim(), name: sourceImageName }
      : null;
    const incoming = handoff?.refs?.length
      ? handoff.refs
      : handoff?.src
        ? [{ src: handoff.src, name: handoff.name }]
        : direct
          ? [{ src: direct.src, name: direct.name }]
          : [];
    if (!incoming.length) return;

    const key = `${handoffId ?? "direct"}:${incoming.map((item) => item.src).join("|")}`;
    if (handoffAppliedRef.current === key) return;
    handoffAppliedRef.current = key;

    if (handoff?.prompt?.trim()) {
      setPrompt(handoff.prompt.trim());
    }

    const next = incoming.map((item, index) => {
      const kind = mediaKindFromUrl(item.src);
      return {
        id: newStudioId(),
        src: item.src,
        name: item.name || handoffReferenceName("image", t),
        kind,
        mediaType: referenceMediaTypeFor(undefined, kind, index),
      };
    });
    studioRefsRef.current = next;
    setStudioRefs(next);
  }, [handoffId, setPrompt, sourceImage, sourceImageName, t]);

  // ── Actions ─────────────────────────────────────────────────────
  const addResult = useCallback(
    (items: StudioResult[]) => {
      addResultFromHook(items);
    },
    [addResultFromHook],
  );
  const sessionVideos = dedupeSessionVideosForMerge(
    results.filter((item) => item.kind === "video"),
  );

  const download = async (item: StudioResult) => {
    try {
      const blob = await fetchMediaBlob(item);
      saveBlob(blob, `megick-${item.kind}-${item.id}.${mediaExtension(blob, item)}`);
    } catch (err) {
      toast.error(t("studio.downloadFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const downloadPsd = async (item: StudioResult) => {
    if (item.kind !== "image") return;
    try {
      const blob = await fetchMediaBlob(item);
      const psdBlob = await psdBlobFromImageBlob(blob);
      saveBlob(psdBlob, `megick-image-${item.id}.psd`);
    } catch (err) {
      toast.error(t("studio.downloadPsdFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const addAsReference = async (result: StudioResult) => {
    if (result.kind !== "image") {
      toast.error(t("studio.selectImageForVideo"));
      return;
    }
    if (!result.mediaId) {
      toast.error(t("studio.referenceMediaMissing"));
      return;
    }
    const added = addImageReferences([
      {
        src: result.src,
        name: t("studio.reference"),
        kind: "image",
        mediaType: "reference_image",
        mediaId: result.mediaId,
      },
    ]);
    if (added > 0) toast.success(t("studio.refAdded"));
  };

  const openEditor = (target: StudioEditTarget) => {
    if (embedded && onResultAction) {
      void onResultAction({
        sessionId: target.sessionId,
        sessionTitle: target.sessionTitle,
        messageId: target.msgId,
        result: target.result,
      });
      return;
    }
    if (target.result.kind !== "image") return;
    setEditTarget(target);
    setEditorOpen(true);
  };

  const openAiImageEdit = async (result: StudioResult, mode: AIImageEditModePublic) => {
    const target = await resolveResultTarget(result);
    if (!target) {
      toast.error(t("studio.openConversationFailed"));
      return;
    }
    setAiEditDialog({ mode, target });
  };

  const onSavedFromEditor = async (blob: Blob) => {
    if (!editTarget) return;
    setEditorSaving(true);
    try {
      const form = new FormData();
      form.append("sourceResultId", editTarget.result.id);
      form.append("file", blob, `megick-edit-${Date.now()}.${imageExtension(blob.type)}`);
      const saved = await api<StudioEditedResultPublic>(
        `/api/chats/${editTarget.sessionId}/messages/${editTarget.msgId}/edited-results`,
        { method: "POST", body: form },
      );
      const newResult: StudioResult = {
        ...editTarget.result,
        id: saved.id,
        src: saved.src,
        fallbackSrc: undefined,
        sourceSrc: undefined,
        kind: "image",
        prompt: saved.prompt || editTarget.result.prompt,
        messageId: editTarget.msgId,
        chatSessionId: editTarget.sessionId,
        createdAt: saved.createdAt ?? Date.now(),
      };
      // Update results and messages - direct state mutation via hook state
      setEditorOpen(false);
      setEditTarget(null);
      refreshStudioQueries();
    } catch (err) {
      toast.error(t("studio.versionSaveFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setEditorSaving(false);
    }
  };

  const submitAiImageEdit = async (input: {
    prompt: string;
    maskImage?: string;
    params: Record<string, unknown>;
  }) => {
    if (!aiEditDialog || aiEditSubmitting) return;
    const { mode, target } = aiEditDialog;
    setAiEditSubmitting(true);
    const sourceImage = target.result.sourceSrc ?? target.result.src;
    const modeLabel = localizedImageEditModeName(mode, t);
    const userText = input.prompt.trim() ? `${modeLabel}: ${input.prompt.trim()}` : modeLabel;
    const settingsForEdit = defaultStudioSettings({
      mode: "image",
      model: mode.code,
      style: "none",
    });
    try {
      await apiPost(`/api/chats/${target.sessionId}/messages`, {
        role: "user",
        content: userText,
        metadata: {
          kind: "image-edit",
          edit: true,
          editModeCode: mode.code,
          editModeName: modeLabel,
          sourceResultId: target.result.id,
          refs: [{ id: target.result.id, src: sourceImage, name: modeLabel, kind: "image" }],
        },
      });
      const created = await apiPost<{ jobId: string; job?: GenerationJobPublic }>(
        "/api/generation/jobs/image-edit",
        {
          modeCode: mode.code,
          prompt: input.prompt,
          sourceImage,
          maskImage: input.maskImage,
          params: input.params,
          chatSessionId: target.sessionId,
        },
      );
      await apiPost(`/api/chats/${target.sessionId}/messages`, {
        role: "assistant",
        content: userText,
        generationJobId: created.jobId,
        metadata: { status: "loading", settings: settingsForEdit },
      });
      await loadSessionDetail(target.sessionId);
      setAiEditDialog(null);
      refreshStudioQueries();
    } catch (err) {
      const notice = studioGenerationErrorNotice({
        rawMessage: err instanceof Error ? err.message : undefined,
        t,
      });
      toast.error(notice.title, { description: notice.description });
    } finally {
      setAiEditSubmitting(false);
    }
  };

  const generateVideoFromResult = async (
    result: StudioResult,
    videoInputMode: "I2V" | "R2V",
  ) => {
    if (!videoGenerationEnabled) {
      toast.error(t("studio.videoUnavailable"));
      return;
    }
    if (result.kind !== "image") {
      toast.error(t("studio.selectImageForVideo"));
      return;
    }
    if (embedded) return;

    const handoffReference = resolveVideoHandoffReference(result);
    const handoffId = writeStudioHandoff({
      src: handoffReference.src,
      name: t("studio.videoReference"),
      prompt: prompt.trim() || result.prompt,
      videoInputMode,
      pendingReferenceUpload: !handoffReference.ready,
      referenceResult: handoffReference.ready ? undefined : handoffReference.referenceResult,
    });
    const searchSourceImage =
      handoffReference.src.length <= 1024 ? handoffReference.src : undefined;
    navigate({
      to: studioPathForMode("video"),
      search: {
        newSession: true,
        prompt: prompt.trim() || result.prompt,
        videoInputMode,
        handoffId: handoffId ?? undefined,
        sourceImage: searchSourceImage,
        sourceImageName: t("studio.videoReference"),
      },
    });
  };

  const applyTemplate = useCallback(
    (template: PromptTemplatePublic, options: { replaceRoute?: boolean } = {}) => {
      const params = asPlainRecord(template.params);
      const templateSettings = asPlainRecord(params.settings);
      const nextSettings = defaultStudioSettings({
        ...settings,
        mode: "image",
        style: typeof templateSettings.style === "string" ? templateSettings.style : settings.style,
        ratio:
          typeof templateSettings.ratio === "string"
            ? templateSettings.ratio
            : typeof params.ratio === "string"
              ? params.ratio
              : settings.ratio,
        count: typeof templateSettings.count === "number" ? templateSettings.count : settings.count,
        seed: typeof templateSettings.seed === "number" ? templateSettings.seed : settings.seed,
        negative:
          typeof templateSettings.negative === "string"
            ? templateSettings.negative
            : settings.negative,
        model:
          template.modelCode ||
          (typeof templateSettings.model === "string" ? templateSettings.model : settings.model),
      });
      const nextPrompt = [
        template.textPrompt,
        template.materialPrompt
          ? t("templates.detail.materialPromptLine", { material: template.materialPrompt })
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const nextModel = models.find((m) => m.code === nextSettings.model) ?? null;
      const refLimit = referenceBoundsForModel("image", nextModel).maxReferenceImages;
      const refs = templateReferenceUrls(template, refLimit).map((src, index) => ({
        id: newStudioId(),
        src,
        name: template.referenceAssetKeys[index] ?? template.title,
        kind: mediaKindFromUrl(src),
      }));
      setSettings(nextSettings);
      setPrompt(nextPrompt);
      setStudioRefs(refs);
      studioRefsRef.current = refs;
      setTemplateOpen(false);
      void apiPost(`/api/templates/${template.id}/use`).catch(() => undefined);
    },
    [models, setPrompt, setSettings, settings, t],
  );

  useEffect(() => {
    if (!templateId || templateAppliedRef.current === templateId) return;
    let cancelled = false;
    apiGet<PromptTemplatePublic>(`/api/templates/${templateId}`)
      .then((template) => {
        if (!cancelled) {
          applyTemplate(template, { replaceRoute: true });
          templateAppliedRef.current = templateId;
        }
      })
      .catch((err) => {
        if (!cancelled)
          toast.error(t("templates.loadFailed"), {
            description: err instanceof Error ? err.message : undefined,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [applyTemplate, templateId, t]);

  const imageEditMenu = (
    result: StudioResult,
    variant: "compact" | "toolbar" = "compact",
  ) => {
    if (result.kind !== "image") return null;
    const modes = imageEditModesQ.data ?? [];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-onboarding-target="image-ai-edit"
            className={
              variant === "toolbar"
                ? "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-primary bg-transparent px-4 text-sm font-medium text-primary transition hover:bg-primary/10"
                : "inline-flex h-7 items-center justify-center gap-1 rounded-xl border border-primary px-2 text-xs font-medium text-primary transition hover:bg-primary/10"
            }
            title={t("studio.aiEdit")}
          >
            <MagiCoreIcon src={magiCoreIcons.pointsGradient} className="h-4 w-4" />
            {t("studio.aiEdit")}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem
            onClick={() =>
              void resolveResultTarget(result).then((target) => {
                if (target) openEditor(target);
                else toast.error(t("studio.openConversationFailed"));
              })
            }
          >
            <ManualEditModeIcon /> {t("studio.manualEdit")}
          </DropdownMenuItem>
          {modes.map((mode) => (
            <DropdownMenuItem key={mode.id} onClick={() => void openAiImageEdit(result, mode)}>
              <AiEditModeIcon mode={mode} />
              <span className="min-w-0 flex-1 truncate">{localizedImageEditModeName(mode, t)}</span>
              {mode.costCredits > 0 ? (
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {formatNumber(mode.costCredits)}
                </span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // ── Generate handler ────────────────────────────────────────────
  const onClearImageInputs = useCallback(() => {
    setPrompt("");
    studioRefsRef.current = [];
    setStudioRefs([]);
  }, [setPrompt]);

  const onGenerate = useCallback(() => {
    void handleImageGenerate({
      prompt,
      settings,
      refs: studioRefs,
      videoGenerationEnabled,
      onClearInputs: onClearImageInputs,
    });
  }, [
    handleImageGenerate,
    prompt,
    settings,
    studioRefs,
    videoGenerationEnabled,
    onClearImageInputs,
  ]);

  const retryGenerationJob = useCallback(
    (job: GenerationJobPublic) => {
      const patch = settingsPatchFromGenerationJob(job, "image");
      const nextSettings = defaultStudioSettings({
        ...settings,
        ...patch,
        mode: "image",
        videoInputMode: null,
      });
      const refs = refsFromGenerationJobParams(job, "image", handoffReferenceName("image", t)).map(
        (ref) => ({
          ...ref,
          mediaType: "reference_image" as const,
        }),
      );
      setPrompt(job.prompt);
      setSettings(nextSettings);
      studioRefsRef.current = refs;
      setStudioRefs(refs);
      setReferenceUrlInput("");
      toast.success(t("studio.promptReused"));
      window.requestAnimationFrame(() => promptTextareaRef.current?.focus());
    },
    [setPrompt, setSettings, settings, t],
  );

  // ── Auto-submit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!autoSubmit) return;
    if (!activeSessionId) return;
    if (!prompt.trim()) return;
    if (templateId && templateAppliedRef.current !== templateId) return;
    if ((handoffId || sourceImage) && studioRefs.length === 0) return;
    if (modelsLoading || modelsForMode.length === 0) return;
    const requestKey = [
      activeSessionId,
      "image",
      settings.style,
      settings.ratio,
      prompt.trim(),
      templateId ?? "",
      handoffId ?? "",
      sourceImage ?? "",
      sourceImageName ?? "",
    ].join("::");
    if (autoSubmitRequestedRef.current === requestKey) return;
    autoSubmitRequestedRef.current = requestKey;
    void onGenerate();
  }, [
    activeSessionId,
    autoSubmit,
    onGenerate,
    handoffId,
    modelsForMode.length,
    modelsLoading,
    prompt,
    settings.ratio,
    settings.style,
    sourceImage,
    sourceImageName,
    studioRefs.length,
    templateId,
  ]);

  // ── Update settings ─────────────────────────────────────────────
  const updateSettings = (patch: Partial<StudioSettings>) => {
    setSettings(
      defaultStudioSettings({ ...settings, ...patch, mode: "image", videoInputMode: null }),
    );
  };

  return (
    <div
      className={cn(
        "flex flex-1 overflow-hidden",
        stackedLayout ? "min-h-[calc(100dvh-5rem)]" : "h-full min-h-0",
      )}
    >
      <ResizablePanelGroup
        direction={stackedLayout ? "vertical" : "horizontal"}
        className={cn("flex-1 gap-3", stackedLayout ? "min-h-[1500px]" : "h-full min-h-0")}
      >
        <ResizablePanel
          defaultSize={stackedLayout ? 55 : 37}
          minSize={stackedLayout ? 45 : 28}
          maxSize={stackedLayout ? 75 : 50}
          className={cn("min-h-0", !stackedLayout && "min-w-[320px]")}
        >
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#1b1c21]">
            {/* Title bar — Figma 163:2144 */}
            <div className="group/title flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 pb-4 pt-6">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  {titleEditing ? (
                    <Input
                      ref={null}
                      value={titleDraft}
                      onChange={(e) => {
                        /* title editing via hook */
                      }}
                      onBlur={() => void saveTitleEdit()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveTitleEdit();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelTitleEdit();
                        }
                      }}
                      disabled={titleSaving}
                      aria-label={t("studio.sessionTitle")}
                      className="h-7 min-w-0 max-w-[18rem] flex-1 px-2 text-base"
                      maxLength={191}
                    />
                  ) : (
                    <button
                      type="button"
                      onDoubleClick={startTitleEdit}
                      className="min-w-0 truncate rounded-sm text-left text-base uppercase text-white outline-none transition hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                      title={sessionTitle}
                    >
                      {sessionTitle}
                    </button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={startTitleEdit}
                    disabled={sessionLoading || titleSaving}
                    className="size-7 shrink-0 text-muted-foreground opacity-0 transition group-hover/title:opacity-100 focus-visible:opacity-100"
                    title={t("studio.renameConversation")}
                    aria-label={t("studio.renameConversation")}
                  >
                    {titleSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Settings2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(true)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-xl text-xs text-[#8b8e94] transition hover:text-foreground"
                  title={t("studio.currentModel")}
                >
                  <MagiCoreIcon src={magiCoreIcons.composerModelMuted} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{currentModelLabel}</span>
                  {currentModel ? (
                    <span className="shrink-0">
                      · {modelCreditLabel(currentModel, t, formatNumber)}
                    </span>
                  ) : null}
                  {currentModelLocked ? (
                    <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                      <Lock className="h-3 w-3" />
                      {t("dashboard.advancedAccess")}
                    </Badge>
                  ) : currentModel?.accessLevel === "PAID" ? (
                    <Badge className="h-5 px-1.5 text-[10px]">
                      {t("dashboard.advancedAccess")}
                    </Badge>
                  ) : null}
                </button>
              </div>
              <button
                type="button"
                onClick={startNewSessionFromHook}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm text-white transition hover:border-primary/50"
              >
                <MagiCoreIcon src={magiCoreIcons.fileAdd} className="h-3.5 w-3.5" />
                {t("studio.new")}
              </button>
            </div>

            {/* Messages scroll area */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
              {sessionLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("studio.openingConversation")}
                </div>
              ) : messages.length === 0 ? (
                <EmptyState title={t("studio.empty.title")} detail={t("studio.empty.detail")} />
              ) : (
                <div className="flex min-w-0 flex-col gap-6">
                  {messages.map((message) => {
                    if (message.role === "user") {
                      const messageRefs = Array.isArray(message.metadata?.refs)
                        ? (message.metadata.refs as StudioReference[])
                        : [];
                      const editModeName =
                        typeof message.metadata?.editModeName === "string"
                          ? message.metadata.editModeName
                          : null;
                      const isEdit =
                        message.metadata?.kind === "image-edit" || message.metadata?.edit === true;
                      const trimmedText = message.text.replace(/\s+/g, " ").trim();
                      const promptIsLong = trimmedText.length > 150;
                      const promptExpandedInMsg = expandedMessageIds.has(message.id);
                      const displayText =
                        promptIsLong && !promptExpandedInMsg
                          ? trimmedText.slice(0, 150) + "..."
                          : trimmedText;
                      return (
                        <div key={message.id} className="flex min-w-0 justify-end">
                          <div className="flex w-[min(402px,100%)] min-w-0 flex-col items-end gap-3">
                            <div className="rounded-xl bg-[#26272c] p-3 text-xs leading-normal text-white">
                              <span className="[overflow-wrap:anywhere]">{displayText}</span>
                              {promptIsLong ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedMessageIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(message.id)) next.delete(message.id);
                                      else next.add(message.id);
                                      return next;
                                    })
                                  }
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#8b8e94] transition hover:text-white"
                                >
                                  {promptExpandedInMsg ? (
                                    <>
                                      <ChevronUp className="h-3 w-3" />
                                      {t("studio.promptCollapse")}
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3" />
                                      {t("studio.promptExpandMore")}
                                    </>
                                  )}
                                </button>
                              ) : null}
                            </div>
                            {messageRefs.length ? (
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {messageRefs.map((r) => (
                                  <img
                                    key={r.id}
                                    src={ossThumbnailUrl(r.src)}
                                    alt={r.name}
                                    className="h-12 w-12 rounded-md object-cover"
                                  />
                                ))}
                              </div>
                            ) : null}
                            <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 px-3 text-xs text-[#8b8e94]">
                              {isEdit ? (
                                editModeName ? (
                                  <span>{editModeName}</span>
                                ) : null
                              ) : (
                                <>
                                  <span className="max-w-full [overflow-wrap:anywhere]">
                                    {`${message.settings.model || t("studio.model")} · ${t(styleLabelKey(message.settings.style))} · ${message.settings.ratio} · x${formatNumber(message.settings.count)}`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const refs = messageRefs.map((r) => ({
                                        id: newStudioId(),
                                        src: r.src,
                                        name: r.name,
                                        mediaId: r.mediaId,
                                        kind: mediaKindFromUrl(r.src),
                                        mediaType: "reference_image" as const,
                                      }));
                                      setPrompt(message.text);
                                      studioRefsRef.current = refs;
                                      setStudioRefs(refs);
                                      reuseUserMessageDraft(message, messageRefs);
                                    }}
                                    className="inline-flex items-center gap-1 transition hover:text-foreground"
                                    title={t("studio.reusePrompt")}
                                  >
                                    <Repeat className="h-3 w-3" />
                                    {t("studio.reusePrompt")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleImageGenerate({
                                        prompt: message.text,
                                        settings: { ...message.settings, mode: "image" },
                                        refs: messageRefs.map((r) => ({
                                          id: newStudioId(),
                                          src: r.src,
                                          name: r.name,
                                          mediaId: r.mediaId,
                                          kind: mediaKindFromUrl(r.src),
                                          mediaType: "reference_image" as const,
                                        })),
                                        videoGenerationEnabled,
                                        onClearInputs: () => {},
                                      })
                                    }
                                    className="transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                                    title={t("studio.regenerate")}
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void copyToClipboard(message.text, t("studio.promptCopied"))
                                }
                                className="transition hover:text-foreground"
                                title={t("studio.copyPrompt")}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    // Assistant messages
                    const imageResultForRef =
                      message.results.find((r) => r.kind === "image" && r.id === selectedId) ??
                      message.results.find((r) => r.kind === "image") ??
                      null;
                    const errorNotice = message.error
                      ? studioGenerationErrorNotice({
                          rawMessage: message.error,
                          t,
                        })
                      : null;
                    return (
                      <div key={message.id} className="flex min-w-0 justify-start">
                        <div className="min-w-0 max-w-full space-y-3">
                          {message.status === "loading" ? (
                            <GenerationPlaceholderGrid settings={message.settings} compact />
                          ) : errorNotice ? (
                            <div
                              className={cn(
                                "rounded-lg border p-3 text-xs",
                                errorNotice.insufficientCredits
                                  ? "border-primary/20 bg-primary/10 text-foreground"
                                  : "border-destructive/20 bg-destructive/5 text-destructive",
                              )}
                            >
                              <p
                                className={cn(
                                  "font-medium",
                                  errorNotice.insufficientCredits
                                    ? "text-foreground"
                                    : "text-destructive",
                                )}
                              >
                                {errorNotice.message}
                              </p>
                              {errorNotice.description &&
                              (errorNotice.insufficientCredits || errorNotice.safetyBlocked) ? (
                                <p className="mt-1.5 text-[11px] text-muted-foreground">
                                  {errorNotice.description}
                                </p>
                              ) : null}
                            </div>
                          ) : message.results.length ? (
                            <div
                              className={cn(
                                "flex flex-wrap gap-3",
                                message.results.length === 1 ? "" : "gap-2",
                              )}
                            >
                              {message.results.map((result) => (
                                <button
                                  key={result.id}
                                  type="button"
                                  onClick={() => addResult([result])}
                                  onDoubleClick={() => {
                                    void addAsReference(result);
                                  }}
                                  className={cn(
                                    "group relative overflow-hidden rounded-xl bg-black text-left transition",
                                    message.results.length === 1
                                      ? "size-[188px]"
                                      : "aspect-square w-[140px]",
                                    selectedId === result.id
                                      ? "ring-2 ring-primary"
                                      : "hover:ring-1 hover:ring-primary/60",
                                  )}
                                  title={result.prompt}
                                >
                                  <img
                                    src={result.thumbnailSrc ?? ossThumbnailUrl(result.src)}
                                    alt={t("studio.generatedPreviewAlt")}
                                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                    loading="lazy"
                                    decoding="async"
                                    referrerPolicy="no-referrer"
                                  />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {t("studio.noPreviewAssets")}
                            </div>
                          )}
                          <div
                            className="flex flex-wrap items-center gap-3"
                            data-onboarding-target={
                              imageResultForRef ? "image-result-actions" : undefined
                            }
                          >
                            {message.status === "done" ? (
                              <>
                                {imageResultForRef ? (
                                  <>
                                    {imageEditMenu(imageResultForRef)}
                                    <button
                                      type="button"
                                      data-onboarding-target="image-use-as-reference"
                                      onClick={() => void addAsReference(imageResultForRef)}
                                      className="inline-flex h-7 items-center gap-1.5 text-xs text-[#8b8e94] transition hover:text-foreground"
                                      title={t("studio.asReferenceTitle")}
                                    >
                                      <MagiCoreIcon
                                        src={magiCoreIcons.composerReference}
                                        className="h-3 w-3"
                                      />
                                      {t("studio.asReference")}
                                    </button>
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyToClipboard(
                                      imageResultForRef?.src ?? message.text,
                                      imageResultForRef
                                        ? t("studio.imageLinkCopied")
                                        : t("studio.promptCopied"),
                                    )
                                  }
                                  className="inline-flex h-7 items-center gap-1.5 text-xs text-[#8b8e94] transition hover:text-foreground"
                                >
                                  <Copy className="h-3 w-3" />
                                  {t("common.copy")}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Composer — Figma 163:2404 */}
            <div className="flex shrink-0 flex-col gap-4 border-t border-border px-6 py-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Style popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-onboarding-target="image-style-selector"
                        className={magiCorePillClass}
                      >
                        <MagiCoreIcon
                          src={magiCoreIcons.composerStyleWhite}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="whitespace-nowrap">
                          {STYLE_PRESETS.find((s) => s.id === settings.style)
                            ? t(styleLabelKey(settings.style))
                            : t("studio.style")}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" sideOffset={8}>
                      <div className="grid grid-cols-2 gap-1.5">
                        {STYLE_PRESETS.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => updateSettings({ style: s.id })}
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs transition",
                              settings.style === s.id
                                ? "border-primary bg-primary/15 text-foreground"
                                : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {t(styleLabelKey(s.id))}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Ratio popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className={magiCorePillClass}>
                        <MagiCoreIcon
                          src={magiCoreIcons.composerRatioWhite}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        <span className="whitespace-nowrap">{settings.ratio}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" sideOffset={8}>
                      <div className="grid grid-cols-2 gap-2">
                        {RATIO_PRESETS.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => updateSettings({ ratio: r.id })}
                            className={cn(
                              "grid gap-1.5 rounded-md border p-2 text-left text-xs transition",
                              settings.ratio === r.id
                                ? "border-primary bg-primary/15 text-foreground"
                                : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <span className="flex h-14 items-center justify-center rounded bg-secondary/45">
                              <span
                                className={cn(
                                  "block max-h-10 max-w-16 rounded-sm border bg-background shadow-inner",
                                  settings.ratio === r.id
                                    ? "border-primary"
                                    : "border-muted-foreground/50",
                                )}
                                style={{
                                  aspectRatio: ratioParts(r.id).css,
                                  width: ratioParts(r.id).value >= 1 ? 56 : undefined,
                                  height: ratioParts(r.id).value < 1 ? 44 : undefined,
                                }}
                              />
                            </span>
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-medium">{r.id}</span>
                              <span className="text-[10px] text-muted-foreground">{r.size}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Advanced (model + seed + negative) */}
                  <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(magiCorePillClass, "max-w-[13rem]")}
                        title={currentModelLabel}
                      >
                        <MagiCoreIcon
                          src={magiCoreIcons.composerModelWhite}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        <span className="truncate">{currentModelLabel}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 space-y-3 p-3" align="start" sideOffset={8}>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("studio.negativePrompt")}
                        </p>
                        <Textarea
                          rows={2}
                          value={settings.negative}
                          onChange={(e) => updateSettings({ negative: e.target.value })}
                          placeholder={t("studio.negativePlaceholder")}
                          className="text-xs min-h-[60px]"
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <Hash className="mr-1 inline h-3 w-3" />
                          {t("studio.seed")}
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={settings.seed ?? ""}
                            onChange={(e) =>
                              updateSettings({
                                seed: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            placeholder={t("common.random")}
                            className="h-8 text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateSettings({ seed: Math.floor(Math.random() * 1e6) })
                            }
                            title={t("studio.randomizeSeed")}
                            className="h-8 w-8 p-0"
                          >
                            <Repeat className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <Layers className="mr-1 inline h-3 w-3" />
                          {t("studio.model")}
                        </p>
                        <div className="grid gap-1.5">
                          {modelsLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : modelsForMode.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("studio.noActiveModels")}
                            </span>
                          ) : (
                            modelsForMode.map((model) => {
                              const locked = !hasAdvancedAccess && model.accessLevel === "PAID";
                              return (
                                <button
                                  key={model.code}
                                  type="button"
                                  onClick={() => {
                                    if (locked) {
                                      toast.error(t("studio.advancedAccessRequired"), {
                                        description:
                                          "Open-source edition: ask an administrator to grant access or adjust credits.",
                                      });
                                      return;
                                    }
                                    updateSettings({ model: model.code });
                                  }}
                                  className={cn(
                                    "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition",
                                    settings.model === model.code
                                      ? "border-primary bg-primary/15 text-foreground"
                                      : locked
                                        ? "border-border bg-background/30 text-muted-foreground opacity-75"
                                        : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  <span className="min-w-0 truncate">
                                    {modelDisplayName(model, locale)}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                                    {model.accessLevel === "PAID" ? (
                                      <Badge
                                        variant={locked ? "secondary" : "default"}
                                        className="h-5 gap-1 px-1.5 text-[10px]"
                                      >
                                        {locked ? <Lock className="h-3 w-3" /> : null}
                                        {t("dashboard.advancedAccess")}
                                      </Badge>
                                    ) : null}
                                    {modelCreditLabel(model, t, formatNumber)}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Reference upload — always visible like Figma */}
                  <button
                    type="button"
                    data-onboarding-target="image-reference-upload"
                    onClick={() => {
                      if (!referenceBounds.supportsReferenceImages) {
                        toast.message(t("studio.modelNoReferenceImages"));
                        return;
                      }
                      setReferenceDialogOpen(true);
                    }}
                    title={t("studio.uploadReferenceImage")}
                    className={cn(
                      magiCorePillClass,
                      studioRefs.length ? "border-primary/70" : "",
                    )}
                  >
                    <MagiCoreIcon
                      src={magiCoreIcons.composerReference}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="whitespace-nowrap">{t("studio.reference")}</span>
                    {studioRefs.length ? (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                        {studioRefs.length}
                      </span>
                    ) : null}
                  </button>
                </div>

                {/* Reference thumbnails */}
                {studioRefs.length ? (
                  <div className="flex flex-wrap gap-2">
                    {studioRefs.map((r) => (
                      <div
                        key={r.id}
                        className="group relative h-12 w-12 overflow-hidden rounded-lg border border-border/70"
                        title={r.name}
                      >
                        <button
                          type="button"
                          className="h-full w-full bg-black text-left"
                          onClick={() =>
                            setReferencePreview({
                              id: r.id,
                              src: r.src,
                              kind: "image",
                              prompt: r.name,
                            })
                          }
                          aria-label={r.name}
                        >
                          <img
                            src={ossThumbnailUrl(r.src)}
                            alt={r.name}
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImageReference(r.id)}
                          className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-foreground"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Prompt input */}
                <div className="relative flex min-h-[124px] items-start gap-2 rounded-xl bg-white/5 py-2 pl-4 pr-2">
                  <Textarea
                    ref={promptTextareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => setPromptExpanded(true)}
                    onBlur={() => setPromptExpanded(false)}
                    rows={4}
                    placeholder={t("studio.composer.imagePlaceholder")}
                    className={cn(
                      "min-h-[108px] flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 py-0 text-sm leading-5 shadow-none placeholder:text-[#8b8e94] focus-visible:ring-0",
                      promptExpanded && "min-h-[200px]",
                    )}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        void onGenerate();
                      }
                    }}
                  />
                  <TooltipProvider delayDuration={120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("studio.promptExpand")}
                          title={t("studio.promptExpand")}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPromptExpanded(true);
                            window.requestAnimationFrame(() => {
                              promptTextareaRef.current?.focus();
                            });
                          }}
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:text-foreground"
                        >
                          <MagiCoreIcon src={magiCoreIcons.composerExpand} className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("studio.promptExpand")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Footer: Template Center + Generate */}
              <div className="flex h-10 items-center justify-between gap-3">
                <button
                  onClick={() => setTemplateOpen(true)}
                  type="button"
                  title={t("studio.templateCenter")}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl px-4 text-sm text-[#8b8e94] transition hover:text-foreground"
                >
                  <MagiCoreIcon src={magiCoreIcons.composerTemplate} className="h-4 w-4" />
                  <span>{t("studio.templateCenter")}</span>
                </button>
                <button
                  type="button"
                  data-onboarding-target="studio-generate-button"
                  onClick={() => void onGenerate()}
                  disabled={submitting || !prompt.trim()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[#0a0a0a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundImage:
                      "linear-gradient(97deg, #57d9fa 1.88%, #72aefc 82.03%, #9f66ff 109.58%, #ba4dfe 132.12%)",
                  }}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1">
                      <MagiCoreIcon src={magiCoreIcons.pointsBlack} className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium leading-none">
                        {formatNumber(currentModel?.costCredits ?? 1)}
                      </span>
                    </span>
                  )}
                  <span className="text-sm font-medium leading-none">
                    {submitting ? t("studio.generating") : t("studio.generate")}
                  </span>
                </button>
              </div>
            </div>
          </section>
        </ResizablePanel>

        <ResizableHandle withHandle className="w-3.5 bg-transparent after:w-px after:bg-border" />

        {/* Right panel: Preview + Job history */}
        <ResizablePanel
          defaultSize={stackedLayout ? 45 : 62}
          minSize={stackedLayout ? 25 : 32}
          className={cn("min-h-0", !stackedLayout && "min-w-[280px]")}
        >
          <section className="flex h-full min-h-0 min-w-0 flex-col rounded-2xl bg-[#1b1c21]">
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden pt-6"
              data-onboarding-target="image-results-fallback"
            >
              {sessionLoading ? (
                <div className="flex h-full w-full flex-1 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : selectedJobStatusPreview ? (
                <FailedJobPreview
                  job={selectedJobStatusPreview}
                  mode="image"
                  onRetry={() => retryGenerationJob(selectedJobStatusPreview)}
                />
              ) : selected ? (
                selected.kind === "video" ? (
                  <VideoPreviewPanel
                    result={selected}
                    onZoom={() => setZoomOpen(true)}
                    onDownload={() => download(selected)}
                    onEdit={() => undefined}
                    onOpenMergeVideos={() => setMediaCenterOpen(true)}
                    resultActionLabel={resultActionLabel}
                    onResultAction={
                      onResultAction && activeSessionId
                        ? () =>
                            void onResultAction({
                              sessionId: activeSessionId,
                              sessionTitle,
                              messageId:
                                messageForResult(selected)?.id ?? selected.messageId ?? selected.id,
                              result: selected,
                            })
                        : undefined
                    }
                  />
                ) : (
                  <ImagePreviewPanel
                    result={selected}
                    onZoom={() => setZoomOpen(true)}
                    onDownload={() => download(selected)}
                    onDownloadPsd={() => downloadPsd(selected)}
                    onEdit={() => {
                      void resolveResultTarget(selected).then((target) => {
                        if (target) openEditor(target);
                        else toast.error(t("studio.openConversationFailed"));
                      });
                    }}
                    onUseAsReference={() => void addAsReference(selected)}
                    editMenu={imageEditMenu(selected, "toolbar")}
                    onGenerateVideo={(videoInputMode) =>
                      void generateVideoFromResult(selected, videoInputMode)
                    }
                    videoGenerationEnabled={videoGenerationEnabled}
                    resultActionLabel={resultActionLabel}
                    onResultAction={
                      onResultAction && activeSessionId
                        ? () =>
                            void onResultAction({
                              sessionId: activeSessionId,
                              sessionTitle,
                              messageId:
                                messageForResult(selected)?.id ?? selected.messageId ?? selected.id,
                              result: selected,
                            })
                        : undefined
                    }
                  />
                )
              ) : (
                <div className="flex min-h-0 flex-1">
                  <EmptyPreview mode="image" />
                </div>
              )}
            </div>
            <StudioJobHistoryStrip
              jobs={studioJobs}
              loading={sessionLoading}
              refreshing={studioJobsRefreshing}
              activeJobId={selectedJobId ?? selected?.jobId ?? focusJobId}
              mode="image"
              onRefresh={refreshStudioJobs}
              onPreviewJob={previewJobFromHook}
              onRetry={retryGenerationJob}
            />
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Dialogs */}
      <StudioEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={t("studio.canvasEditor")}
        target={editTarget}
        saving={editorSaving}
        onSave={onSavedFromEditor}
      />
      <AiImageEditDialog
        state={aiEditDialog}
        submitting={aiEditSubmitting}
        onOpenChange={(open) => {
          if (!open) setAiEditDialog(null);
        }}
        onSubmit={submitAiImageEdit}
      />
      <ZoomPreviewDialog
        open={Boolean(referencePreview)}
        onOpenChange={(open) => {
          if (!open) setReferencePreview(null);
        }}
        result={referencePreview}
        title={referencePreview?.prompt ?? t("studio.viewLargeImage")}
        imageAlt={referencePreview?.prompt ?? t("studio.generatedPreviewAlt")}
      />
      <ZoomPreviewDialog
        open={zoomOpen}
        onOpenChange={setZoomOpen}
        result={selected}
        title={t("studio.viewLargeImage")}
        imageAlt={t("studio.generatedPreviewAlt")}
      />
      <ReferenceUploadDialog
        open={referenceDialogOpen}
        onOpenChange={setReferenceDialogOpen}
        title={t("studio.uploadReferenceImage")}
        refs={studioRefs}
        referenceFileInputRef={referenceFileInputRef}
        referenceUploading={referenceUploading}
        referenceUrlInput={referenceUrlInput}
        setReferenceUrlInput={setReferenceUrlInput}
        addReferenceFiles={addReferenceFiles}
        addReferenceUrl={addReferenceUrl}
        removeReference={removeImageReference}
        referenceLimit={referenceBounds.maxReferenceImages}
        labels={{
          dropzone: t("studio.referenceDropzone"),
          limit: t("studio.referenceLimit", { count: referenceBounds.maxReferenceImages }),
          placeholder: t("studio.referenceImageUrlPlaceholder"),
          cancel: t("common.cancel"),
          confirm: t("common.confirm"),
          remove: t("studio.remove"),
        }}
      />
      <TemplateCenterDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        title={t("studio.templateCenter")}
        search={templateSearch}
        onTemplateSelect={applyTemplate}
        onSearchChange={setTemplateSearch}
        initialVideoGenerationEnabled={videoGenerationEnabled}
      />
      <MediaCenterDialog
        open={mediaCenterOpen}
        onOpenChange={setMediaCenterOpen}
        title={t("studio.mediaCenter")}
        description={t("studio.mediaCenter.description")}
        videos={sessionVideos}
        fetchMediaBlob={fetchMediaBlob}
        objectUrlFromBlob={objectUrlFromBlob}
        appendMergedVideoToSession={appendMergedVideoToSession}
      />
    </div>
  );
}
