import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import type { AIModelPublic } from "@megick/api-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RATIO_PRESETS, STYLE_PRESETS } from "@/components/studio/presets";
import { apiGet } from "@/lib/api-client";
import { styleLabelKey, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function InspirationComposer() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(STYLE_PRESETS[0]?.id ?? "none");
  const [ratio, setRatio] = useState(RATIO_PRESETS[0]?.id ?? "1:1");
  const [modelCode, setModelCode] = useState<string | null>(null);

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

  const handleGenerate = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error(t("studio.composer.empty"), {
        description: t("studio.composer.emptyDesc"),
      });
      return;
    }
    void navigate({
      to: "/dashboard/studio/image",
      search: {
        prompt: trimmed,
        style,
        ratio,
        newSession: true,
        autoSubmit: true,
      },
    });
  };

  return (
    <section className="mx-auto w-full max-w-[1352px] space-y-4">
      <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-card sm:p-5">
        <div className="flex gap-3">
          <button
            type="button"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
            aria-label={t("inspiration.composer.addReference")}
            onClick={() =>
              toast.message(t("inspiration.composer.referenceSoon"), {
                description: t("inspiration.composer.referenceSoonDesc"),
              })
            }
          >
            <Plus className="h-5 w-5" />
          </button>
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
            className="min-h-[96px] flex-1 resize-none border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="h-9 rounded-full border border-border bg-background px-3 text-xs text-foreground"
              aria-label={t("studio.composer.stylePresets")}
            >
              {STYLE_PRESETS.slice(0, 8).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {t(styleLabelKey(preset.id))}
                </option>
              ))}
            </select>
            <select
              value={ratio}
              onChange={(event) => setRatio(event.target.value)}
              className="h-9 rounded-full border border-border bg-background px-3 text-xs text-foreground"
              aria-label={t("studio.composer.ratio")}
            >
              {RATIO_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.id}
                </option>
              ))}
            </select>
            {selectedModel ? (
              <select
                value={selectedModel.code}
                onChange={(event) => setModelCode(event.target.value)}
                className="h-9 max-w-[12rem] truncate rounded-full border border-border bg-background px-3 text-xs text-foreground"
                aria-label={t("common.model")}
              >
                {imageModels.map((model) => (
                  <option key={model.code} value={model.code}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={handleGenerate}
            className="h-10 shrink-0 gap-2 rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            {t("inspiration.composer.generate")}
          </Button>
        </div>
      </div>

      {imageModels.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {imageModels.map((model) => {
            const active = selectedModel?.code === model.code;
            return (
              <button
                key={model.code}
                type="button"
                onClick={() => setModelCode(model.code)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  active
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {model.displayName}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
