import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  History,
  Image as ImageIcon,
  Images,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Scissors,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Crown,
  Video,
  User as UserIcon,
  Wand2,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { GenerationJobPublic } from "@megick/api-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MagiCoreIcon, magiCoreIcons, primaryRailIconSrc } from "@/components/brand/MagiCoreIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthGate } from "@/hooks/useAuthGate";
import { apiGet } from "@/lib/api-client";
import { useVideoGenerationEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import { OnboardingTourProvider } from "@/components/onboarding-tour/OnboardingTourProvider";
import { useOnboardingTour } from "@/components/onboarding-tour/onboarding-tour.context";
import {
  type DashboardOverview,
  type StudioMode,
  readLastStudioSessionId,
  rememberLastStudioSessionId,
  studioPathForJob,
  studioSearchForJob,
} from "./-dashboard-types";
import { TemplateDetailSkeleton } from "./-dashboard-components";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  localizedMenuDescription,
  localizedMenuLabel,
  type NavigationMenuItem,
} from "@/lib/navigation-menus";

type DashboardNavPath =
  | "/dashboard/inspiration"
  | "/dashboard/template"
  | "/dashboard/studio/image"
  | "/dashboard/studio/video"
  | "/dashboard/video-editor"
  | "/dashboard/media-center"
  | "/dashboard/history"
  | "/dashboard/chats"
  | "/dashboard/profile";

type DashboardNavItem = {
  to: DashboardNavPath;
  studioMode?: "image" | "video";
  requiresAuth: boolean;
  value: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: typeof Wand2;
  menuItem?: NavigationMenuItem;
};

const navItems: DashboardNavItem[] = [
  {
    to: "/dashboard/inspiration",
    requiresAuth: true,
    value: "templates",
    labelKey: "dashboard.nav.inspiration.label",
    descriptionKey: "dashboard.nav.inspiration.description",
    icon: Sparkles,
  },
  {
    to: "/dashboard/studio/image",
    studioMode: "image",
    requiresAuth: true,
    value: "image-studio",
    labelKey: "dashboard.nav.imageStudio.label",
    descriptionKey: "dashboard.nav.imageStudio.description",
    icon: ImageIcon,
  },
  {
    to: "/dashboard/studio/video",
    studioMode: "video",
    requiresAuth: true,
    value: "video-studio",
    labelKey: "dashboard.nav.videoStudio.label",
    descriptionKey: "dashboard.nav.videoStudio.description",
    icon: Video,
  },
  {
    to: "/dashboard/video-editor",
    requiresAuth: true,
    value: "video-editor",
    labelKey: "dashboard.nav.videoEditor.label",
    descriptionKey: "dashboard.nav.videoEditor.description",
    icon: Scissors,
  },
  {
    to: "/dashboard/media-center",
    requiresAuth: true,
    value: "media-center",
    labelKey: "dashboard.nav.mediaCenter.label",
    descriptionKey: "dashboard.nav.mediaCenter.description",
    icon: Images,
  },
  {
    to: "/dashboard/history",
    requiresAuth: true,
    value: "history",
    labelKey: "dashboard.nav.history.label",
    descriptionKey: "dashboard.nav.history.description",
    icon: History,
  },
  {
    to: "/dashboard/chats",
    requiresAuth: true,
    value: "chats",
    labelKey: "dashboard.nav.chats.label",
    descriptionKey: "dashboard.nav.chats.description",
    icon: MessageSquare,
  },
  {
    to: "/dashboard/profile",
    requiresAuth: true,
    value: "profile",
    labelKey: "dashboard.nav.profile.label",
    descriptionKey: "dashboard.nav.profile.description",
    icon: UserIcon,
  },
];

/** MagiCoreAI primary rail order (Figma). Everything else goes under「更多」. */
const PRIMARY_NAV_ORDER = [
  "templates",
  "image-studio",
  "video-studio",
  "video-editor",
] as const;

/** Secondary pages under「更多」— MagiCore top chrome (title + subtitle), same as studio. */
const MORE_NAV_ORDER = ["media-center", "history", "chats", "profile"] as const;

function isPrimaryNavValue(value: string) {
  return (PRIMARY_NAV_ORDER as readonly string[]).includes(value);
}

