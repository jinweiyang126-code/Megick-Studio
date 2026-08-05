import { InspirationBanners } from "@/components/inspiration/InspirationBanners";
import { InspirationComposer } from "@/components/inspiration/InspirationComposer";
import { useI18n } from "@/lib/i18n";
import {
  TemplateCenterPage,
  type TemplateSearch,
} from "@/routes/dashboard.templates.index";

/** Figma MegiCoreAI node 63:44 — 灵感池
 * Assets button lives in DashboardShell header (same chrome as image/video/edit).
 */
export function InspirationPage({ search }: { search: TemplateSearch }) {
  const { t } = useI18n();

  return (
    <div
      className="relative mx-auto flex w-full max-w-[1718px] flex-col pb-10 pt-2 sm:pt-4"
      data-figma-node="63:44"
    >
      <div className="flex flex-col gap-8 sm:gap-[48px]">
        {/* Figma Frame 17 / Frame 9 — wordmark + tagline on ONE row (gap 12), subtitle below */}
        <header className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-4 pt-2 text-center sm:pt-6">
          <div className="flex max-w-full flex-nowrap items-center justify-center gap-2 sm:gap-3">
            <img
              src="/brand/magicore/wordmark-figma.svg?v=1"
              alt="MagiCoreAI"
              width={170}
              height={36}
              className="h-7 w-auto shrink-0 object-contain sm:h-9 sm:w-[170px]"
              draggable={false}
            />
            <h1 className="whitespace-nowrap text-base font-medium tracking-[0.56px] text-white sm:text-[28px] sm:leading-none">
              {t("inspiration.hero.tagline")}
            </h1>
          </div>
          <p className="max-w-[440px] text-sm tracking-[0.32px] text-[#8b8e94] sm:text-base">
            {t("inspiration.hero.subtitle")}
          </p>
        </header>

        <InspirationComposer />
      </div>

      <div className="mt-8 sm:mt-[72px]">
        <InspirationBanners />
      </div>

      <section className="mt-8 space-y-3 sm:mt-10">
        <TemplateCenterPage
          search={search}
          basePath="/dashboard/inspiration"
          showSummary={false}
          controlsVariant="inspiration"
          cardVariant="inspiration"
          generateLabelKey="inspiration.makeSame"
          className="space-y-6"
          gridClassName="columns-1 gap-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5"
        />
      </section>
    </div>
  );
}
