import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveSemester } from "@/hooks/use-active-semester";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Cpu,
  GraduationCap,
  Layers,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminSystemStats, useModelHealth } from "../api/admin-api";

function flattenMetrics(metrics: Record<string, unknown>): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [];
  for (const [key, val] of Object.entries(metrics)) {
    if (typeof val === "number") {
      rows.push({
        key,
        value: Number.isInteger(val) ? String(val) : val.toFixed(4),
      });
    } else if (typeof val === "string" || typeof val === "boolean") {
      rows.push({ key, value: String(val) });
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
        if (typeof subVal === "number") {
          rows.push({
            key: `${key}.${subKey}`,
            value: Number.isInteger(subVal) ? String(subVal) : subVal.toFixed(4),
          });
        }
      }
    }
  }
  return rows.slice(0, 8);
}

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { data: activeSemester } = useActiveSemester();
  const { data: stats, isLoading: isLoadingStats } = useAdminSystemStats();
  const {
    data: modelHealth,
    isLoading: isLoadingHealth,
    isFetching: isFetchingHealth,
    refetch: refetchHealth,
  } = useModelHealth();

  const studentsCount = stats?.students_count ?? 0;
  const lecturersCount = stats?.lecturers_count ?? 0;
  const adminsCount = stats?.admins_count ?? 0;
  const totalAccounts = stats?.users_count ?? studentsCount + lecturersCount + adminsCount;
  const coursesCount = stats?.courses_count ?? 0;
  const activeClassesCount = stats?.active_classes_count ?? 0;
  const semestersCount = stats?.semesters_count ?? 0;
  const curriculumsCount = stats?.curriculums_count ?? 0;

  const roleChartData = useMemo(
    () => [
      { name: "Sinh viên", count: studentsCount, color: "#2563EB" },
      { name: "Giảng viên", count: lecturersCount, color: "#0D9488" },
      { name: "Quản trị viên", count: adminsCount, color: "#4F46E5" },
    ],
    [studentsCount, lecturersCount, adminsCount],
  );

  const metricRows = useMemo(
    () => (modelHealth?.metrics ? flattenMetrics(modelHealth.metrics) : []),
    [modelHealth],
  );

  const isModelOnline = Boolean(modelHealth && modelHealth.model_status === "loaded");

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Trung tâm Quản trị Hệ thống
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi tổng quan người dùng, danh mục học vụ, học kỳ hiện hành và trạng thái AI Model Service.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/users")}
            className="cursor-pointer gap-1.5 text-xs"
          >
            <Users className="h-3.5 w-3.5 text-blue-600" />
            <span>Quản lý Tài khoản</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/admin/semesters")}
            className="cursor-pointer gap-1.5 bg-blue-600 text-xs text-white hover:bg-blue-700"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Cấu hình Học kỳ</span>
          </Button>
        </div>
      </div>

      {/* 4 Dark KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Profiles */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Tổng Hồ sơ Người dùng
              </p>
              <div className="mt-2">
                {isLoadingStats ? (
                  <Skeleton className="h-9 w-20 bg-slate-800" />
                ) : (
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {totalAccounts.toLocaleString("vi-VN")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {studentsCount.toLocaleString("vi-VN")} SV • {lecturersCount.toLocaleString("vi-VN")} GV • {adminsCount.toLocaleString("vi-VN")} Admin
          </p>
        </div>

        {/* KPI 2: Courses & Active Classes */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Môn học &amp; Lớp mở
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                {isLoadingStats ? (
                  <Skeleton className="h-9 w-24 bg-slate-800" />
                ) : (
                  <>
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      {coursesCount.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs font-semibold text-blue-400">
                      / {activeClassesCount.toLocaleString("vi-VN")} lớp kỳ này
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-emerald-400">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Đồng bộ danh mục học phần &amp; phân công giảng dạy
          </p>
        </div>

        {/* KPI 3: Active Semester */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Học kỳ Hiện hành
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-emerald-400">
                  {activeSemester?.semester_code || stats?.active_semester_code || "—"}
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-amber-400">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 truncate text-xs text-slate-400">
            {activeSemester?.withdraw_deadline
              ? `Hạn rút môn: ${new Date(activeSemester.withdraw_deadline).toLocaleDateString("vi-VN")}`
              : `${semestersCount} học kỳ đã cấu hình`}
          </p>
        </div>

        {/* KPI 4: Curriculums */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Khung Chương trình ĐT
              </p>
              <div className="mt-2">
                {isLoadingStats ? (
                  <Skeleton className="h-9 w-16 bg-slate-800" />
                ) : (
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {curriculumsCount}
                  </span>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-indigo-400">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Khối kiến thức &amp; quy định tiên quyết theo khóa
          </p>
        </div>
      </div>

      {/* Main Content: AI Model Health + Role Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* AI Model Service Health Card (7 cols) */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-7">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Cpu className="h-4.5 w-4.5 text-blue-600" />
                Trạng thái AI Model Service (:8001)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Giám sát kết nối tới dịch vụ dự báo rủi ro học tập XGBoost + TreeSHAP + Counterfactual
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetchingHealth}
              onClick={() => void refetchHealth()}
              className="cursor-pointer gap-1.5 text-xs"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isFetchingHealth && "animate-spin")}
              />
              <span>Kiểm tra lại</span>
            </Button>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {isLoadingHealth ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : isModelOnline && modelHealth ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-950">
                          {modelHealth.service || "Model Serving Service"}
                        </span>
                        <Badge className="bg-emerald-600 text-[10px] font-bold text-white">
                          ONLINE • {modelHealth.model_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Ngưỡng cảnh báo rớt môn:{" "}
                        <strong>{(modelHealth.fail_threshold * 100).toFixed(1)}%</strong> • Bộ nhớ
                        đệm: <strong>{modelHealth.total_records_cached.toLocaleString("vi-VN")}</strong>{" "}
                        bản ghi
                      </p>
                    </div>
                  </div>
                </div>

                {metricRows.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Chỉ số Mô hình (Model Metrics)
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {metricRows.map((row) => (
                        <div
                          key={row.key}
                          className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
                        >
                          <p
                            className="truncate text-[10px] font-semibold uppercase text-slate-500"
                            title={row.key}
                          >
                            {row.key}
                          </p>
                          <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                            {row.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-amber-950">
                        AI Model Service hiện không phản hồi (503 / Offline)
                      </span>
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-white text-[10px] font-bold text-amber-700"
                      >
                        OFFLINE
                      </Badge>
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Các chức năng quản trị tài khoản, học kỳ, học vụ và cố vấn vẫn hoạt động bình
                      thường. Vui lòng kiểm tra tiến trình <code className="font-mono">uvicorn serve:app --port 8001</code>{" "}
                      trong thư mục <code className="font-mono">model</code> để bật lại dự báo AI &amp; Counterfactual.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Role Distribution Chart (5 cols) */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-5">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Activity className="h-4.5 w-4.5 text-blue-600" />
              Phân bổ Hồ sơ Theo Vai trò
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Số lượng bản ghi thực tế từ các bảng sinh viên, giảng viên và quản trị
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={roleChartData}
                  margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                    contentStyle={{
                      borderRadius: "0.75rem",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" name="Số lượng" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {roleChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Shortcuts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            title: "Quản lý Tài khoản Users",
            description: "Tìm kiếm, lọc vai trò, phân trang và thêm/sửa/xóa tài khoản hệ thống.",
            href: "/admin/users",
            icon: Users,
          },
          {
            title: "Cấu hình Học kỳ & Hạn rút môn",
            description: "Chuyển học kỳ hiện hành và cập nhật mốc thời hạn rút môn học cho sinh viên.",
            href: "/admin/semesters",
            icon: Server,
          },
          {
            title: "Danh mục Học vụ & Khung CTĐT",
            description: "Quản lý môn học, lớp học phần và tra cứu cấu trúc khối kiến thức các khóa.",
            href: "/admin/academics",
            icon: Layers,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left shadow-xs transition-all hover:border-blue-300 hover:shadow-sm cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600">
                <span>Mở quản trị</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
