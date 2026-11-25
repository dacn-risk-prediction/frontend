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
import { useAuthUser } from "@/features/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building, KeyRound, Mail, Shield } from "lucide-react";
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

const getInitials = (name: string): string => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

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

export const LecturerSettingsPage = () => {
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id;
  const { data: lecturerDetail } = useLecturerDetail(lecturerId);
  const updateProfileMutation = useUpdateLecturerProfile();

  const lecturerName = user?.name || "Giảng viên";
  const lecturerEmail = user?.email || "—";
  const lecturerCode = user?.user_code || lecturerId || "—";
  const department =
    lecturerDetail?.departments || user?.title || "Khoa KH & KT Máy tính";

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
      toast.success("Đã lưu thông tin giảng viên thành công!");
    } catch (err) {
      toast.error(
        extractError(err, "Không thể cập nhật hồ sơ giảng viên. Vui lòng thử lại."),
      );
    }
  });

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Cài đặt Tài khoản Giảng viên
          </h1>
          <Badge className="bg-blue-600 text-white font-medium">
            Hồ sơ &amp; Bảo mật
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Cập nhật họ tên, học vị, bộ môn công tác và mật khẩu tài khoản trực tiếp trên hệ thống.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Profile Summary */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Hồ sơ Giảng viên
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Thông tin định danh trên cổng Aurora Faculty
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 border-2 border-blue-200 ring-4 ring-blue-50">
              <AvatarImage src={user?.avatar_url} alt={lecturerName} />
              <AvatarFallback className="bg-blue-700 text-lg font-bold text-white">
                {getInitials(lecturerName)}
              </AvatarFallback>
            </Avatar>

            <h3 className="mt-4 text-base font-bold text-slate-900">
              {lecturerName}
            </h3>
            <p className="text-xs text-slate-500">{lecturerEmail}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"
              >
                Mã GV: {lecturerCode}
              </Badge>
              <Badge className="bg-slate-900 text-white text-xs">
                Giảng viên
              </Badge>
            </div>

            <div className="mt-6 w-full space-y-3 border-t border-slate-100 pt-5 text-left text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Building className="h-4 w-4 shrink-0 text-slate-400" />
                <span>{department}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Shield className="h-4 w-4 shrink-0 text-slate-400" />
                <span>Chức danh: {user?.title || "Giảng viên"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{lecturerEmail}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Real Settings Form */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">
              Chỉnh sửa Hồ sơ &amp; Bảo mật
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Cập nhật thông tin cá nhân, đơn vị công tác và mật khẩu đăng nhập.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={onSubmit} className="space-y-4">
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
                    {...form.register("name")}
                    className="h-9 text-xs"
                  />
                  {form.formState.errors.name && (
                    <p className="text-[11px] text-rose-600">
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
                    className="h-9 text-xs bg-slate-100 cursor-not-allowed text-slate-500"
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
                    className="h-9 text-xs"
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
                    {...form.register("departments")}
                    placeholder="VD: Khoa học Máy tính"
                    className="h-9 text-xs"
                  />
                  {form.formState.errors.departments && (
                    <p className="text-[11px] text-rose-600">
                      {form.formState.errors.departments.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <KeyRound className="h-3.5 w-3.5 text-blue-600" />
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
                      htmlFor="lecturer-confirm-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Xác nhận mật khẩu mới
                    </Label>
                    <Input
                      id="lecturer-confirm-password"
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateProfileMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
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
