import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { InspirationBanners } from "@/components/inspiration/InspirationBanners";
import { InspirationComposer } from "@/components/inspiration/InspirationComposer";
import { MagiCoreIcon, magiCoreIcons } from "@/components/brand/MagiCoreIcon";
import { useI18n } from "@/lib/i18n";
import {
  TemplateCenterPage,
  type TemplateSearch,
} from "@/routes/dashboard.templates.index";

/** Figma MegiCoreAI node 63:44 — 灵感池 */
export function InspirationPage({ search }: { search: TemplateSearch }) {
  const { t } = useI18n();

  return (
    <div
      className="relative mx-auto flex w-full max-w-[1718px] flex-col pb-10 pt-2 sm:pt-4"
      data-figma-node="63:44"
    >
      {/* Figma button 77:2163 — Assets, top-right */}
      <div className="absolute right-0 top-0 z-10 sm:right-1 sm:top-1">
        <Link
          to="/dashboard/media-center"
          preload="intent"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#26272c] bg-[#1b1c21] px-4 text-sm text-white transition hover:bg-[#1e2025]"
        >
          <MagiCoreIcon src={magiCoreIcons.asset} className="h-3.5 w-3.5" />
          {t("studio.shell.assets")}
        </Link>
      </div>

      <div className="flex flex-col gap-8 sm:gap-[48px]">
        {/* Figma Frame 17 — wordmark + tagline + subtitle */}
        <header className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-4 pt-2 text-center sm:pt-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <img
              src="/brand/magicore/wordmark-figma.svg?v=1"
              alt="MagiCoreAI"
              width={170}
              height={36}
              className="h-9 w-[170px] object-contain"
              draggable={false}
            />
            <h1 className="text-xl font-medium tracking-[0.56px] text-white sm:text-[28px] sm:leading-none">
              {t("inspiration.hero.tagline")}
            </h1>
          </div>
          <p className="text-sm tracking-[0.32px] text-[#8b8e94] sm:text-base">
            {t("inspiration.hero.subtitle")}
          </p>
        </header>

        <InspirationComposer />
      </div>

      <div className="mt-8 sm:mt-[72px]">
        <InspirationBanners />
      </div>

      <section className="mt-8 space-y-3 sm:mt-10">
        <div className="flex justify-end lg:hidden">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-xl border border-[#26272c] bg-[#1b1c21] px-4 text-sm text-white"
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
          controlsVariant="inspiration"
          cardVariant="inspiration"
          publishSlot={
            <button
              type="button"
              className="hidden h-10 shrink-0 items-center rounded-xl border border-[#26272c] bg-[#1b1c21] px-4 text-sm text-white transition hover:bg-[#1e2025] lg:inline-flex"
              onClick={() =>
                toast.message(t("inspiration.publish.soon"), {
                  description: t("inspiration.publish.soonDesc"),
                })
              }
            >
              {t("inspiration.publish")}
            </button>
          }
          generateLabelKey="inspiration.makeSame"
          className="space-y-6"
          gridClassName="columns-1 gap-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5"
        />
      </section>
    </div>
  );
}