function moreNavRank(value: string) {
  const idx = (MORE_NAV_ORDER as readonly string[]).indexOf(value);
  return idx === -1 ? MORE_NAV_ORDER.length : idx;
}

const dashboardIconMap = {
  image: ImageIcon,
  video: Video,
  scissors: Scissors,
  "layout-template": LayoutTemplate,
  images: Images,
  history: History,
  "message-square": MessageSquare,
  user: UserIcon,
  sparkles: Sparkles,
  settings: Settings,
} satisfies Record<string, typeof Wand2>;

const onboardingNavTargets: Partial<Record<string, string>> = {
  "image-studio": "nav-image-studio",
  "video-studio": "nav-video-studio",
  history: "nav-history",
};

function normalizeMenuHref(href: string) {
  const trimmed = href.trim();
  if (trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
}

function isDashboardNavPath(value: string): value is DashboardNavPath {
  const href = normalizeMenuHref(value);
  if (
    href === "/dashboard/template" ||
    href === "/dashboard/templates" ||
    href === "/dashboard/inspiration"
  ) {
    return true;
  }
  return navItems.some((item) => normalizeMenuHref(item.to) === href);
}

function dashboardNavItemFromMenu(item: NavigationMenuItem): DashboardNavItem | null {
  const href = normalizeMenuHref(item.href);
  if (!item.isActive || !isDashboardNavPath(href)) return null;
  const fallback =
    navItems.find((navItem) => navItem.value === item.code) ??
    navItems.find((navItem) => normalizeMenuHref(navItem.to) === href);

  // MagiCoreAI: API still ships templates → /dashboard/template; map to inspiration home.
  const isTemplatesMenu =
    item.code === "templates" ||
    href === "/dashboard/template" ||
    href === "/dashboard/templates";
  if (isTemplatesMenu) {
    const inspiration = navItems.find((navItem) => navItem.value === "templates");
    if (!inspiration) return null;
    return {
      ...inspiration,
      requiresAuth: item.requiresAuth,
    };
  }

  const studioMode =
    item.metadata?.studioMode === "video" || item.href.endsWith("/video")
      ? "video"
      : item.metadata?.studioMode === "image" || item.href.endsWith("/image")
        ? "image"
        : fallback?.studioMode;
  const value = item.code || fallback?.value || item.href;
  // Primary rail uses MagiCore i18n labels (ignore English API menu copy).
  const useLocalPrimaryCopy = isPrimaryNavValue(value);

  return {
    to: (fallback?.to && useLocalPrimaryCopy ? fallback.to : href) as DashboardNavPath,
    studioMode,
    requiresAuth: item.requiresAuth,
    value,
    labelKey: fallback?.labelKey ?? "dashboard.nav.custom.label",
    descriptionKey: fallback?.descriptionKey ?? "dashboard.nav.custom.description",
    icon:
      useLocalPrimaryCopy && fallback?.icon
        ? fallback.icon
        : item.icon && item.icon in dashboardIconMap
          ? dashboardIconMap[item.icon as keyof typeof dashboardIconMap]
          : (fallback?.icon ?? Wand2),
    menuItem: useLocalPrimaryCopy ? undefined : item,
  };
}

function isTemplateDetailPath(pathname: string) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  return (
    normalized.startsWith("/dashboard/template/") || normalized.startsWith("/dashboard/templates/")
  );
}

