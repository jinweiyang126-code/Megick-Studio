import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Crop, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StudioResult } from "@/routes/-dashboard-types";
import { playableVideoSrcCandidates } from "./utils";

function mediaRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function waitAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/** Push the current canvas bitmap into captureStream(0) recordings. */
function requestCapturedFrame(stream: MediaStream) {
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void;
  };
  track?.requestFrame?.();
}

function waitForVideoMetadata(video: HTMLVideoElement, timeoutMs = 60_000) {
  if (video.readyState >= 1) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video metadata failed to load"));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video metadata failed to load"));
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

/** Ensure MediaRecorder / <video> get a decodable MIME; empty/octet-stream blobs often fail metadata. */
async function asPlayableVideoBlob(blob: Blob) {
  if (blob.size < 32) {
    throw new Error("Video download is empty or incomplete");
  }
  const declared = (blob.type || "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared.startsWith("video/")) return blob;

  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ascii = String.fromCharCode(...header);
  if (ascii.includes("ftyp")) {
    return new Blob([blob], { type: "video/mp4" });
  }
  if (
    header.length >= 4 &&
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3
  ) {
    return new Blob([blob], { type: "video/webm" });
  }
  // Prefer mp4 for generation outputs when sniffing is inconclusive.
  return new Blob([blob], { type: declared || "video/mp4" });
}

function bindVideoSource(video: HTMLVideoElement, src: string) {
  // Do not set crossOrigin: Megick OSS signed URLs lack CORS. Media elements can still
  // play after 302; canvas.captureStream recording does not need pixel readback.
  // crossOrigin=anonymous was breaking merge loads and forcing slow full-file fetch.
  video.removeAttribute("crossorigin");
  video.preload = "auto";
  video.playsInline = true;
  video.src = src;
}

/** Detach media before revokeObjectURL — otherwise Chromium spams ERR_FILE_NOT_FOUND. */
function releaseVideoElement(video: HTMLVideoElement) {
  try {
    video.pause();
  } catch {
    // ignore
  }
  video.removeAttribute("src");
  video.removeAttribute("srcObject");
  while (video.firstChild) video.removeChild(video.firstChild);
  try {
    video.load();
  } catch {
    // ignore
  }
}

function releaseObjectUrls(urls: string[]) {
  for (const url of urls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  urls.length = 0;
}

function waitForVideoSeek(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video seek failed"));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.0s";
  return `${seconds.toFixed(1)}s`;
}

async function exportEditedVideo(input: {
  src: string;
  trimStart: number;
  trimEnd: number;
  cropX: number;
  cropY: number;
  cropScale: number;
  speed: number;
  muted: boolean;
}) {
  const video = document.createElement("video");
  video.muted = input.muted;
  bindVideoSource(video, input.src);
  await waitForVideoMetadata(video);

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  const trimStart = Math.max(0, Math.min(input.trimStart, duration));
  const trimEnd = Math.max(
    trimStart + 0.1,
    Math.min(input.trimEnd || duration, duration || input.trimEnd),
  );
  const sourceW = Math.max(video.videoWidth || 1280, 1);
  const sourceH = Math.max(video.videoHeight || 720, 1);
  const cropScale = Math.max(1, Math.min(input.cropScale, 3));
  const cropW = Math.max(1, sourceW / cropScale);
  const cropH = Math.max(1, sourceH / cropScale);
  const sx = Math.max(0, Math.min(sourceW - cropW, (sourceW - cropW) * (input.cropX / 100)));
  const sy = Math.max(0, Math.min(sourceH - cropH, (sourceH - cropH) * (input.cropY / 100)));
  const exportScale = Math.min(1, 1920 / Math.max(cropW, cropH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropW * exportScale));
  canvas.height = Math.max(1, Math.round(cropH * exportScale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable");
  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("Browser video export APIs are unavailable");
  }

  const stream = canvas.captureStream(30);
  if (!input.muted) {
    const captureStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream })
      .captureStream;
    const audioStream = captureStream?.call(video);
    audioStream?.getAudioTracks().forEach((track) => stream.addTrack(track));
  }

  const chunks: Blob[] = [];
  const mimeType = mediaRecorderMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Video recording failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
  });

  if (Math.abs(video.currentTime - trimStart) > 0.01) {
    const seeked = waitForVideoSeek(video);
    video.currentTime = trimStart;
    await seeked;
  }
  video.playbackRate = Math.max(0.25, Math.min(input.speed, 2));

  let frameId = 0;
  const stop = () => {
    if (frameId) cancelAnimationFrame(frameId);
    video.pause();
    stream.getTracks().forEach((track) => track.stop());
    if (recorder.state !== "inactive") recorder.stop();
  };
  const draw = () => {
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
    if (video.currentTime >= trimEnd || video.ended) {
      stop();
      return;
    }
    frameId = requestAnimationFrame(draw);
  };

  recorder.start(250);
  await video.play();
  draw();
  return stopped;
}

