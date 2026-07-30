import { createFileRoute, redirect } from "@tanstack/react-router";
import { templateSearchSchema } from "./dashboard.templates.index";

export const Route = createFileRoute("/dashboard/template/")({
  validateSearch: templateSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/dashboard/inspiration", search });
  },
});
