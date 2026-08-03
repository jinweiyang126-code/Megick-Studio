import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { MagiCoreBgBottom } from "@/components/MagiCoreBgBottom";
import { MagiCoreBgTop } from "@/components/MagiCoreBgTop";
import { MagiCoreImgTopLeft } from "@/components/MagiCoreImgTopLeft";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { UserMenu } from "@/components/auth/UserMenu";
import { useLoginDialog } from "@/components/auth/LoginDialogContext";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const ASSET = "/brand/magicore/home";
const LOGO_MARK = "/brand/magicore/rail-mark.png?v=4";
const DEFAULT_START = "/dashboard/inspiration" as const;

/** Figma Free Start / Start Now gradient */
const CTA_GRADIENT =
  "linear-gradient(105deg, #57d9fa 0%, #72aefc 66%, #9f66ff 100%, #ba4dfe 121%)";

const NAV_LINKS = [
  { key: "home.mc.nav.inspiration" as const, to: "/dashboard/inspiration" as const },
  { key: "home.mc.nav.image" as const, to: "/dashboard/studio/image" as const },
  { key: "home.mc.nav.video" as const, to: "/dashboard/studio/video" as const },
  { key: "home.mc.nav.edit" as const, to: "/dashboard/video-editor" as const },
];

const FEATURES = [
  { key: "image" as const, icon: `${ASSET}/feature-image.svg?v=1` },
  { key: "video" as const, icon: `${ASSET}/feature-video.svg?v=1` },
  { key: "fast" as const, icon: `${ASSET}/feature-fast.svg?v=1` },
  { key: "styles" as const, icon: `${ASSET}/feature-styles.svg?v=1` },
  { key: "license" as const, icon: `${ASSET}/feature-license.svg?v=1` },
  { key: "api" as const, icon: `${ASSET}/feature-api.svg?v=1` },
];

const FOOTER_COLS: { title: TranslationKey; links: TranslationKey[] }[] = [
  {
    title: "home.mc.footer.aiTools",
    links: [
      "home.mc.footer.aiTools.t2i",
      "home.mc.footer.aiTools.i2i",
      "home.mc.footer.aiTools.ref",
      "home.mc.footer.aiTools.edit",
    ],
  },
  {
    title: "home.mc.footer.imageModel",
    links: [
      "home.mc.footer.imageModel.gpt",
      "home.mc.footer.imageModel.seedream",
      "home.mc.footer.imageModel.nano",
      "home.mc.footer.imageModel.kling",
      "home.mc.footer.imageModel.wan",
    ],
  },
  {
    title: "home.mc.footer.videoModel",
    links: [
      "home.mc.footer.videoModel.seedance",
      "home.mc.footer.videoModel.happy",
      "home.mc.footer.videoModel.wan",
    ],
  },
  {
    title: "home.mc.footer.legal",
    links: ["home.mc.footer.legal.terms", "home.mc.footer.legal.privacy"],
  },
];

function GradientCta({
  children,
  className = "",
  onClick,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{ backgroundImage: CTA_GRADIENT }}
      className={`inline-flex h-[44px] items-center justify-center gap-2 rounded-full px-4 text-[16px] font-medium text-[#0a0a0a] transition-transform duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${className}`}
    >
      {children}
    </button>
  );
}

