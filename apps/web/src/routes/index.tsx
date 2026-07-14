import { createFileRoute } from "@tanstack/react-router";
import { OfficialHomePageRich } from "@/components/OfficialHomePageRich";
import { getInitialLocale, translate } from "@/lib/i18n";
import { seoHead } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import type { AppLocale } from "@/lib/i18n";

interface HomeLoaderData {
  locale: AppLocale;
}

export const Route = createFileRoute("/")({
  loader: async (): Promise<HomeLoaderData> => {
    const locale = await getRequestLocale();
    return { locale };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? getInitialLocale();
    const head = seoHead({
      title: translate(locale, "home.meta.title"),
      description: translate(locale, "home.meta.description"),
      path: "/",
      locale,
      imagePath: "/index.jpg?v=2",
      imageAlt: "Megick Studio desktop app preview",
    });
    return {
      ...head,
      links: [
        ...(head.links ?? []),
        {
          rel: "preload",
          as: "image",
          href: "/index.jpg?v=2",
          type: "image/jpeg",
          imageSizes: "(min-width: 1024px) min(52vw, 1040px), 92vw",
          fetchPriority: "high",
        },
      ],
    };
  },
  component: HomePage,
});

function HomePage() {
  Route.useLoaderData();
  return <OfficialHomePageRich />;
}