function currentLocationHref() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { t, formatNumber, locale } = useI18n();
  const { user, loading, signOut, requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const location = useLocation();
  const { videoGenerationEnabled, isLoading: videoFlagLoading } = useVideoGenerationEnabled();
  const routeRequiresAuth = true;
  const shouldLoadPrivateChrome = !!user;
  const userId = user?.id;
  const authRedirectPathRef = useRef<string | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [storedStudioSessionIds, setStoredStudioSessionIds] = useState<
    Partial<Record<StudioMode, string>>
  >({});


  const overviewQ = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => apiGet<DashboardOverview>("/api/users/me/overview"),
    enabled: shouldLoadPrivateChrome,
  });

  const notificationsQ = useQuery({
    queryKey: ["dashboard", "notifications"],
    queryFn: () => apiGet<GenerationJobPublic[]>("/api/generation/jobs", { query: { limit: 12 } }),
    enabled: shouldLoadPrivateChrome,
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.some(
        (job) => job.status === "queued" || job.status === "running",
      )
        ? 10_000
        : 60_000,
  });
  const dashboardMenusQ = useQuery({
    queryKey: ["navigation-menus", "dashboard-sidebar"],
    queryFn: () =>
      apiGet<NavigationMenuItem[]>("/api/navigation-menus", {
        query: { area: "DASHBOARD_SIDEBAR" },
      }),
    enabled: shouldLoadPrivateChrome,
    staleTime: 300000,
  });
  useEffect(() => {
    if (loading || user) {
      authRedirectPathRef.current = null;
      return;
    }
    const redirectTo = currentLocationHref();
    if (authRedirectPathRef.current === redirectTo) return;
    authRedirectPathRef.current = redirectTo;
    requireAuth(redirectTo);
    navigate({ to: "/", replace: true });
  }, [loading, navigate, requireAuth, user]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = window.localStorage.getItem(`megick-read-notifications:${userId}`);
      setReadNotificationIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setStoredStudioSessionIds({});
      return;
    }
    setStoredStudioSessionIds({
      image: readLastStudioSessionId(userId, "image") ?? undefined,
      video: readLastStudioSessionId(userId, "video") ?? undefined,
    });
  }, [userId]);

  const overview = overviewQ.data;
  const credits = user?.credits ?? overview?.credits ?? 0;
  const profileName = user ? user.displayName || user.email.split("@")[0] : t("common.creator");
  const hasAdvancedAccess = Boolean(user?.hasAdvancedAccess ?? overview?.hasAdvancedAccess);
  const initial = profileName.charAt(0).toUpperCase();
  const notificationJobs = (notificationsQ.data ?? [])
    .filter((job) => job.status === "succeeded")
    .slice(0, 8);
  const unreadNotificationCount = notificationJobs.filter(
    (job) => !readNotificationIds.includes(job.id),
  ).length;
  const persistReadNotifications = (ids: string[]) => {
    setReadNotificationIds(ids);
    if (!user) return;
    try {
      window.localStorage.setItem(`megick-read-notifications:${user.id}`, JSON.stringify(ids));
    } catch {
      // localStorage may be unavailable in private browsing.
    }
  };
  const markNotificationRead = (id: string) => {
    if (readNotificationIds.includes(id)) return;
    persistReadNotifications([...readNotificationIds, id]);
  };
  const markAllNotificationsRead = () => {
    persistReadNotifications([
      ...new Set([...readNotificationIds, ...notificationJobs.map((job) => job.id)]),
    ]);
  };
  const notificationTime = (job: GenerationJobPublic) =>
    new Date(job.finishedAt ?? job.createdAt).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const handleOnboardingTourStart = useCallback(() => {
    setSidebarOpen(true);
    return () => {
      setSidebarOpen(false);
    };
  }, []);

  const currentSearch = location.search as {
    mode?: string;
    sessionId?: string;
    onboardingDemo?: boolean | string;
  };
  const currentIsOnboardingDemo =
    currentSearch.onboardingDemo === true ||
    currentSearch.onboardingDemo === "true" ||
    currentSearch.onboardingDemo === "1";
  const currentStudioSessionId =
    location.pathname.startsWith("/dashboard/studio") && !currentIsOnboardingDemo
      ? currentSearch.sessionId
      : undefined;
  const currentStudioMode = location.pathname.startsWith("/dashboard/studio/video")
    ? "video"
    : currentSearch.mode === "video"
      ? "video"
      : "image";
  useEffect(() => {
    if (!userId || !currentStudioSessionId || currentIsOnboardingDemo) return;
    rememberLastStudioSessionId(currentStudioSessionId, userId, currentStudioMode);
    setStoredStudioSessionIds((prev) => ({
      ...prev,
      [currentStudioMode]: currentStudioSessionId,
    }));
  }, [currentIsOnboardingDemo, currentStudioMode, currentStudioSessionId, userId]);

  const storedSessionForMode = (mode: StudioMode) => storedStudioSessionIds[mode];
  const studioNavSearchFor = (mode: StudioMode) => {
    const sessionId =
      currentStudioMode === mode ? currentStudioSessionId : storedSessionForMode(mode);
    return sessionId ? { sessionId } : undefined;
  };
  const isNavActive = (item: (typeof navItems)[number]) => {
    if (item.value === "templates" || item.to === "/dashboard/inspiration") {
      return (
        location.pathname.startsWith("/dashboard/inspiration") ||
        location.pathname.startsWith("/dashboard/template") ||
        location.pathname.startsWith("/dashboard/templates")
      );
    }
    if (item.studioMode) {
      return (
        location.pathname.startsWith(item.to) && currentStudioMode === item.studioMode
      );
    }
    return location.pathname.startsWith(item.to);
  };
  const configuredNavItems = useMemo(() => {
    const rows = dashboardMenusQ.data ?? [];
    const mapped = rows
      .map(dashboardNavItemFromMenu)
      .filter((item): item is DashboardNavItem => Boolean(item));
    return mapped.length ? mapped : navItems;
  }, [dashboardMenusQ.data]);
  const visibleNavItems = useMemo(
    () =>
      configuredNavItems.filter(
        (item) => videoGenerationEnabled || item.studioMode !== "video",
      ),
    [configuredNavItems, videoGenerationEnabled],
  );
  const { primaryNavItems, moreNavItems } = useMemo(() => {
    const byValue = new Map(visibleNavItems.map((item) => [item.value, item]));
    const primary: DashboardNavItem[] = [];
    for (const value of PRIMARY_NAV_ORDER) {
      const item = byValue.get(value);
      if (!item) continue;
      primary.push(item);
      byValue.delete(value);
    }
    for (const item of visibleNavItems) {
      if (isPrimaryNavValue(item.value) || primary.includes(item)) continue;
      // Catch API menus that map to primary paths under other codes.
      if (
        item.to === "/dashboard/inspiration" ||
        item.to === "/dashboard/template" ||
        item.to === "/dashboard/studio/image" ||
        item.to === "/dashboard/studio/video" ||
        item.to === "/dashboard/video-editor"
      ) {
        if (!primary.some((row) => row.to === item.to && row.studioMode === item.studioMode)) {
          primary.push(item);
        }
        byValue.delete(item.value);
      }
    }
    const more = visibleNavItems
      .filter((item) => !primary.includes(item))
      .sort((a, b) => moreNavRank(a.value) - moreNavRank(b.value));
    return { primaryNavItems: primary, moreNavItems: more };
  }, [visibleNavItems]);
  const activeNav =
    [...primaryNavItems, ...moreNavItems].find(isNavActive) ??
    primaryNavItems[0] ??
    navItems[0];
  const navLabel = (item: DashboardNavItem) =>
    item.menuItem
      ? localizedMenuLabel(item.menuItem, locale, t)
      : t(item.labelKey);
  const navDescription = (item: DashboardNavItem) =>
    item.menuItem
      ? localizedMenuDescription(item.menuItem, locale, t)
      : t(item.descriptionKey);
  const isStudioWorkspace =
    location.pathname.startsWith("/dashboard/studio") ||
    location.pathname.startsWith("/dashboard/video-editor");
  const isImageStudio = location.pathname.startsWith("/dashboard/studio/image");
  const isVideoStudio = location.pathname.startsWith("/dashboard/studio/video");
  const isVideoEditor = location.pathname.startsWith("/dashboard/video-editor");
  const isInspiration = location.pathname.startsWith("/dashboard/inspiration");
  const isMediaCenter = location.pathname.startsWith("/dashboard/media-center");
  const isHistoryPage = location.pathname.startsWith("/dashboard/history");
  const isChatsPage = location.pathname.startsWith("/dashboard/chats");
  const isProfilePage = location.pathname.startsWith("/dashboard/profile");
  const isGenerationStudio = isImageStudio || isVideoStudio;
  const isChromeStudio = isGenerationStudio || isVideoEditor;
  const hideShellHeaderDesktop =
    isInspiration || isMediaCenter || isHistoryPage || isChatsPage || isProfilePage;
  const isMagiCoreChrome = isChromeStudio || hideShellHeaderDesktop;
  const shellTitle = isImageStudio
    ? t("studio.shell.image.title")
    : isVideoStudio
      ? t("studio.shell.video.title")
      : isVideoEditor
        ? t("studio.shell.edit.title")
        : navLabel(activeNav);
  const shellSubtitle = isImageStudio
    ? t("studio.shell.image.subtitle")
    : isVideoStudio
      ? t("studio.shell.video.subtitle")
      : isVideoEditor
        ? t("studio.shell.edit.subtitle")
        : navDescription(activeNav);

  const renderRailNavItem = (item: DashboardNavItem) => {
    const isActive = isNavActive(item);
    const figmaIcon = primaryRailIconSrc(item.value, isActive);
    const className = cn(
      "flex h-16 w-[62px] flex-col items-center justify-center gap-1.5 rounded-lg p-1 transition",
      isActive
        ? "bg-primary/10 text-primary"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
    );
    const body = (
      <>
        {figmaIcon ? (
          <MagiCoreIcon src={figmaIcon} className="h-[22px] w-[22px] shrink-0" />
        ) : (
          <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} />
        )}
        <span
          className={cn(
            "max-w-full truncate text-center text-[12px] leading-none",
            isActive ? "text-primary" : "text-foreground",
          )}
        >
          {navLabel(item)}
        </span>
      </>
    );
    const trigger =
      item.requiresAuth && !user ? (
        <button
          type="button"
          data-onboarding-target={onboardingNavTargets[item.value]}
          onClick={() => {
            setSidebarOpen(false);
            requireAuth(item.to);
          }}
          className={className}
          aria-label={navLabel(item)}
        >
          {body}
        </button>
      ) : (
        <Link
          to={item.to}
          search={item.studioMode ? studioNavSearchFor(item.studioMode) : undefined}
          preload="intent"
          data-onboarding-target={onboardingNavTargets[item.value]}
          onClick={() => setSidebarOpen(false)}
          className={className}
          aria-label={navLabel(item)}
          aria-current={isActive ? "page" : undefined}
        >
          {body}
        </Link>
      );

    return (
      <div key={item.value} className="flex justify-center">
        {trigger}
      </div>
    );
  };

  const renderMobileNavItem = (item: DashboardNavItem) => {
    const isActive = isNavActive(item);
    const figmaIcon = primaryRailIconSrc(item.value, isActive);
    const className = cn(
      "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
      isActive
        ? "bg-primary/20 text-primary"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
    );
    const body = (
      <>
        {figmaIcon ? (
          <MagiCoreIcon src={figmaIcon} className="h-4 w-4 shrink-0" />
        ) : (
          <item.icon className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{navLabel(item)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {navDescription(item)}
          </span>
        </span>
      </>
    );
    if (item.requiresAuth && !user) {
      return (
        <button
          key={item.value}
          type="button"
          onClick={() => {
            setSidebarOpen(false);
            requireAuth(item.to);
          }}
          className={className}
        >
          {body}
        </button>
      );
    }
    return (
      <Link
        key={item.value}
        to={item.to}
        search={item.studioMode ? studioNavSearchFor(item.studioMode) : undefined}
        preload="intent"
        onClick={() => setSidebarOpen(false)}
        className={className}
      >
        {body}
      </Link>
    );
  };

  if (routeRequiresAuth && (loading || !user)) {
    if (isTemplateDetailPath(location.pathname)) {
      return (
        <div className="min-h-screen bg-background">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            <TemplateDetailSkeleton />
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  // Handle standalone route like /dashboard/jobs/$jobId gracefully by rendering only the Outlet
  if (location.pathname.includes("/dashboard/jobs/")) {
    return <>{children}</>;
  }

  if (!user) return null;
  const currentUser = user;

  return (
    <OnboardingTourProvider
      userId={currentUser.id}
      videoGenerationEnabled={videoGenerationEnabled}
      ready={!videoFlagLoading}
      openSidebar={() => setSidebarOpen(true)}
      closeSidebar={() => setSidebarOpen(false)}
      onTourStart={handleOnboardingTourStart}
    >
      <div
        className="h-full overflow-hidden bg-background text-foreground"
        data-onboarding-target="dashboard-shell"
      >
        <div ref={shellRef} className="flex h-full min-h-0">
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-40 flex w-[min(18rem,85vw)] shrink-0 flex-col bg-sidebar transition-transform duration-200 lg:relative lg:inset-auto lg:w-[var(--dashboard-rail-width)] lg:translate-x-0 lg:items-center lg:justify-between",
              sidebarOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="relative flex h-[78px] w-full shrink-0 items-center justify-center">
              <Link
                to="/"
                className="flex size-full items-center justify-center overflow-hidden"
                aria-label="MagiCoreAI"
              >
                <img
                  src="/brand/magicore/rail-mark.png?v=4"
                  alt=""
                  width={47}
                  height={23}
                  className="hidden h-[23px] w-[47px] object-contain lg:block"
                />
                <span className="px-3 text-sm font-bold tracking-tight text-primary lg:hidden">
                  MagiCoreAI
                </span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label={t("dashboard.closeNavigation")}
              >
                <X />
              </Button>
            </div>

            <TooltipProvider delayDuration={150}>
            {/* Desktop: Figma sidebar uses justify-between — logo / nav / footer */}
            <nav className="hidden w-[62px] shrink-0 flex-col items-center gap-2 lg:flex">
              {primaryNavItems.map(renderRailNavItem)}
            </nav>

            {/* Mobile: scrollable list under the logo */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 lg:hidden">
              <nav className="flex flex-col gap-1">
                {primaryNavItems.map(renderMobileNavItem)}
                {moreNavItems.length ? (
                  <>
                    <p className="mt-3 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("dashboard.nav.more")}
                    </p>
                    {moreNavItems.map(renderMobileNavItem)}
                  </>
                ) : null}
              </nav>
            </div>

            <div className="hidden w-full shrink-0 flex-col items-center gap-4 pb-6 lg:flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-8 w-full items-center justify-center gap-1 text-xs tabular-nums text-foreground">
                    <MagiCoreIcon
                      src={magiCoreIcons.pointsGradient}
                      className="h-4 w-4 shrink-0"
                    />
                    {formatNumber(credits)}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">{t("profile.credits")}</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center overflow-hidden rounded-2xl border-[0.5px] border-border bg-[#17181d] outline-none"
                    aria-label={t("auth.userMenu.open")}
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatarUrl ?? undefined} alt={profileName} />
                      <AvatarFallback className="bg-transparent text-xs font-bold text-primary">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium">{profileName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/dashboard/profile">
                      <Settings className="mr-2 h-4 w-4" />
                      {t("dashboard.menu.profile")}
                    </Link>
                  </DropdownMenuItem>
                  {user.isSuperAdmin ? (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {t("dashboard.menu.admin")}
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void signOut()}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("dashboard.menu.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative size-8 rounded-lg"
                    aria-label={t("dashboard.notifications")}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {unreadNotificationCount > 0 ? (
                      <span className="absolute right-1 top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold text-primary-foreground">
                        {Math.min(unreadNotificationCount, 9)}
                      </span>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="right"
                  sideOffset={8}
                  collisionPadding={12}
                  className="w-80 p-0"
                >
                  <div className="flex items-center justify-between border-b border-border p-4">
                    <p className="font-semibold text-sm">{t("dashboard.notifications")}</p>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline disabled:text-muted-foreground"
                      disabled={!notificationJobs.length}
                      onClick={markAllNotificationsRead}
                    >
                      {t("dashboard.markRead")}
                    </button>
                  </div>
                  <div className="flex max-h-[min(20rem,calc(100vh-6rem))] flex-col overflow-y-auto py-2">
                    {notificationJobs.length ? (
                      notificationJobs.map((job) => (
                        <Link
                          key={job.id}
                          to={
                            job.chatSessionId
                              ? studioPathForJob(job)
                              : "/dashboard/jobs/$jobId"
                          }
                          params={job.chatSessionId ? undefined : { jobId: job.id }}
                          search={studioSearchForJob(job)}
                          preload="intent"
                          onClick={() => markNotificationRead(job.id)}
                          className="px-4 py-3 text-sm transition hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">
                              {job.type === "IMAGE2VIDEO"
                                ? t("dashboard.notification.videoReady")
                                : t("dashboard.notification.imageReady")}
                            </p>
                            {!readNotificationIds.includes(job.id) ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {job.prompt}
                          </p>
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            {notificationTime(job)}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {notificationsQ.isLoading
                          ? t("dashboard.notificationsLoading")
                          : t("dashboard.notificationsEmpty")}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {moreNavItems.length ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg"
                      aria-label={t("dashboard.nav.more")}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="end" className="w-56">
                    <DropdownMenuLabel>{t("dashboard.nav.more")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {moreNavItems.map((item) => (
                      <DropdownMenuItem key={item.value} asChild className="cursor-pointer">
                        <Link
                          to={item.to}
                          search={
                            item.studioMode ? studioNavSearchFor(item.studioMode) : undefined
                          }
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {navLabel(item)}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            </TooltipProvider>

            <div className="shrink-0 border-t border-sidebar-border p-3 lg:hidden">
              <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/dashboard/studio/image" search={{ newSession: true }} preload="intent">
                  <Wand2 className="h-4 w-4" />
                  {t("dashboard.newGeneration")}
                </Link>
              </Button>
            </div>
          </aside>

          {sidebarOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label={t("dashboard.closeOverlay")}
            />
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header
              className={cn(
                "z-20 flex shrink-0 items-center justify-between gap-1.5 bg-background/95 backdrop-blur-xl",
                isInspiration || isMediaCenter || isHistoryPage || isChatsPage || isProfilePage
                  ? "min-h-12 border-b border-transparent px-2 py-2 sm:gap-2 sm:px-5 lg:hidden"
                  : isChromeStudio
                    ? "items-start justify-between border-b border-transparent px-6 py-6"
                    : "min-h-14 border-b border-border px-2 py-2 sm:gap-2 sm:px-5",
              )}
            >
              <div className="flex min-w-0 items-center gap-1 sm:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                  aria-label={t("dashboard.openNavigation")}
                >
                  <Menu />
                </Button>
                {!hideShellHeaderDesktop ? (
                  <div className="hidden min-w-0 sm:block">
                    <p
                      className={cn(
                        "truncate tracking-tight text-foreground",
                        isChromeStudio
                          ? "text-base font-medium"
                          : "text-sm font-semibold",
                      )}
                    >
                      {shellTitle}
                    </p>
                    <p
                      className={cn(
                        "truncate text-muted-foreground",
                        isChromeStudio
                          ? "mt-1 text-xs text-[#8b8e94]"
                          : "text-xs",
                      )}
                    >
                      {shellSubtitle}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-4">
                {user && isChromeStudio ? (
                  <>
                    <OnboardingTourEntryButton label={t("studio.shell.guide")} />
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="hidden h-10 gap-2 rounded-xl border-border bg-[#1b1c21] px-4 text-sm text-foreground hover:bg-[#1b1c21]/90 sm:inline-flex"
                    >
                      <Link to="/dashboard/media-center" preload="intent">
                        <MagiCoreIcon src={magiCoreIcons.asset} className="h-3.5 w-3.5" />
                        <span>{t("studio.shell.assets")}</span>
                      </Link>
                    </Button>
                  </>
                ) : null}
                {user && !isMagiCoreChrome ? (
                  <OnboardingTourEntryButton label={t("onboarding.entry")} />
                ) : null}
                {user && !isMagiCoreChrome ? (
                  <form
                    className="hidden h-9 min-w-0 max-w-[14rem] flex-1 items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 text-xs text-muted-foreground transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-ring md:flex xl:max-w-[16rem]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const search = fd.get("search");
                      if (search)
                        navigate({
                          to: "/dashboard/history",
                          search: { prompt: search as string },
                        });
                    }}
                  >
                    <Search className="h-3.5 w-3.5 shrink-0" />
                    <input
                      name="search"
                      placeholder={t("dashboard.searchRecords")}
                      className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </form>
                ) : null}
                {!isMagiCoreChrome ? (
                  <>
                    <LanguageSwitcher variant="outline" />
                    <ThemeToggle variant="outline" />
                  </>
                ) : null}
                {user && !isMagiCoreChrome ? (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="relative"
                          aria-label={t("dashboard.notifications")}
                        >
                          <Bell className="h-4 w-4" />
                          {unreadNotificationCount > 0 ? (
                            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                              {Math.min(unreadNotificationCount, 9)}
                            </span>
                          ) : null}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 p-0">
                        <div className="flex items-center justify-between border-b border-border p-4">
                          <p className="font-semibold text-sm">{t("dashboard.notifications")}</p>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline disabled:text-muted-foreground"
                            disabled={!notificationJobs.length}
                            onClick={markAllNotificationsRead}
                          >
                            {t("dashboard.markRead")}
                          </button>
                        </div>
                        <div className="flex max-h-80 flex-col overflow-y-auto py-2">
                          {notificationJobs.length ? (
                            notificationJobs.map((job) => (
                              <Link
                                key={job.id}
                                to={
                                  job.chatSessionId
                                    ? studioPathForJob(job)
                                    : "/dashboard/jobs/$jobId"
                                }
                                params={job.chatSessionId ? undefined : { jobId: job.id }}
                                search={studioSearchForJob(job)}
                                preload="intent"
                                onClick={() => markNotificationRead(job.id)}
                                className="px-4 py-3 text-sm transition hover:bg-muted/50"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium">
                                    {job.type === "IMAGE2VIDEO"
                                      ? t("dashboard.notification.videoReady")
                                      : t("dashboard.notification.imageReady")}
                                  </p>
                                  {!readNotificationIds.includes(job.id) ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                  ) : null}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {job.prompt}
                                </p>
                                <p className="mt-2 text-[10px] text-muted-foreground">
                                  {notificationTime(job)}
                                </p>
                              </Link>
                            ))
                          ) : (
                            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                              {notificationsQ.isLoading
                                ? t("dashboard.notificationsLoading")
                                : t("dashboard.notificationsEmpty")}
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <div className="hidden h-9 items-center gap-1 rounded-md border border-border bg-secondary/30 px-2 min-[380px]:flex">
                      <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="hidden text-muted-foreground xl:inline">
                          {t("profile.credits")}
                        </span>
                        <span className="tabular-nums">{formatNumber(credits)}</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-full outline-none"
                          aria-label={t("auth.userMenu.open")}
                        >
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={user.avatarUrl ?? undefined} alt={profileName} />
                            <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="hidden text-left sm:block">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold leading-none">{profileName}</p>
                              {hasAdvancedAccess ? (
                                <Badge className="h-5 gap-1 px-1.5 text-[10px]">
                                  <Crown className="h-3 w-3" />
                                  {t("dashboard.advancedAccess")}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                  {t("dashboard.freeUser")}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] leading-none text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium leading-none">{profileName}</p>
                              {hasAdvancedAccess ? (
                                <Badge className="h-5 gap-1 px-1.5 text-[10px]">
                                  <Crown className="h-3 w-3" />
                                  {t("dashboard.advancedAccess")}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                  {t("dashboard.freeUser")}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs leading-none text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link to="/dashboard/profile">
                            <Settings className="mr-2 h-4 w-4" />
                            {t("dashboard.menu.profile")}
                          </Link>
                        </DropdownMenuItem>
                        {user.isSuperAdmin ? (
                          <DropdownMenuItem asChild>
                            <Link to="/admin" className="cursor-pointer">
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              {t("dashboard.menu.admin")}
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void signOut()}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          {t("dashboard.menu.signOut")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : null}
                {!user ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => requireAuth()}>
                      {t("nav.signIn")}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-gradient-primary shadow-glow hover:opacity-90"
                      onClick={() => requireAuth("/dashboard/studio/image?newSession=true")}
                    >
                      {t("nav.getStarted")}
                    </Button>
                  </>
                ) : null}
              </div>
            </header>

            <main
              className={cn(
                "min-h-0 flex-1",
                isGenerationStudio || isVideoEditor
                  ? "overflow-y-auto px-3 py-2 sm:px-4 sm:py-3 lg:overflow-hidden lg:px-6 lg:pb-6 lg:pt-0"
                  : isStudioWorkspace
                    ? "overflow-y-auto px-2 py-2 sm:px-3 sm:py-3 lg:overflow-hidden lg:px-5 lg:py-4"
                    : "overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-5",
              )}
            >
              <div
                className={cn(
                  "flex w-full flex-1 flex-col",
                  isStudioWorkspace ? "min-h-full lg:h-full lg:min-h-0" : "min-h-full gap-4",
                )}
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </OnboardingTourProvider>
  );
}

function OnboardingTourEntryButton({ label }: { label: string }) {
  const { startTour } = useOnboardingTour();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="hidden h-10 shrink-0 gap-2 rounded-xl border-border bg-[#1b1c21] px-4 text-sm text-foreground hover:bg-[#1b1c21]/90 sm:inline-flex"
      onClick={startTour}
      aria-label={label}
      title={label}
    >
      <MagiCoreIcon src={magiCoreIcons.guide} className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}
