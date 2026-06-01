"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { clearDemoSession, isDemoUser } from "@/lib/dummy-auth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Activity,
  BatteryCharging,
  Calendar,
  CircleGauge,
  Dumbbell,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Music2,
  Settings,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  User,
  Utensils,
  Zap,
} from "lucide-react";

const mainNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/workout-plans", label: "Plans", icon: Calendar },
  { href: "/nutrition", label: "Nutrition", icon: Utensils },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/recovery", label: "Recovery", icon: BatteryCharging },
  { href: "/achievements", label: "Achievements", icon: Trophy },
];

const coachNavItems = [
  { href: "/coach/chat", label: "AI Coach", icon: MessageSquare },
  { href: "/coach/workout", label: "Workout Coach", icon: Activity },
  { href: "/coach/dance", label: "Dance Coach", icon: Music2 },
];

const publicRoutes = new Set(["/", "/login", "/signup"]);
const minimalRoutes = new Set(["/onboarding"]);

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, session, loading } = useUserProfile();
  const demoMode = Boolean(session?.user?.id && isDemoUser(session.user.id));
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const nextTheme = saved || "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  useEffect(() => {
    const collapsed = localStorage.getItem("sidebar-collapsed") === "true";
    setSidebarCollapsed(collapsed);
  }, []);

  const isPublicRoute = publicRoutes.has(pathname);
  const isMinimalRoute = minimalRoutes.has(pathname);

  const navTitle = useMemo(() => {
    return (
      mainNavItems.find((item) => item.href === pathname)?.label ||
      coachNavItems.find((item) => item.href === pathname)?.label ||
      "FitCoach AI"
    );
  }, [pathname]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  const handleLogout = async () => {
    clearDemoSession();
    if (!demoMode) {
      try {
        await signOut();
      } catch {}
    }
    router.push("/");
    router.refresh();
  };

  if (isPublicRoute || isMinimalRoute) {
    return <div className="performance-shell min-h-screen bg-background">{children}</div>;
  }

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
          isActive ? "bg-primary text-primary-foreground shadow-[0_0_30px_color-mix(in_oklch,var(--primary)_22%,transparent)]" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          sidebarCollapsed && "justify-center px-2",
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "group-hover:text-primary")} />
        {!sidebarCollapsed && <span>{label}</span>}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-3 px-4 py-6", sidebarCollapsed && "justify-center px-2")}>
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_30px_color-mix(in_oklch,var(--primary)_20%,transparent)]">
          <CircleGauge className="h-6 w-6 text-primary" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-accent shadow-[0_0_16px_var(--accent)]" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">FitCoach AI</h1>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">strain recovery skill</p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
        <div className={cn("my-4 px-3 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground", sidebarCollapsed && "hidden")}>
          AI Coaching
        </div>
        <div className="space-y-1">
          {coachNavItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            pathname === "/settings" && "bg-primary text-primary-foreground",
            sidebarCollapsed && "justify-center px-2",
          )}
        >
          <Settings className="h-5 w-5" />
          {!sidebarCollapsed && <span>Settings</span>}
        </Link>
      </div>
    </div>
  );

  const initials =
    profile?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "FC";

  return (
    <div className="performance-shell min-h-screen bg-background">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen border-r border-sidebar-border bg-sidebar/90 shadow-[24px_0_90px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all duration-300 lg:block",
          sidebarCollapsed ? "w-[72px]" : "w-64",
        )}
      >
        {sidebar}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-card shadow-md"
        >
          <Target className="h-3 w-3" />
        </Button>
      </aside>

      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b border-border/70 bg-background/88 px-4 backdrop-blur-xl lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            {sidebar}
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <CircleGauge className="h-5 w-5 text-primary" />
          </div>
          <span className="font-semibold">{navTitle}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <UserMenu
            initials={initials}
            loading={loading}
            name={profile?.name ?? session?.user?.name ?? "FitCoach user"}
            subtitle={demoMode ? "demo mode" : profile?.experience ?? "beginner"}
            demoMode={demoMode}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <header
        className={cn(
          "sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border/70 bg-background/82 px-6 backdrop-blur-xl lg:flex",
          sidebarCollapsed ? "pl-[calc(72px+1.5rem)]" : "pl-[calc(16rem+1.5rem)]",
        )}
      >
        <div>
          <h2 className="text-lg font-black uppercase tracking-[0.12em]">{navTitle}</h2>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {profile?.goals?.length ? `Current focus: ${profile.goals[0].replace(/_/g, " ")}` : "Complete your profile to personalize coaching"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {profile ? (
            <div className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                <span>{profile.goals[0]?.replace(/_/g, " ") || "Set a goal"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-accent" />
                <span>{profile.workoutFrequency ?? 0} days/week target</span>
              </div>
            </div>
          ) : null}

          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <UserMenu
            initials={initials}
            loading={loading}
            name={profile?.name ?? session?.user?.name ?? "FitCoach user"}
            subtitle={demoMode ? "demo mode" : profile?.experience ?? "beginner"}
            demoMode={demoMode}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <main className={cn("min-h-[calc(100vh-4rem)] transition-all duration-300", sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        {children}
      </main>
    </div>
  );
}

function UserMenu({
  initials,
  loading,
  name,
  subtitle,
  demoMode,
  onLogout,
}: {
  initials: string;
  loading: boolean;
  name: string;
  subtitle: string;
  demoMode: boolean;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9 ring-2 ring-primary/20">
            <AvatarImage alt={name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-black">
              {loading ? "…" : initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground capitalize">{subtitle}</p>
            {demoMode ? <p className="text-[11px] leading-none text-amber-500">Testing mode with local demo session</p> : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
