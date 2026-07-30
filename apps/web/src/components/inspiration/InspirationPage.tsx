import { toast } from "sonner";
import { InspirationBanners } from "@/components/inspiration/InspirationBanners";
import { InspirationComposer } from "@/components/inspiration/InspirationComposer";
import { useI18n } from "@/lib/i18n";
import {
  TemplateCenterPage,
  type TemplateSearch,
} from "@/routes/dashboard.templates.index";

export function InspirationPage({ search }: { search: TemplateSearch }) {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-[1718px] flex-col gap-8 pb-10 pt-2 sm:pt-4">
      <header className="mx-auto max-w-xl text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            MagiCoreAI
          </p>
          <p className="text-lg text-foreground/90 sm:text-xl">{t("inspiration.hero.tagline")}</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("inspiration.hero.subtitle")}</p>
      </header>

      <InspirationComposer />
      <InspirationBanners />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("inspiration.discover.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("inspiration.discover.subtitle")}</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            onClick={() =>
              toast.message(t("inspiration.publish.soon"), {
                description: t("inspiration.publish.soonDesc"),
              })
            }
          >
            {t("inspiration.publish")}
          </button>
        </div>

        <TemplateCenterPage
          search={search}
          basePath="/dashboard/inspiration"
          showSummary={false}
          generateLabelKey="inspiration.makeSame"
          className="space-y-4"
          gridClassName="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5"
        />
      </section>
    </div>
  );
}
