import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { PaginatedResponse, PromptTemplateCategoryPublic, PromptTemplatePublic } from "@megick/api-types";
import { apiGet } from "@/lib/api-client";
import { getInitialLocale, translate } from "@/lib/i18n";
import { asSearchRecord, optionalEnum, optionalString } from "@/lib/search-params";
import { seoHead } from "@/lib/seo";

const TEMPLATE_TYPES = ["all", "image", "video"] as const;

export type PublicTemplateSearch = {
  q?: string;
  category?: string;
  type?: (typeof TEMPLATE_TYPES)[number];
};

export function templateSearchSchema(input: unknown): PublicTemplateSearch {
  const search = asSearchRecord(input);
  return {
    q: optionalString(search.q),
    category: optionalString(search.category),
    type: optionalEnum(search.type, TEMPLATE_TYPES),
  };
}

export type TemplatesLayoutLoaderData = {
  templates: PaginatedResponse<PromptTemplatePublic>;
  categories: PromptTemplateCategoryPublic[];
};

const fetchInitialTemplatesData = createServerFn({ method: "GET" }).handler(
  async (): Promise<TemplatesLayoutLoaderData> => {
    const [templates, categories] = await Promise.all([
      apiGet<PaginatedResponse<PromptTemplatePublic>>(
        "/api/templates?compact=true&page=1&pageSize=20",
        {
          forwardServerCookies: true,
        },
      ),
      apiGet<PromptTemplateCategoryPublic[]>("/api/templates/categories", {
        forwardServerCookies: true,
      }),
    ]);
    return { templates, categories };
  },
);

export const Route = createFileRoute("/templates")({
  loader: () => fetchInitialTemplatesData(),
  head: () => {
    const locale = getInitialLocale();
    return seoHead({
      title: translate(locale, "templates.meta.title"),
      description: translate(locale, "templates.meta.description"),
      path: "/templates",
      locale,
    });
  },
  validateSearch: templateSearchSchema,
  component: TemplatesLayoutRoute,
});

function TemplatesLayoutRoute() {
  return <Outlet />;
}
