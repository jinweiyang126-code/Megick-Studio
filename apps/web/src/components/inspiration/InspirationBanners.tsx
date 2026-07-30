import { useI18n } from "@/lib/i18n";

const BANNERS = [
  {
    id: "collection",
    titleKey: "inspiration.banner.collection.title" as const,
    bodyKey: "inspiration.banner.collection.body" as const,
    tone: "from-primary/25 via-primary/10 to-transparent",
  },
  {
    id: "agent",
    titleKey: "inspiration.banner.agent.title" as const,
    bodyKey: "inspiration.banner.agent.body" as const,
    tone: "from-sky-500/20 via-transparent to-transparent",
  },
];

export function InspirationBanners() {
  const { t } = useI18n();

  return (
    <section className="grid gap-3 md:grid-cols-[1.25fr_1fr]">
      {BANNERS.map((banner) => (
        <div
          key={banner.id}
          className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${banner.tone} p-5 sm:p-6`}
        >
          <p className="text-sm font-semibold text-foreground sm:text-base">{t(banner.titleKey)}</p>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t(banner.bodyKey)}
          </p>
        </div>
      ))}
    </section>
  );
}
