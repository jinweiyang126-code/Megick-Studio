import { createFileRoute } from "@tanstack/react-router";
import { InspirationPage } from "@/components/inspiration/InspirationPage";
import { getInitialLocale, translate } from "@/lib/i18n";
import { noIndexHead } from "@/lib/seo";
import { templateSearchSchema } from "./dashboard.templates.index";

export const Route = createFileRoute("/dashboard/inspiration")({
  head: () =>
    noIndexHead({
      title: translate(getInitialLocale(), "inspiration.meta.title"),
      description: translate(getInitialLocale(), "inspiration.meta.description"),
    }),
  validateSearch: templateSearchSchema,
  component: DashboardInspirationRoute,
});

function DashboardInspirationRoute() {
  return <InspirationPage search={Route.useSearch()} />;
}