function MagiCoreHomeNav({ onStart }: { onStart: () => void }) {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const { openLogin } = useLoginDialog();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const goOrLogin = (to: (typeof NAV_LINKS)[number]["to"]) => {
    setMobileOpen(false);
    if (user) {
      void navigate({ to });
      return;
    }
    openLogin({ mode: "signin", redirectTo: to });
  };

  return (
    <>
      {/* Figma 238:3247 navbar — absolute overlay, transparent (no solid plate) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-50 w-full">
        <div className="pointer-events-auto mx-auto flex max-w-[1920px] items-center justify-between gap-4 px-5 py-6 sm:px-8 sm:py-8 lg:px-12 xl:px-20">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="MagiCoreAI">
            <img src={LOGO_MARK} alt="" className="h-7 w-auto select-none" draggable={false} />
            <span className="text-[17px] font-semibold tracking-tight text-white">MagiCoreAI</span>
          </Link>

          <nav className="hidden items-center gap-16 lg:flex">
            {NAV_LINKS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => goOrLogin(item.to)}
                className="text-[16px] text-white transition-colors hover:text-white/80"
              >
                {t(item.key)}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-8 lg:flex">
            <LanguageSwitcher
              variant="header"
              iconOnly
              className="border-transparent bg-transparent text-white/85 hover:bg-white/10 hover:text-white"
            />
            {user ? (
              <UserMenu
                user={user}
                signOut={signOut}
                showBadge={false}
                className="max-w-48 px-2 py-1.5 text-white/80 transition-opacity hover:opacity-80"
                align="end"
              />
            ) : (
              <button
                type="button"
                onClick={() => openLogin({ mode: "signin", redirectTo: DEFAULT_START })}
                className="flex h-[44px] items-center justify-center rounded-full border border-[#8b8e94] px-4 text-[16px] text-white transition-colors hover:border-white/70"
              >
                {t("home.mc.nav.login")}
              </button>
            )}
            <GradientCta onClick={onStart}>{t("home.mc.cta.freeStart")}</GradientCta>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher
              variant="header"
              iconOnly
              className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10 hover:text-white"
            />
            <button
              type="button"
              aria-label={t("home.glaze.menu")}
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label={t("common.close")}
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(320px,88vw)] flex-col gap-6 bg-[#0a0a0c] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">MagiCoreAI</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-2 text-white/70 hover:bg-white/10"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => goOrLogin(item.to)}
                  className="rounded-xl px-3 py-2.5 text-left text-[15px] text-white/85 hover:bg-white/5"
                >
                  {t(item.key)}
                </button>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-3">
              {!user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openLogin({ mode: "signin", redirectTo: DEFAULT_START });
                  }}
                  className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white"
                >
                  {t("home.mc.nav.login")}
                </button>
              ) : null}
              <GradientCta
                onClick={() => {
                  setMobileOpen(false);
                  onStart();
                }}
              >
                {t("home.mc.cta.freeStart")}
              </GradientCta>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function MagiCoreHomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { openLogin } = useLoginDialog();
  const navigate = useNavigate();

  const startCreating = (path: string = DEFAULT_START) => {
    if (user) {
      void navigate({ to: path });
      return;
    }
    openLogin({ mode: "signin", redirectTo: path });
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#0a0a0a] text-white antialiased">
      <MagiCoreHomeNav onStart={() => startCreating()} />

      {/* Hero — Figma homepage: bg-top (0,0,1920×900/1080); navbar overlays top */}
      <section className="relative isolate overflow-hidden bg-[#0a0a0a]">
        <div className="relative mx-auto w-full max-w-[1920px]">
          {/* Aspect matches Figma bg-top master 1920×1080; homepage instance clips to ~900 */}
          <div className="relative w-full" style={{ aspectRatio: "1920 / 1080" }}>
            <MagiCoreBgTop />
            <MagiCoreImgTopLeft />

            {/* Title — Figma Frame 116 @ y=254 / 1080 */}
            <div className="absolute inset-x-0 top-[23.5%] z-10 flex flex-col items-center px-5 text-center sm:px-8">
              <p className="text-[13px] font-normal uppercase tracking-[0.64px] text-white/60 sm:text-[16px]">
                {t("home.mc.hero.eyebrow")}
              </p>
              <h1 className="mt-7 max-w-[780px] bg-gradient-to-b from-white to-[#999] bg-clip-text text-balance text-[clamp(2.6rem,6.2vw,5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-transparent">
                <span className="block">{t("home.mc.hero.title1")}</span>
                <span className="mt-1 block">{t("home.mc.hero.title2")}</span>
              </h1>
            </div>

            {/* Free Start — Figma Frame 7 @ y=797 / 1080 (below baked-in prompt bar @ y=577) */}
            <div className="absolute inset-x-0 top-[73.8%] z-10 flex justify-center px-5">
              <GradientCta
                className="!h-[52px] !w-[200px] !gap-[11px] !text-[19px]"
                onClick={() => startCreating()}
              >
                <img
                  src={`${ASSET}/hero-icon-points.svg?v=1`}
                  alt=""
                  className="h-[19px] w-[16px]"
                  draggable={false}
                />
                {t("home.mc.cta.freeStart")}
              </GradientCta>
            </div>
          </div>
        </div>
      </section>

      {/* Product showcase */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-[1378px] text-center">
          <h2 className="mx-auto max-w-[1100px] text-balance text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-[-0.02em]">
            <span className="bg-[linear-gradient(100deg,#57d9fa,#9f66ff)] bg-clip-text text-transparent">
              {t("home.mc.product.highlight")}
            </span>{" "}
            <span className="text-white">{t("home.mc.product.title")}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[940px] text-[14px] leading-[30px] tracking-[0.32px] text-[#8b8e94] sm:text-[16px]">
            {t("home.mc.product.description")}
          </p>
          <div className="relative mx-auto mt-10 w-full">
            <img
              src={`${ASSET}/product-pill.svg?v=1`}
              alt=""
              width={282}
              height={79}
              className="mx-auto mb-1 h-auto w-[min(282px,42vw)] select-none"
              draggable={false}
              loading="lazy"
            />
            <img
              src={`${ASSET}/product-showcase.png?v=2`}
              alt={t("home.mc.product.imageAlt")}
              width={2756}
              height={1792}
              className="mx-auto h-auto w-full select-none"
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>

      {/* Get Inspired */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-[1200px] text-center">
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-[-0.02em] text-white">
            {t("home.mc.inspire.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-[14px] text-white/55 sm:text-[15px]">
            {t("home.mc.inspire.description")}
          </p>

          <div className="relative mx-auto mt-12 w-full max-w-[1180px]">
            <img
              src={`${ASSET}/inspire-fan-clean.png?v=9`}
              alt={t("home.mc.inspire.title")}
              className="mx-auto h-auto w-full select-none"
              draggable={false}
              loading="lazy"
            />
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8">
            <button
              type="button"
              onClick={() => startCreating("/dashboard/inspiration")}
              aria-label={t("home.mc.inspire.more")}
              className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#57d9fa,#9f66ff)] text-white shadow-[0_0_40px_rgba(87,217,250,0.35)] transition-transform hover:scale-105"
            >
              <ArrowRight className="h-9 w-9" strokeWidth={2.5} />
            </button>
            <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-white/55">
              {t("home.mc.inspire.more")}
            </p>
          </div>
        </div>
      </section>

      {/* Key Features — Figma Frame 105 / 2×3 cards */}
      <section className="px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="mx-auto max-w-[820px] text-center">
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-[-0.02em] text-white">
              {t("home.mc.features.title")}
            </h2>
            <p className="mt-4 text-[14px] leading-[30px] tracking-[0.32px] text-[#8b8e94] sm:text-[16px]">
              {t("home.mc.features.description")}
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-[1440px] gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon }) => (
              <article
                key={key}
                className="relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-[#26272c] bg-gradient-to-b from-[#1b1c21] to-[#0e0e10] p-6 sm:min-h-[320px]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-24 h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(90,150,255,0.18),transparent_70%)]"
                />
                <img
                  src={icon}
                  alt=""
                  className="relative h-16 w-16 select-none"
                  draggable={false}
                />
                <div className="relative mt-auto pt-10">
                  <h3 className="text-[15px] font-medium uppercase tracking-[1.92px] text-white sm:text-[16px]">
                    {t(`home.feature.${key}.title` as TranslationKey)}
                  </h3>
                  <p className="mt-4 text-[14px] leading-[23px] tracking-[0.28px] text-[#8b8e94]">
                    {t(`home.mc.feature.${key}.desc` as TranslationKey)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA — Figma 238:6439 bg-bottom + Ready / Start Now */}
      <section className="relative min-h-[280px] overflow-hidden px-5 py-20 sm:min-h-[320px] sm:px-8 lg:min-h-[348px] lg:px-12">
        <MagiCoreBgBottom />
        <div className="relative z-10 mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-[618px]">
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold capitalize leading-[1.1] tracking-[0.8px] text-white">
              {t("home.mc.ready.title")}
            </h2>
            <p className="mt-6 text-[14px] leading-[30px] tracking-[0.32px] text-white/60 sm:text-[16px]">
              {t("home.mc.ready.description")}
            </p>
          </div>
          <GradientCta className="!h-[52px] !w-[180px] !gap-[11px] !text-[18px] !font-semibold" onClick={() => startCreating()}>
            {t("home.mc.cta.startNow")}
            <ArrowRight className="h-6 w-6" strokeWidth={2} />
          </GradientCta>
        </div>
      </section>

      {/* Footer — Figma Container 181:5992 */}
      <footer className="bg-[#121212] px-5 pt-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[300px_1fr] lg:gap-20">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="MagiCoreAI">
              <img src={LOGO_MARK} alt="" className="h-6 w-auto" draggable={false} />
              <span className="text-[16px] font-semibold text-white">MagiCoreAI</span>
            </Link>
            <p className="mt-5 max-w-[300px] text-[12px] leading-[21px] text-[#8b8e94]">
              {t("home.mc.footer.description")}
            </p>
            {/* Figma: support + mail circular links */}
            <div className="mt-6 flex items-center gap-4">
              <a
                href="mailto:support@magicoreai.com"
                aria-label={t("home.mc.footer.support")}
                className="flex size-10 items-center justify-center rounded-full bg-[#1b1c21] transition-colors hover:bg-[#26272c]"
              >
                <img
                  src={`${ASSET}/footer-icon-support.svg?v=1`}
                  alt=""
                  className="h-4 w-4 select-none"
                  draggable={false}
                />
              </a>
              <a
                href="mailto:support@magicoreai.com"
                aria-label="support@magicoreai.com"
                className="flex size-10 items-center justify-center rounded-full bg-[#1b1c21] transition-colors hover:bg-[#26272c]"
              >
                <img
                  src={`${ASSET}/footer-icon-mail.svg?v=1`}
                  alt=""
                  className="h-4 w-4 select-none"
                  draggable={false}
                />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-[120px]">
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <h4 className="text-[14px] font-medium uppercase tracking-normal text-white">
                  {t(col.title)}
                </h4>
                <ul className="mt-6 space-y-[18px] text-[14px] text-[#8b8e94]">
                  {col.links.map((link) => (
                    <li key={link}>
                      {link === "home.mc.footer.legal.terms" ? (
                        <Link to="/terms" className="transition-colors hover:text-white">
                          {t(link)}
                        </Link>
                      ) : link === "home.mc.footer.legal.privacy" ? (
                        <Link to="/privacy" className="transition-colors hover:text-white">
                          {t(link)}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startCreating()}
                          className="text-left transition-colors hover:text-white"
                        >
                          {t(link)}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar: copyright + mail on the left (Figma Frame 219:1774) */}
        <div className="mx-auto flex h-[100px] max-w-[1440px] items-center border-t border-[#26272c]">
          <div className="flex flex-wrap items-center gap-x-[26px] gap-y-2 text-[13px] leading-[19.5px] text-[#8b8e94]">
            <p>{t("home.mc.footer.copyright")}</p>
            <a
              href="mailto:support@magicoreai.com"
              className="inline-flex items-center gap-2 transition-colors hover:text-white/80"
            >
              <img
                src={`${ASSET}/footer-icon-mail-sm.svg?v=1`}
                alt=""
                className="size-[14px] select-none"
                draggable={false}
              />
              support@magicoreai.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
