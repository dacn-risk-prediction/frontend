import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useAuthUser, useLogout } from "@/features/auth";
import { useActiveSemester } from "@/hooks/use-active-semester";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useAuthUser();
  const logout = useLogout();
  const { data: activeSemester } = useActiveSemester();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("aurora_admin_sidebar_collapsed") === "true";
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
          localStorage.setItem("aurora_admin_sidebar_collapsed", String(next));
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
        localStorage.setItem("aurora_admin_sidebar_collapsed", "true");
      } catch {
        // ignore
      }
    }
  };

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        name: "Tổng quan Hệ thống",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
      },
      {
        name: "Quản lý Tài khoản",
        href: "/admin/users",
        icon: Users,
      },
      {
        name: "Quản lý Học kỳ",
        href: "/admin/semesters",
        icon: Calendar,
      },
      {
        name: "Danh mục Học vụ",
        href: "/admin/academics",
        icon: BookOpen,
      },
    ],
    [],
  );

  const currentNav = navItems.find(
    (item) =>
      location.pathname === item.href ||
      (item.href === "/admin/dashboard" && location.pathname === "/admin"),
  );
  const currentTitle = currentNav?.name || "Tổng quan Hệ thống";

  const adminName = user?.name || "Quản trị viên Hệ thống";
  const adminCode = user?.user_code || "ADMIN";
  const semesterDisplay = activeSemester?.semester_code || "HK261";

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-in-out",
          mobileMenuOpen ? "translate-x-0 w-64 shadow-xl" : "-translate-x-full",
          "lg:translate-x-0",
          sidebarCollapsed ? "lg:w-20" : "lg:w-64",
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-slate-100 transition-all duration-200",
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-6",
          )}
        >
          <Link
            to="/admin/dashboard"
            className="group flex items-center gap-2.5 focus:outline-hidden"
            onClick={() => setMobileMenuOpen(false)}
            title="Aurora Admin Portal"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-xs transition-transform group-hover:scale-105">
              <Sparkles className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="font-heading text-lg font-black tracking-wider text-slate-900 leading-none">
                  AURORA
                </span>
                <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase mt-0.5 truncate">
                  System Administration
                </span>
              </div>
            )}
          </Link>

          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-400 hover:text-slate-900 cursor-pointer shrink-0"
              onClick={handleCloseSidebar}
              title="Thu gọn thanh điều hướng"
              aria-label="Thu gọn thanh điều hướng"
            >
              <ChevronLeft className="h-5 w-5 hidden lg:block" />
              <X className="h-5 w-5 lg:hidden" />
            </Button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto overflow-x-hidden">
          <div
            className={cn(
              "text-[10px] font-bold tracking-wider text-slate-400 uppercase transition-all select-none",
              sidebarCollapsed ? "text-center pb-2 pt-1" : "px-3 pb-2 pt-1",
            )}
          >
            {sidebarCollapsed ? "ADMIN" : "Quản trị Hệ thống"}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.href === "/admin/dashboard" &&
                location.pathname === "/admin");

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                title={sidebarCollapsed ? item.name : undefined}
                className={cn(
                  "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-150",
                  sidebarCollapsed
                    ? "h-11 w-11 mx-auto justify-center"
                    : "px-3.5 py-2.5 gap-3",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive
                      ? "text-blue-700"
                      : "text-slate-500 group-hover:text-slate-800",
                  )}
                />
                {!sidebarCollapsed && (
                  <span className="truncate">{item.name}</span>
                )}

                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-blue-700" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div
          className={cn(
            "border-t border-slate-100 transition-all",
            sidebarCollapsed ? "p-2.5 flex justify-center" : "p-4",
          )}
        >
          <div
            className={cn(
              "flex items-center rounded-xl bg-slate-50 border border-slate-200/60 transition-all",
              sidebarCollapsed
                ? "h-11 w-11 justify-center"
                : "gap-3 p-3 w-full",
            )}
            title={
              sidebarCollapsed
                ? `Học kỳ hiện hành: ${semesterDisplay}`
                : undefined
            }
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-xs font-semibold text-slate-800">
                  Học kỳ {semesterDisplay}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {activeSemester?.academic_year
                    ? `Năm học ${activeSemester.academic_year}`
                    : "Phòng Đào tạo HCMUT"}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0 transition-all duration-200 ease-in-out",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              title={
                sidebarCollapsed
                  ? "Hiện thanh điều hướng"
                  : "Thu gọn thanh điều hướng"
              }
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-slate-400">Admin</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <span className="font-semibold text-slate-900">
                {currentTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex items-center gap-3 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-slate-100 focus:outline-hidden cursor-pointer">
                <Avatar className="h-8 w-8 border border-blue-200 ring-1 ring-blue-500/20">
                  <AvatarImage src={user?.avatar_url} alt={adminName} />
                  <AvatarFallback className="bg-blue-700 text-xs font-semibold text-white">
                    {getInitials(adminName)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-800">
                    {adminName}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-500">
                    {adminCode} • Administrator
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-data-popup-open:rotate-180 hidden sm:block" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60 mt-1">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold text-slate-900 leading-none">
                        {adminName}
                      </p>
                      <p className="text-xs text-slate-500 leading-none truncate">
                        {user?.email || ""}
                      </p>
                      <div className="pt-1">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          System Admin
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        className="cursor-pointer"
                        onClick={() => navigate(item.href)}
                      >
                        <Icon className="mr-2 h-4 w-4 text-slate-500" />
                        <span>{item.name}</span>
                      </DropdownMenuItem>
                    );
                  })}
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

        {/* Page Content */}
        <main className="flex-1 bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
