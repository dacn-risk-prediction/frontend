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
import { useAuthUser, useLogout } from "@/features/auth";
import { cn } from "@/lib/utils";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Overview",
    href: "/student/overview",
    icon: LayoutDashboard,
  },
  {
    name: "Academic Record",
    href: "/student/record",
    icon: GraduationCap,
  },
  {
    name: "What-If Simulator",
    href: "/student/what-if",
    icon: Sparkles,
  },
  {
    name: "Alerts",
    href: "/student/alerts",
    icon: Bell,
    badge: 2,
  },
  {
    name: "Settings",
    href: "/student/settings",
    icon: Settings,
  },
];

export const StudentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useAuthUser();
  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const studentName = user?.name || "Nguyễn Văn A";
  const studentCode = user?.user_code || "2011928";

  // Get current active navigation label for breadcrumb
  const currentNav = NAV_ITEMS.find(
    (item) =>
      location.pathname === item.href ||
      (item.href === "/student/overview" && location.pathname === "/student"),
  );
  const currentTitle = currentNav?.name || "Overview";

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
          <Link
            to="/student/overview"
            className="group flex flex-col focus:outline-hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white shadow-xs">
                <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
              </div>
              <span className="font-heading text-lg font-black tracking-wider text-slate-900">
                AURORA
              </span>
            </div>
            <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
              Academic Intelligence
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden text-slate-500 hover:text-slate-900"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Main Portal
          </div>
          {NAV_ITEMS.map((item) => {
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
                className={cn(
                  "group relative flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isActive
                        ? "text-blue-700"
                        : "text-slate-400 group-hover:text-slate-700",
                    )}
                  />
                  <span>{item.name}</span>
                </div>

                {item.badge !== undefined && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-5 px-1.5 font-mono text-[11px] font-bold"
                  >
                    {item.badge}
                  </Badge>
                )}

                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-blue-700" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200/60">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">
                Semester 261
              </p>
              <p className="truncate text-[11px] text-slate-500">
                Term Active • HCMUT
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="flex flex-1 flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden text-slate-600 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-slate-400">Dashboard</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <span className="font-semibold text-slate-900">
                {currentTitle}
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-4">
            {/* Notification Bell with Red Dot */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full"
              onClick={() => navigate("/student/alerts")}
              aria-label="View notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
            </Button>

            <div className="h-5 w-px bg-slate-200" />

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex items-center gap-3 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-slate-100 focus:outline-hidden">
                <Avatar className="h-8 w-8 border border-blue-200 ring-1 ring-blue-500/20">
                  <AvatarImage src={user?.avatar_url} alt={studentName} />
                  <AvatarFallback className="bg-blue-700 text-xs font-semibold text-white">
                    {getInitials(studentName)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-800">
                    {studentName}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-500">
                    ID: {studentCode}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-data-popup-open:rotate-180 hidden sm:block" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 mt-1">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold text-slate-900 leading-none">
                        {studentName}
                      </p>
                      <p className="text-xs text-slate-500 leading-none">
                        {user?.email || "phamquocanh.2698615@hcmut.edu.vn"}
                      </p>
                      <div className="pt-1">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Student Account
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
                    <span>Overview Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => navigate("/student/record")}
                  >
                    <GraduationCap className="mr-2 h-4 w-4 text-slate-500" />
                    <span>Academic Record</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => navigate("/student/settings")}
                  >
                    <User className="mr-2 h-4 w-4 text-slate-500" />
                    <span>Profile & Settings</span>
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
                    <span>Sign out</span>
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
