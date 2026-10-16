import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { BarChart3, ShieldCheck, ArrowRight, Loader2 } from "lucide-react"
import { useLogin, getCurrentUser } from "../api/auth-api"
import { ROLE_DEFAULT_REDIRECT } from "../types"
import { loginSchema, type LoginFormValues } from "../schemas/login-schema"

export const LoginForm = () => {
  const navigate = useNavigate()
  const loginMutation = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await loginMutation.mutateAsync(values)
      const user = await getCurrentUser()
      toast.success(`Welcome back, ${user.full_name}!`)
      navigate(ROLE_DEFAULT_REDIRECT[user.role], { replace: true })
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { data?: { detail?: string | { msg?: string }[] } } }).response
        const detail = response?.data?.detail
        if (typeof detail === "string") {
          toast.error(detail)
          return
        }
        if (Array.isArray(detail) && detail[0]?.msg) {
          toast.error(detail[0].msg)
          return
        }
      }
      toast.error("Invalid credentials or inactive account.")
    }
  }

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault()
    toast.info("Please contact your IT administrator to reset your password.")
  }

  const handleRequestAccount = (e: React.MouseEvent) => {
    e.preventDefault()
    toast.info("Please contact your department chair or academic office for account provisioning.")
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-brand-dark p-4 sm:p-6 lg:p-10 font-sans antialiased">
      {/* Ambient background glow adhering to standard scale tokens (h-150, h-175, h-188, w-250) */}
      <div className="pointer-events-none absolute -top-48 -left-48 h-150 w-150 rounded-full bg-brand-blue/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-48 h-175 w-175 rounded-full bg-brand-navy/45 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-188 w-250 rounded-full bg-radial from-brand-navy/20 via-transparent to-brand-blue/10 blur-3xl" />

      {/* Main Dual-Panel Auth Container adhering to standard max-w-245 (980px) and rounded-3xl */}
      <div className="relative z-10 grid w-full max-w-245 grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-brand-card-inner/90 shadow-2xl shadow-black/80 backdrop-blur-2xl md:grid-cols-2">
        
        {/* Left Column: Light Institutional Showcase Panel */}
        <div className="flex flex-col justify-between bg-brand-card-light p-8 sm:p-10 lg:p-12 text-neutral-900">
          <div>
            {/* Brand Logo Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-300/80 shadow-inner">
                <BarChart3 className="size-5 text-brand-navy" />
              </div>
              <span className="text-sm font-extrabold tracking-widest text-neutral-800 uppercase">
                AURORA
              </span>
            </div>

            {/* Core Value Proposition Copy */}
            <div className="mt-14 sm:mt-16">
              <span className="block text-xs font-bold tracking-widest text-neutral-500 uppercase">
                Academic Intelligence
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl leading-tight">
                See risk sooner.<br />
                Support students<br />
                better.
              </h1>
              <p className="mt-5 text-sm sm:text-base leading-relaxed text-neutral-600 max-w-sm">
                An explainable AI workspace for university teams to identify academic risk and make more informed interventions.
              </p>
            </div>
          </div>

          {/* Responsible AI Trust Badge */}
          <div className="mt-12 flex items-center gap-2.5 pt-4 text-xs font-medium text-neutral-500">
            <ShieldCheck className="size-4 shrink-0 text-brand-blue" />
            <span>Built for responsible, transparent decision-making</span>
          </div>
        </div>

        {/* Right Column: Dark Login Portal Panel */}
        <div className="flex flex-col justify-between bg-brand-card-dark p-8 sm:p-10 lg:p-12 text-white">
          <div>
            {/* Header */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Welcome back
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-neutral-400">
                Sign in to the University Academic Risk & XAI Portal.
              </p>
            </div>

            {/* Sign-in Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
              {/* University Email */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-neutral-300"
                >
                  University email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  {...register("email")}
                  className="w-full rounded-lg border border-neutral-800 bg-brand-input-dark px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-150 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              {/* Password with Forgot Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-neutral-300"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-neutral-400 hover:text-brand-blue transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password")}
                  className="w-full rounded-lg border border-neutral-800 bg-brand-input-dark px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-150 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                />
                {errors.password && (
                  <p className="text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              {/* Sign in Button */}
              <button
                type="submit"
                disabled={isSubmitting || loginMutation.isPending}
                className="group relative flex w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 transition-all duration-200 hover:bg-brand-blue-hover active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Info & Disclaimers */}
          <div className="mt-8 space-y-4 pt-4 text-center">
            <p className="text-xs text-neutral-400">
              Need access?{" "}
              <button
                type="button"
                onClick={handleRequestAccount}
                className="font-medium text-brand-blue underline underline-offset-4 hover:text-white transition-colors cursor-pointer"
              >
                Request an account
              </button>
            </p>

            <p className="text-xs leading-relaxed text-neutral-500 max-w-xs mx-auto border-t border-neutral-800/80 pt-4">
              By continuing, you agree to your institution's acceptable use and privacy policies.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
