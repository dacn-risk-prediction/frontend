import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractApiError } from "@/lib/format";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getCurrentUser, useLogin } from "../api/auth-api";
import { loginSchema, type LoginFormValues } from "../schemas/login-schema";
import { ROLE_DEFAULT_REDIRECT } from "../types";

const PLATFORM_HIGHLIGHTS = [
  "Theo dõi 3 trụ cột tốt nghiệp theo thời gian thực (Học vụ, Ngoại ngữ, CTXH).",
  "Dự báo rủi ro học phần minh bạch bằng Explainable AI (XAI) & gợi ý cải thiện.",
  "Kết nối trực tiếp giữa sinh viên và giảng viên cố vấn trên cùng hồ sơ học tập.",
];

export const LoginForm = () => {
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await loginMutation.mutateAsync(values);
      const user = await getCurrentUser();
      toast.success(`Chào mừng trở lại, ${user.full_name}!`);
      navigate(ROLE_DEFAULT_REDIRECT[user.role], { replace: true });
    } catch (err: unknown) {
      toast.error(
        extractApiError(
          err,
          "Thông tin đăng nhập chưa đúng hoặc tài khoản chưa được kích hoạt.",
        ),
      );
    }
  };

  const handleForgotPassword = () => {
    toast.info(
      "Vui lòng liên hệ Phòng Đào tạo hoặc quản trị viên hệ thống để được cấp lại mật khẩu.",
    );
  };

  const handleRequestAccount = () => {
    toast.info(
      "Tài khoản được cấp đồng bộ theo danh sách Phòng Đào tạo. Liên hệ cố vấn học vụ nếu cần hỗ trợ.",
    );
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 font-sans text-slate-900 antialiased sm:p-6 lg:p-10">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs md:grid-cols-12">
        {/* Left Column: Surface White Institutional Ledger Panel */}
        <section className="flex flex-col justify-between border-b border-slate-200 bg-white p-7 sm:p-10 md:col-span-6 md:border-r md:border-b-0 lg:p-12">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-base font-extrabold tracking-wide text-slate-900 leading-none">
                  AURORA
                </span>
                <span className="mt-0.5 text-xs font-medium text-slate-500">
                  Cổng Học vụ &amp; Dự báo XAI
                </span>
              </div>
            </div>

            <div className="mt-10 sm:mt-12">
              <h1 className="font-heading text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl leading-snug">
                Nhận diện rủi ro sớm. Đồng hành học tập minh bạch.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
                Hệ thống theo dõi tiến độ học vụ, giải thích dự báo kết quả học
                phần bằng XAI và hỗ trợ cố vấn trực tuyến dành cho sinh viên,
                giảng viên và quản trị đào tạo.
              </p>

              <ul className="mt-8 divide-y divide-slate-100 border-y border-slate-100">
                {PLATFORM_HIGHLIGHTS.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 py-3 text-sm leading-relaxed text-slate-700"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs font-medium text-slate-500">
            <ShieldCheck
              className="h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              Mọi dự báo AI đều đi kèm giải thích dữ liệu thật và không thay thế
              quyết định chuyên môn của cố vấn.
            </span>
          </div>
        </section>

        {/* Right Column: Obsidian Anchor Sign-In Panel */}
        <section className="flex flex-col justify-between bg-slate-900 p-7 text-white sm:p-10 md:col-span-6 lg:p-12">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-white">
              Đăng nhập hệ thống
            </h2>
            <p className="mt-1.5 text-sm text-slate-300">
              Sử dụng tài khoản email nhà trường đã được cấp để truy cập cổng
              thông tin.
            </p>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-8 space-y-5"
              noValidate
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold text-slate-200"
                >
                  Email nhà trường
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ten.nguoidung@hcmut.edu.vn"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                  className="h-10 border-slate-700 bg-slate-800/90 px-3 text-sm text-white placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/40"
                />
                {errors.email && (
                  <p role="alert" className="text-xs text-rose-300">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold text-slate-200"
                  >
                    Mật khẩu
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="cursor-pointer text-xs font-medium text-sky-300 underline-offset-4 transition-colors hover:text-white hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu của bạn"
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                  className="h-10 border-slate-700 bg-slate-800/90 px-3 text-sm text-white placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/40"
                />
                {errors.password && (
                  <p role="alert" className="text-xs text-rose-300">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || loginMutation.isPending}
                className="h-10 w-full cursor-pointer gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-brand-blue-hover"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>
          </div>

          <div className="mt-10 space-y-3 border-t border-slate-800 pt-5 text-center">
            <p className="text-xs text-slate-300">
              Chưa có tài khoản truy cập?{" "}
              <button
                type="button"
                onClick={handleRequestAccount}
                className="cursor-pointer font-semibold text-sky-300 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                Xem hướng dẫn cấp tài khoản
              </button>
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              Bằng việc đăng nhập, bạn đồng ý tuân thủ quy định bảo mật dữ liệu
              học vụ của nhà trường.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};