export async function exportMergedVideo(
  videos: StudioResult[],
  fetchMediaBlob: (item: StudioResult) => Promise<Blob>,
  objectUrlFromBlob: (blob: Blob) => string,
) {
  if (videos.length < 2) throw new Error("Select at least two videos");
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Browser video export APIs are unavailable");
  }
  const objectUrls: string[] = [];
  const videoElements: HTMLVideoElement[] = [];
  const cleanupMedia = () => {
    for (const el of videoElements) releaseVideoElement(el);
    videoElements.length = 0;
    releaseObjectUrls(objectUrls);
  };

  /** Prefer same-origin streaming proxy. Never use 302→OSS for canvas merge. */
  const bindPlayableSource = async (video: HTMLVideoElement, item: StudioResult) => {
    const candidates = playableVideoSrcCandidates(item);
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        bindVideoSource(video, candidate);
        await waitForVideoMetadata(video, 90_000);
        if ((video.videoWidth || 0) < 2 && (video.videoHeight || 0) < 2) {
          throw new Error("Video has no visible frames");
        }
        return candidate;
      } catch (err) {
        lastError = err;
        releaseVideoElement(video);
      }
    }
    try {
      const raw = await fetchMediaBlob(item);
      const blob = await asPlayableVideoBlob(raw);
      const url = objectUrlFromBlob(blob);
      objectUrls.push(url);
      bindVideoSource(video, url);
      await waitForVideoMetadata(video, 30_000);
      return url;
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : lastError instanceof Error
            ? lastError.message
            : "Unable to download media";
      throw new Error(
        `Unable to load video for merge (${item.id}): ${detail}`,
      );
    }
  };

  const first = document.createElement("video");
  first.muted = true;
  videoElements.push(first);
  const firstSrc = await bindPlayableSource(first, videos[0]);

  const sourceW = Math.max(first.videoWidth || 1280, 1);
  const sourceH = Math.max(first.videoHeight || 720, 1);
  const exportScale = Math.min(1, 1920 / Math.max(sourceW, sourceH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceW * exportScale));
  canvas.height = Math.max(1, Math.round(sourceH * exportScale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable");
  if (!canvas.captureStream) {
    throw new Error("Browser video export APIs are unavailable");
  }

  // frameRate 0: only emit a frame when we call requestFrame after a real draw —
  // loading the next clip does not inject black / frozen empty time into the recording.
  let stream = canvas.captureStream(0);
  let manualFrames = typeof (
    stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }
  )?.requestFrame === "function";
  if (!manualFrames) {
    stream.getTracks().forEach((track) => track.stop());
    stream = canvas.captureStream(30);
  }

  const chunks: Blob[] = [];
  const mimeType = mediaRecorderMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const canPauseRecorder = typeof recorder.pause === "function" && typeof recorder.resume === "function";
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Video recording failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
  });

  const drawVideo = (video: HTMLVideoElement) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const videoW = Math.max(video.videoWidth || sourceW, 1);
    const videoH = Math.max(video.videoHeight || sourceH, 1);
    const scale = Math.min(canvas.width / videoW, canvas.height / videoH);
    const drawW = videoW * scale;
    const drawH = videoH * scale;
    ctx.drawImage(video, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
    if (manualFrames) requestCapturedFrame(stream);
  };

  const pauseRecording = () => {
    if (canPauseRecorder && recorder.state === "recording") {
      try {
        recorder.pause();
      } catch {
        // ignore
      }
    }
  };
  const resumeRecording = () => {
    if (canPauseRecorder && recorder.state === "paused") {
      try {
        recorder.resume();
      } catch {
        // ignore
      }
    }
  };

  /** Play one clip into the canvas; ends only after the last frame has been painted. */
  const recordClip = async (video: HTMLVideoElement) => {
    if (Math.abs(video.currentTime) > 0.01) {
      const seeked = waitForVideoSeek(video);
      video.currentTime = 0;
      await seeked;
    } else {
      video.currentTime = 0;
    }

    let frameId = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        let finishing = false;
        const finish = async () => {
          if (finishing) return;
          finishing = true;
          if (frameId) cancelAnimationFrame(frameId);
          frameId = 0;
          // Paint the terminal frame, then wait one display tick so captureStream sees it.
          drawVideo(video);
          await waitAnimationFrame();
          drawVideo(video);
          resolve();
        };
        const draw = () => {
          drawVideo(video);
          const duration = video.duration || 0;
          const atEnd =
            video.ended || (duration > 0 && video.currentTime >= duration - 1 / 60);
          if (atEnd) {
            void finish().catch(reject);
            return;
          }
          frameId = requestAnimationFrame(draw);
        };
        video.addEventListener("error", () => reject(new Error("Video playback failed")), {
          once: true,
        });
        void video
          .play()
          .then(() => {
            draw();
          })
          .catch(reject);
      });
    } finally {
      if (frameId) cancelAnimationFrame(frameId);
      video.pause();
    }
  };

  recorder.start(250);
  try {
    // Prefetch clip i+1 while recording clip i so the recorder can stay paused
    // (no empty frames) instead of sleeping between segments.
    let prefetch: Promise<HTMLVideoElement> | null = null;
    const prepareClip = async (item: StudioResult, index: number) => {
      const video = document.createElement("video");
      video.muted = true;
      videoElements.push(video);
      if (index === 0) {
        bindVideoSource(video, firstSrc);
        await waitForVideoMetadata(video, 60_000);
      } else {
        await bindPlayableSource(video, item);
      }
      return video;
    };

    for (let index = 0; index < videos.length; index += 1) {
      const video =
        index === 0
          ? await prepareClip(videos[index], index)
          : await (prefetch ?? prepareClip(videos[index], index));
      prefetch = null;

      if (index + 1 < videos.length) {
        prefetch = prepareClip(videos[index + 1], index + 1);
      }

      resumeRecording();
      await recordClip(video);
      // Stop emitting frames while the next source finishes loading.
      pauseRecording();
    }
  } catch (err) {
    stream.getTracks().forEach((track) => track.stop());
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    cleanupMedia();
    throw err;
  }

  stream.getTracks().forEach((track) => track.stop());
  if (recorder.state !== "inactive") recorder.stop();
  const merged = await stopped;
  cleanupMedia();
  return merged;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SessionVideoMediaCenter({
  videos,
  onMerge,
  onClose,
}: {
  videos: StudioResult[];
  onMerge: (videos: StudioResult[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(videos.map((video) => video.id)),
  );
  const [merging, setMerging] = useState(false);
  const selectedVideos = videos.filter((video) => selectedIds.has(video.id));
  const allSelected = videos.length > 0 && selectedIds.size === videos.length;

  useEffect(() => {
    setSelectedIds((current) => {
      const available = new Set(videos.map((video) => video.id));
      const next = new Set([...current].filter((id) => available.has(id)));
      if (next.size === 0 && videos.length > 0) {
        videos.forEach((video) => next.add(video.id));
      }
      return next;
    });
  }, [videos]);

  const toggleOne = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const runMerge = async () => {
    if (selectedVideos.length < 2) {
      toast.error(t("studio.mergeVideos.needTwo"));
      return;
    }
    setMerging(true);
    try {
      await onMerge(selectedVideos);
      toast.success(t("studio.mergeVideos.success", { count: selectedVideos.length }));
      onClose();
    } catch (err) {
      toast.error(t("studio.mergeVideos.failed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setMerging(false);
    }
  };

  if (videos.length === 0) {
    return (
      <div className="flex min-h-52 items-center justify-center rounded-lg border border-border/70 bg-secondary/20 text-sm text-muted-foreground">
        {t("studio.mediaCenter.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => {
              setSelectedIds(checked ? new Set(videos.map((video) => video.id)) : new Set());
            }}
          />
          {t("common.selectAll")}
        </label>
        <span className="text-xs text-muted-foreground">
          {t("studio.mediaCenter.selected", {
            selected: selectedVideos.length,
            total: videos.length,
          })}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video, index) => {
          const checked = selectedIds.has(video.id);
          return (
            <div
              key={video.id}
              className={cn(
                "group overflow-hidden rounded-lg border bg-card transition",
                checked ? "border-primary shadow-glow" : "border-border/70 hover:border-primary/70",
              )}
            >
              <div className="relative aspect-video bg-black">
                <video
                  src={video.src}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] text-white">
                  #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => toggleOne(video.id)}
                  className={cn(
                    "absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-background/90 text-muted-foreground shadow-sm transition hover:text-foreground",
                    checked
                      ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                      : "",
                  )}
                  aria-pressed={checked}
                  aria-label={checked ? t("studio.unselectMedia") : t("studio.selectMedia")}
                >
                  {checked ? <Check className="h-4 w-4" /> : null}
                </button>
              </div>
              <div className="space-y-1 p-2">
                <button
                  type="button"
                  onClick={() => toggleOne(video.id)}
                  className="line-clamp-2 w-full rounded-sm text-left text-xs text-foreground outline-none transition hover:text-primary focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {video.prompt}
                </button>
                <p className="text-[10px] text-muted-foreground">
                  {video.createdAt ? new Date(video.createdAt).toLocaleString() : t("common.video")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={merging}>
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          className="bg-gradient-primary shadow-glow hover:opacity-90"
          disabled={merging || selectedVideos.length < 2}
          onClick={() => void runMerge()}
        >
          {merging ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Film className="mr-1.5 h-3.5 w-3.5" />
          )}
          {merging ? t("studio.mergeVideos.merging") : t("studio.mergeVideos.create")}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function VideoEditor({ src, prompt }: { src: string; prompt: string }) {
  const { t } = useI18n();
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropScale, setCropScale] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(true);
  const [exporting, setExporting] = useState(false);
  const durationReady = duration > 0;
  const effectiveEnd = trimEnd || duration;
  const safeStart = Math.min(trimStart, Math.max(0, effectiveEnd - 0.1));
  const safeEnd = Math.max(safeStart + 0.1, Math.min(effectiveEnd, duration || effectiveEnd));

  useEffect(() => {
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setCropX(50);
    setCropY(50);
    setCropScale(1);
    setSpeed(1);
    setMuted(true);
  }, [src]);

  const previewCropStyle = {
    transform: `scale(${cropScale}) translate(${(50 - cropX) / cropScale}%, ${(50 - cropY) / cropScale}%)`,
  };

  const seekPreview = (video: HTMLVideoElement | null, nextTime: number) => {
    if (!video || !durationReady) return;
    video.currentTime = Math.max(0, Math.min(nextTime, duration));
  };

  const runExport = async () => {
    if (!durationReady) {
      toast.error(t("studio.videoEditor.durationUnavailable"));
      return;
    }
    setExporting(true);
    try {
      const blob = await exportEditedVideo({
        src,
        trimStart: safeStart,
        trimEnd: safeEnd,
        cropX,
        cropY,
        cropScale,
        speed,
        muted,
      });
      saveBlob(blob, `megick-video-edit-${Date.now()}.webm`);
    } catch (err) {
      toast.error(t("studio.videoEditor.exportFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("studio.videoEditor.description")}</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div className="space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            <video
              src={src}
              controls
              muted={muted}
              onLoadedMetadata={(event) => {
                const nextDuration = Number.isFinite(event.currentTarget.duration)
                  ? event.currentTarget.duration
                  : 0;
                setDuration(nextDuration);
                setTrimEnd(nextDuration);
              }}
              className="h-full w-full object-cover transition-transform duration-200"
              style={previewCropStyle}
            />
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{prompt}</p>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-background/60 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span>{t("studio.videoEditor.trimStart")}</span>
              <span>{formatSeconds(safeStart)}</span>
            </div>
            <Slider
              value={[safeStart]}
              min={0}
              max={durationReady ? Math.max(duration - 0.1, 0.1) : 1}
              step={0.1}
              disabled={!durationReady}
              onValueChange={(value) => {
                const next = value[0] ?? 0;
                setTrimStart(Math.min(next, Math.max(0, safeEnd - 0.1)));
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span>{t("studio.videoEditor.trimEnd")}</span>
              <span>{formatSeconds(safeEnd)}</span>
            </div>
            <Slider
              value={[safeEnd]}
              min={durationReady ? Math.min(safeStart + 0.1, duration) : 0}
              max={durationReady ? duration : 1}
              step={0.1}
              disabled={!durationReady}
              onValueChange={(value) => {
                const next = value[0] ?? duration;
                setTrimEnd(Math.max(next, safeStart + 0.1));
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <VideoSlider
              label={t("studio.videoEditor.cropX")}
              value={cropX}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={setCropX}
            />
            <VideoSlider
              label={t("studio.videoEditor.cropY")}
              value={cropY}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={setCropY}
            />
          </div>
          <VideoSlider
            label={t("studio.videoEditor.cropScale")}
            value={cropScale}
            min={1}
            max={3}
            step={0.05}
            suffix="x"
            onChange={setCropScale}
          />
          <VideoSlider
            label={t("studio.videoEditor.speed")}
            value={speed}
            min={0.25}
            max={2}
            step={0.25}
            suffix="x"
            onChange={setSpeed}
          />
          <label className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
            <span>{t("studio.videoEditor.mute")}</span>
            <input
              type="checkbox"
              checked={muted}
              onChange={(event) => setMuted(event.target.checked)}
            />
          </label>
          <Button
            type="button"
            className="w-full bg-gradient-primary shadow-glow hover:opacity-90"
            disabled={exporting || !durationReady}
            onClick={() => void runExport()}
          >
            {exporting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t("studio.videoEditor.exporting")}
              </>
            ) : (
              <>
                <Crop className="mr-1.5 h-3.5 w-3.5" />
                {t("studio.videoEditor.export")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VideoSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium">
        <span>{label}</span>
        <span>
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
      />
    </div>
  );
}
