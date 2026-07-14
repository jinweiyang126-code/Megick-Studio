import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { useI18n } from "@/lib/i18n";
import { MEGICK_SITE_URL } from "@/lib/brand";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: "var(--theme-surface)",
        borderColor: "var(--glass-border)",
        color: "var(--theme-text)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-6 lg:gap-10">
          <div className="min-w-0 sm:col-span-2">
            <Logo to="/" />
            <p className="mt-4 max-w-sm text-sm" style={{ color: "var(--theme-text-muted)" }}>
              {t("footer.description")}
            </p>
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-semibold">{t("footer.product")}</h4>
            <ul
              className="mt-4 space-y-3 text-sm break-words"
              style={{ color: "var(--theme-text-muted)" }}
            >
              <li>
                <Link to="/generate" className="transition-opacity hover:opacity-70">
                  {t("nav.generate")}
                </Link>
              </li>
              <li>
                <Link to="/dashboard/template" className="transition-opacity hover:opacity-70">
                  {t("home.glaze.nav.projects")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 text-xs sm:flex-row"
          style={{ borderColor: "var(--glass-border)", color: "var(--theme-text-muted)" }}
        >
          <p>
            © {new Date().getFullYear()}{" "}
            <a
              href={MEGICK_SITE_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-opacity hover:opacity-70"
            >
              Megick
            </a>
            . {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
