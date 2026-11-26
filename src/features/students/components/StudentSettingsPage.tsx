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
import { extractApiError } from "@/lib/format";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  RefreshCw,
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

export const StudentSettingsPage = () => {
  const { data: user, isLoading: isLoadingUser } = useAuthUser();
  const studentId = user?.user_code || user?.id;
  const {
    data: studentDetail,
    isLoading: isLoadingDetail,
    isError: isDetailError,
    refetch: refetchDetail,
  } = useStudentDetail(studentId);
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
      toast.success("Đã cập nhật thông tin tài khoản thành công.");
    } catch (err) {
      toast.error(
        extractApiError(err, "Không thể cập nhật thông tin. Vui lòng thử lại."),
      );
    }
  });

  const ctxhDays = Number(studentDetail?.ctxh_days ?? 0);

  const profileFields = [
    {
      label: "Mã số sinh viên (MSSV)",
      value: user?.user_code || "—",
      mono: true,
    },
    {
      label: "Email nhà trường",
      value: user?.email || "—",
      mono: false,
    },
    {
      label: "Khóa đào tạo",
      value: studentDetail?.cohort || "—",
      mono: true,
    },
    {
      label: "Ngành đào tạo",
      value: studentDetail?.major || "—",
      mono: false,
    },
    {
      label: "Chương trình đào tạo",
      value: studentDetail?.program || "Chính quy chuẩn",
      mono: false,
    },
    {
      label: "Chuyên ngành / Định hướng",
      value: studentDetail?.specialization || "Chưa phân chuyên ngành",
      mono: false,
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Cài đặt tài khoản &amp; Hồ sơ sinh viên
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Xem hồ sơ học vụ đồng bộ từ nhà trường và cập nhật tên hiển thị hoặc
          mật khẩu đăng nhập.
        </p>
      </header>

      {isDetailError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle
              className="h-4 w-4 shrink-0 text-rose-600"
              aria-hidden="true"
            />
            <span>Không thể tải hồ sơ học vụ chi tiết. Vui lòng thử lại.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchDetail()}
            className="h-8 w-fit cursor-pointer gap-1.5 border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Academic Profile + Account Update Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Flattened Academic Profile Card (Hairline-First Rule) */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <GraduationCap
                  className="h-4.5 w-4.5 text-primary"
                  aria-hidden="true"
                />
                Hồ sơ học vụ
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Thông tin chính thức do Phòng Đào tạo quản lý (chỉ xem).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingUser || isLoadingDetail ? (
                <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="space-y-2 border-b border-slate-100 p-4">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-4 w-44" />
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2">
                  {profileFields.map((field, idx) => (
                    <div
                      key={field.label}
                      className={cn(
                        "px-5 py-3.5",
                        idx % 2 === 1 && "sm:border-l sm:border-slate-100",
                      )}
                    >
                      <dt className="text-xs font-semibold text-slate-500">
                        {field.label}
                      </dt>
                      <dd
                        className={cn(
                          "mt-1 truncate text-sm font-semibold text-slate-900",
                          field.mono && "font-mono tabular-nums",
                        )}
                      >
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Editable Account & Password Form */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <User className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                Cập nhật thông tin &amp; Đổi mật khẩu
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Thay đổi được lưu trực tiếp cho tài khoản đang đăng nhập.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="student-name" className="text-xs font-semibold">
                    Họ và tên hiển thị
                  </Label>
                  <Input
                    id="student-name"
                    aria-invalid={Boolean(form.formState.errors.name)}
                    {...form.register("name")}
                    className="h-9 text-sm"
                  />
                  {form.formState.errors.name && (
                    <p role="alert" className="text-xs text-rose-600">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <KeyRound
                      className="h-3.5 w-3.5 text-primary"
                      aria-hidden="true"
                    />
                    Đổi mật khẩu đăng nhập (để trống nếu giữ nguyên mật khẩu hiện tại)
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                        aria-invalid={Boolean(form.formState.errors.password)}
                        {...form.register("password")}
                        placeholder="Tối thiểu 6 ký tự"
                        className="h-9 text-sm"
                      />
                      {form.formState.errors.password && (
                        <p role="alert" className="text-xs text-rose-600">
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
                        aria-invalid={Boolean(
                          form.formState.errors.confirmPassword,
                        )}
                        {...form.register("confirmPassword")}
                        placeholder="Nhập lại mật khẩu mới"
                        className="h-9 text-sm"
                      />
                      {form.formState.errors.confirmPassword && (
                        <p role="alert" className="text-xs text-rose-600">
                          {form.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <Button
                    type="submit"
                    disabled={updateAccountMutation.isPending}
                    className="h-9 cursor-pointer bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-blue-hover"
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

        {/* Right Column: Flattened Graduation Snapshot */}
        <div>
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ShieldCheck
                  className="h-4.5 w-4.5 text-primary"
                  aria-hidden="true"
                />
                Điều kiện đầu ra
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Trạng thái chuẩn ngoại ngữ và ngày CTXH
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 p-0">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-800">
                    Chuẩn ngoại ngữ
                  </span>
                </div>
                {isLoadingDetail ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold",
                      studentDetail?.english_pass
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800",
                    )}
                  >
                    {studentDetail?.english_pass ? "Đã đạt" : "Chưa đạt"}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  <HeartHandshake
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Ngày CTXH
                  </span>
                </div>
                {isLoadingDetail ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {ctxhDays} / 15 ngày
                  </span>
                )}
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>Tài khoản đang hoạt động</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 tabular-nums">
                  Vai trò: Sinh viên · MSSV {user?.user_code || "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
