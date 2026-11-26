import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUnreadAdvisingCount } from "@/features/advising/api/advising-api";
import { useAuthUser, useLogout } from "@/features/auth";
import {
  formatSemesterLabel,
  useActiveSemester,
} from "@/hooks/use-active-semester";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Tổng quan",
    href: "/student/overview",
    icon: LayoutDashboard,
  },
  {
    name: "Hồ sơ học tập",
    href: "/student/record",
    icon: GraduationCap,
  },
  {
    name: "Dự báo XAI",
    href: "/student/simulation",
    icon: Sparkles,
  },
  {
    name: "Giả lập What-If",
    href: "/student/what-if",
    icon: SlidersHorizontal,
  },
  {
    name: "Cố vấn & Hướng dẫn",
    href: "/student/advising",
    icon: UserCheck,
  },
  {
    name: "Cài đặt",
    href: "/student/settings",
    icon: Settings,
  },
];

export const StudentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useAuthUser();
  const { data: activeSemester } = useActiveSemester();
  const logout = useLogout();
  const activeSemesterLabel = formatSemesterLabel(
    activeSemester?.semester_code,
  );
  const { data: unreadData } = useUnreadAdvisingCount(!!user);
  const unreadCount = unreadData?.unread_count ?? 0;

  const navItems = useMemo<NavItem[]>(() => {
    return NAV_ITEMS.map((item) => {
      if (item.href === "/student/advising") {
        return {
          ...item,
          badge:
            unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
        };
      }
      return item;
    });
  }, [unreadCount]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("aurora_student_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("aurora_student_sidebar_collapsed", String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  const handleCloseSidebar = () => {
    setMobileMenuOpen(false);
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSidebarCollapsed(true);
      try {
        localStorage.setItem("aurora_student_sidebar_collapsed", "true");
      } catch {
        // ignore
      }
    }
  };

  const studentName = user?.name || "Sinh viên";
  const studentCode = user?.user_code || "—";

  const currentNav = NAV_ITEMS.find(
    (item) =>
      location.pathname === item.href ||
      (item.href === "/student/overview" && location.pathname === "/student"),
  );
  const currentTitle = currentNav?.name || "Tổng quan";

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 transition-opacity lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (Slate Canvas #f8fafc per DESIGN.md) */}
      <aside
        aria-label="Điều hướng cổng sinh viên"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-sidebar transition-all duration-200 ease-in-out",
          mobileMenuOpen ? "translate-x-0 w-64 shadow-lg" : "-translate-x-full",
          "lg:translate-x-0",
          sidebarCollapsed ? "lg:w-20" : "lg:w-64",
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-slate-200 transition-all duration-200",
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-5",
          )}
        >
          <Link
            to="/student/overview"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            onClick={() => setMobileMenuOpen(false)}
            title="Aurora — Cổng Sinh viên"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex min-w-0 flex-col overflow-hidden">
                <span className="font-heading text-base font-extrabold tracking-wide text-slate-900 leading-none">
                  AURORA
                </span>
                <span className="mt-0.5 truncate text-xs font-medium text-slate-500">
                  Cổng Sinh viên
                </span>
              </div>
            )}
          </Link>

          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 cursor-pointer text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
              onClick={handleCloseSidebar}
              title="Thu gọn thanh điều hướng"
              aria-label="Thu gọn thanh điều hướng"
            >
              <ChevronLeft className="hidden h-5 w-5 lg:block" />
              <X className="h-5 w-5 lg:hidden" />
            </Button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto p-3">
          {!sidebarCollapsed && (
            <div className="px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase select-none">
              Học vụ
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.href === "/student/overview" &&
                location.pathname === "/student");

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive ? "page" : undefined}
                title={sidebarCollapsed ? item.name : undefined}
                className={cn(
                  "group flex items-center rounded-lg text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sidebarCollapsed
                    ? "mx-auto h-11 w-11 justify-center"
                    : "justify-between px-3 py-2.5",
                  isActive
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900",
                )}
              >
                <div
                  className={cn(
                    "flex min-w-0 items-center",
                    sidebarCollapsed ? "justify-center" : "gap-3",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4.5 w-4.5 shrink-0 transition-colors",
                      isActive
                        ? "text-sidebar-accent-foreground"
                        : "text-slate-500 group-hover:text-slate-800",
                    )}
                    aria-hidden="true"
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </div>

                {!sidebarCollapsed && item.badge !== undefined && (
                  <Badge className="h-5 min-w-5 bg-primary px-1.5 font-mono text-xs font-semibold text-primary-foreground tabular-nums hover:bg-primary">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div
          className={cn(
            "border-t border-slate-200 transition-all",
            sidebarCollapsed ? "flex justify-center p-2.5" : "p-3.5",
          )}
        >
          <div
            className={cn(
              "flex items-center rounded-lg border border-slate-200 bg-white transition-all",
              sidebarCollapsed
                ? "h-10 w-10 justify-center"
                : "w-full gap-2.5 px-3 py-2.5",
            )}
            title={
              sidebarCollapsed
                ? `${activeSemesterLabel} · Đang hoạt động`
                : undefined
            }
          >
            <ShieldCheck
              className="h-4.5 w-4.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-xs font-semibold text-slate-900 tabular-nums">
                  {activeSemesterLabel}
                </p>
                <p className="truncate text-xs text-slate-500">
                  Học kỳ hiện hành
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-all duration-200 ease-in-out",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={toggleSidebar}
              aria-label={
                sidebarCollapsed
                  ? "Mở rộng thanh điều hướng"
                  : "Thu gọn thanh điều hướng"
              }
              title={
                sidebarCollapsed
                  ? "Mở rộng thanh điều hướng"
                  : "Thu gọn thanh điều hướng"
              }
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Breadcrumbs */}
            <nav
              aria-label="Đường dẫn trang"
              className="flex items-center gap-1.5 text-sm font-medium"
            >
              <span className="text-slate-500">Sinh viên</span>
              <ChevronRight
                className="h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <span className="font-semibold text-slate-900">
                {currentTitle}
              </span>
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <NotificationBell
              role="student"
              unreadCount={unreadCount}
              enabled={Boolean(user)}
            />

            <div className="h-5 w-px bg-slate-200" aria-hidden="true" />

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex cursor-pointer items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8 border border-slate-200">
                  <AvatarImage src={user?.avatar_url} alt={studentName} />
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                    {getInitials(studentName)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-900">
                    {studentName}
                  </p>
                  <p className="font-mono text-xs leading-tight text-slate-500 tabular-nums">
                    MSSV: {studentCode}
                  </p>
                </div>
                <ChevronDown
                  className="hidden h-4 w-4 text-slate-400 transition-transform group-data-popup-open:rotate-180 sm:block"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="mt-1 w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none text-slate-900">
                        {studentName}
                      </p>
                      {user?.email && (
                        <p className="truncate text-xs leading-none text-slate-500">
                          {user.email}
                        </p>
                      )}
                      <div className="pt-1">
                        <span className="inline-flex items-center rounded-md bg-sidebar-accent px-2 py-0.5 text-xs font-semibold text-sidebar-accent-foreground">
                          Tài khoản Sinh viên
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => navigate("/student/overview")}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4 text-slate-500" />
                    <span>Tổng quan học vụ</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => navigate("/student/record")}
                  >
                    <GraduationCap className="mr-2 h-4 w-4 text-slate-500" />
                    <span>Hồ sơ học tập</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => navigate("/student/settings")}
                  >
                    <User className="mr-2 h-4 w-4 text-slate-500" />
                    <span>Hồ sơ &amp; Cài đặt</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={() => logout()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
