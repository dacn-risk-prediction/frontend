import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/features/auth";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Globe,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  useStudentDetail,
  useUpdateStudentAccount,
} from "../api/student-api";

const studentProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Họ và tên cần ít nhất 2 ký tự")
      .max(100, "Họ và tên tối đa 100 ký tự"),
    password: z
      .string()
      .refine(
        (val) => val.length === 0 || val.length >= 6,
        "Mật khẩu mới cần tối thiểu 6 ký tự",
      ),
    confirmPassword: z.string(),
  })
  .refine(
    (data) => !data.password || data.password === data.confirmPassword,
    {
      message: "Mật khẩu xác nhận không khớp",
      path: ["confirmPassword"],
    },
  );

type StudentProfileFormValues = z.infer<typeof studentProfileSchema>;

function extractError(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { detail?: unknown } } }).response
      ?.data?.detail === "string"
  ) {
    return (err as { response: { data: { detail: string } } }).response.data
      .detail;
  }
  return fallback;
}

export const StudentSettingsPage = () => {
  const { data: user, isLoading: isLoadingUser } = useAuthUser();
  const studentId = user?.user_code || user?.id;
  const { data: studentDetail, isLoading: isLoadingDetail } =
    useStudentDetail(studentId);
  const updateAccountMutation = useUpdateStudentAccount();

  const form = useForm<StudentProfileFormValues>({
    resolver: zodResolver(studentProfileSchema),
    defaultValues: {
      name: user?.name || "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (user?.name) {
      form.reset({
        name: user.name,
        password: "",
        confirmPassword: "",
      });
    }
  }, [user?.name, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.id) return;
    try {
      await updateAccountMutation.mutateAsync({
        userId: user.id,
        payload: {
          name: values.name,
          ...(values.password.trim()
            ? { password: values.password.trim() }
            : {}),
        },
      });
      form.setValue("password", "");
      form.setValue("confirmPassword", "");
      toast.success("Đã cập nhật thông tin tài khoản thành công!");
    } catch (err) {
      toast.error(
        extractError(err, "Không thể cập nhật thông tin. Vui lòng thử lại."),
      );
    }
  });

  const ctxhDays = Number(studentDetail?.ctxh_days ?? 0);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Cài đặt Tài khoản &amp; Hồ sơ Sinh viên
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Xem hồ sơ học vụ đồng bộ từ hệ thống và cập nhật tên hiển thị hoặc mật khẩu đăng nhập.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Academic Profile + Account Update Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Academic Profile Card (Read-only from StudentDetail) */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <GraduationCap className="h-5 w-5 text-blue-700" />
                Hồ sơ Học vụ (SIS)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Dữ liệu chính thức từ phòng Đào tạo (chỉ quản trị viên có quyền chỉnh sửa).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoadingUser || isLoadingDetail ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Mã số Sinh viên (MSSV)
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {user?.user_code || "—"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Email Nhà trường
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900">
                      {user?.email || "—"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Khóa học (Cohort)
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {studentDetail?.cohort || "—"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Ngành đào tạo
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {studentDetail?.major || "—"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Chương trình đào tạo
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {studentDetail?.program || "Chính quy chuẩn"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Chuyên ngành / Định hướng
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {studentDetail?.specialization || "Chưa phân chuyên ngành"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editable Account & Password Form (Real PUT /users/{id}) */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <User className="h-5 w-5 text-blue-700" />
                Cập nhật Thông tin &amp; Đổi Mật khẩu
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Thay đổi được lưu trực tiếp lên máy chủ qua tài khoản hiện hành.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="student-name" className="text-xs font-semibold">
                    Họ và tên hiển thị
                  </Label>
                  <Input
                    id="student-name"
                    {...form.register("name")}
                    className="h-9 text-xs"
                  />
                  {form.formState.errors.name && (
                    <p className="text-[11px] text-rose-600">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                    Đổi mật khẩu đăng nhập (để trống nếu không muốn đổi)
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="student-password"
                        className="text-xs font-semibold"
                      >
                        Mật khẩu mới
                      </Label>
                      <Input
                        id="student-password"
                        type="password"
                        {...form.register("password")}
                        placeholder="Tối thiểu 6 ký tự"
                        className="h-9 text-xs"
                      />
                      {form.formState.errors.password && (
                        <p className="text-[11px] text-rose-600">
                          {form.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="student-confirm-password"
                        className="text-xs font-semibold"
                      >
                        Xác nhận mật khẩu mới
                      </Label>
                      <Input
                        id="student-confirm-password"
                        type="password"
                        {...form.register("confirmPassword")}
                        placeholder="Nhập lại mật khẩu mới"
                        className="h-9 text-xs"
                      />
                      {form.formState.errors.confirmPassword && (
                        <p className="text-[11px] text-rose-600">
                          {form.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updateAccountMutation.isPending}
                    className="cursor-pointer bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    {updateAccountMutation.isPending
                      ? "Đang lưu..."
                      : "Lưu thay đổi"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Graduation Requirements Snapshot & Session Security */}
        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ShieldCheck className="h-5 w-5 text-blue-700" />
                Điều kiện Đầu ra
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Trạng thái ngoại ngữ và Công tác xã hội
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-800">
                    Chuẩn Tiếng Anh
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] font-semibold",
                    studentDetail?.english_pass
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {studentDetail?.english_pass ? "Đã đạt" : "Chưa đạt"}
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-800">
                    Ngày CTXH
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900">
                  {ctxhDays} / 15 ngày
                </span>
              </div>

              <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Phiên đăng nhập JWT an toàn</span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Tài khoản đang hoạt động với vai trò Sinh viên ({user?.user_code || "—"}).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
