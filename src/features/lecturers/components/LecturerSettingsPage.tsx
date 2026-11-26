import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { extractApiError, getInitials } from "@/lib/format";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Building,
  KeyRound,
  Mail,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  useLecturerDetail,
  useUpdateLecturerProfile,
} from "../api/lecturer-api";

const lecturerSettingsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Họ và tên cần ít nhất 2 ký tự")
      .max(100, "Họ và tên tối đa 100 ký tự"),
    title: z.string().trim().max(100).optional(),
    departments: z
      .string()
      .trim()
      .min(2, "Tên khoa / bộ môn cần ít nhất 2 ký tự")
      .max(100),
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

type LecturerSettingsFormValues = z.infer<typeof lecturerSettingsSchema>;

export const LecturerSettingsPage = () => {
  const { data: user, isLoading: isLoadingUser } = useAuthUser();
  const lecturerId = user?.user_code || user?.id;
  const {
    data: lecturerDetail,
    isLoading: isLoadingDetail,
    isError: isDetailError,
    refetch: refetchDetail,
  } = useLecturerDetail(lecturerId);
  const updateProfileMutation = useUpdateLecturerProfile();

  const lecturerName = user?.name || "Giảng viên";
  const lecturerEmail = user?.email || "—";
  const lecturerCode = user?.user_code || lecturerId || "—";
  const department =
    lecturerDetail?.departments || user?.title || "Chưa cập nhật đơn vị";

  const form = useForm<LecturerSettingsFormValues>({
    resolver: zodResolver(lecturerSettingsSchema),
    defaultValues: {
      name: user?.name || "",
      title: user?.title || "",
      departments: lecturerDetail?.departments || "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    form.reset({
      name: user?.name || "",
      title: user?.title || "",
      departments: lecturerDetail?.departments || "",
      password: "",
      confirmPassword: "",
    });
  }, [user?.name, user?.title, lecturerDetail?.departments, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.id) return;
    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        lecturerId: lecturerDetail?.lecturer_id || user.user_code,
        userPayload: {
          name: values.name,
          title: values.title?.trim() || null,
          ...(values.password.trim()
            ? { password: values.password.trim() }
            : {}),
        },
        lecturerPayload: {
          departments: values.departments,
        },
      });
      form.setValue("password", "");
      form.setValue("confirmPassword", "");
      toast.success("Đã lưu thông tin giảng viên thành công.");
    } catch (err) {
      toast.error(
        extractApiError(
          err,
          "Không thể cập nhật hồ sơ giảng viên. Vui lòng thử lại.",
        ),
      );
    }
  });

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Header */}
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Cài đặt tài khoản giảng viên
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Cập nhật họ tên, học vị, đơn vị công tác và mật khẩu đăng nhập trên hệ
          thống.
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
            <span>Không thể tải hồ sơ giảng viên chi tiết. Vui lòng thử lại.</span>
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
        {/* Left Column: Profile Summary */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">
              Hồ sơ giảng viên
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Thông tin định danh trên cổng giảng viên
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {isLoadingUser || isLoadingDetail ? (
              <div className="flex flex-col items-center space-y-3 py-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="mt-4 h-20 w-full rounded-lg" />
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-16 w-16 border border-slate-200">
                  <AvatarImage src={user?.avatar_url} alt={lecturerName} />
                  <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground">
                    {getInitials(lecturerName)}
                  </AvatarFallback>
                </Avatar>

                <h2 className="mt-3 text-base font-bold text-slate-900">
                  {lecturerName}
                </h2>
                <p className="text-xs text-slate-500">{lecturerEmail}</p>

                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-sidebar-accent font-mono text-xs font-semibold text-sidebar-accent-foreground tabular-nums"
                  >
                    Mã GV: {lecturerCode}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-100 text-xs font-semibold text-slate-800"
                  >
                    Giảng viên
                  </Badge>
                </div>

                <dl className="mt-5 w-full divide-y divide-slate-100 border-t border-slate-100 text-left text-xs">
                  <div className="flex items-center gap-2.5 py-3 text-slate-700">
                    <Building
                      className="h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>{department}</span>
                  </div>
                  <div className="flex items-center gap-2.5 py-3 text-slate-700">
                    <Shield
                      className="h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>Chức danh: {user?.title || "Giảng viên"}</span>
                  </div>
                  <div className="flex items-center gap-2.5 py-3 text-slate-700">
                    <Mail
                      className="h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <span className="truncate">{lecturerEmail}</span>
                  </div>
                </dl>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Settings Form */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">
              Chỉnh sửa hồ sơ &amp; Bảo mật
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Cập nhật thông tin cá nhân, đơn vị công tác và mật khẩu đăng nhập.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="lecturer-name"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Họ và tên *
                  </Label>
                  <Input
                    id="lecturer-name"
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

                <div className="space-y-1.5">
                  <Label
                    htmlFor="lecturer-email"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Email công vụ
                  </Label>
                  <Input
                    id="lecturer-email"
                    type="email"
                    value={lecturerEmail}
                    disabled
                    className="h-9 cursor-not-allowed bg-slate-100 text-sm text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="lecturer-title"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Học vị / Chức danh
                  </Label>
                  <Input
                    id="lecturer-title"
                    {...form.register("title")}
                    placeholder="VD: TS., ThS., PGS.TS."
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="lecturer-departments"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Khoa / Bộ môn *
                  </Label>
                  <Input
                    id="lecturer-departments"
                    aria-invalid={Boolean(form.formState.errors.departments)}
                    {...form.register("departments")}
                    placeholder="VD: Khoa học Máy tính"
                    className="h-9 text-sm"
                  />
                  {form.formState.errors.departments && (
                    <p role="alert" className="text-xs text-rose-600">
                      {form.formState.errors.departments.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <KeyRound
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  Đổi mật khẩu (để trống nếu giữ nguyên mật khẩu hiện tại)
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="lecturer-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Mật khẩu mới
                    </Label>
                    <Input
                      id="lecturer-password"
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
                      htmlFor="lecturer-confirm-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Xác nhận mật khẩu mới
                    </Label>
                    <Input
                      id="lecturer-confirm-password"
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

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="h-9 cursor-pointer bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-blue-hover"
                >
                  {updateProfileMutation.isPending
                    ? "Đang lưu..."
                    : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
