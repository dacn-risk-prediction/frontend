import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatFeatureName } from "@/lib/shap-features"
import { cn } from "@/lib/utils"
import type {
  CourseAdviseAIResponse,
  PedagogicalRecommendationResponse,
  RiskLevel,
  TargetGoal,
} from "@/types"
import { useAdviseCourseWithAI } from "../api/student-api"

interface PedagogicalAdviceCardProps {
  studentId?: string
  courseCode: string
  semesterCode: string
  targetGoal: TargetGoal
  riskLevel?: RiskLevel
  lecturerName?: string | null
  recommendations: PedagogicalRecommendationResponse[]
  isLoadingCounterfactual: boolean
  whatIfMarks?: Record<string, number | null> | null
  onNavigateOverview: () => void
  onNavigateWhatIf: () => void
}

function getGoalDisplayLabel(goal: TargetGoal): string {
  switch (goal) {
    case "PASS":
      return "Qua môn"
    case "GRADE_C":
      return "Hạng C"
    case "GRADE_B":
      return "Hạng B"
    case "GRADE_A":
      return "Hạng A"
  }
}

function getSourceMeta(source: CourseAdviseAIResponse["source"]): {
  label: string
  badgeClass: string
} {
  if (source === "gemini") {
    return {
      label: "AI Gemini",
      badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
    }
  }
  if (source === "cache") {
    return {
      label: "Từ bộ nhớ đệm",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }
  return {
    label: "Gợi ý chuẩn",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
  }
}

function getRecommendationStyle(rec: PedagogicalRecommendationResponse): {
  containerClass: string
  titleClass: string
  badgeClass: string
  priorityLabel: string
  Icon: typeof AlertTriangle
  iconClass: string
} {
  const priority = rec.priority.toUpperCase()
  const category = rec.category.toUpperCase()

  if (priority === "HIGH" || category === "WITHDRAW_ADVICE") {
    return {
      containerClass: "border-rose-200 bg-rose-50/60 text-rose-900",
      titleClass: "text-rose-950",
      badgeClass: "border-rose-300 bg-white text-rose-700",
      priorityLabel: category === "WITHDRAW_ADVICE" ? "Cảnh báo học vụ" : "Ưu tiên cao",
      Icon: AlertTriangle,
      iconClass: "text-rose-600",
    }
  }
  if (priority === "MEDIUM" || category === "WARNING") {
    return {
      containerClass: "border-amber-200 bg-amber-50/60 text-amber-900",
      titleClass: "text-amber-950",
      badgeClass: "border-amber-300 bg-white text-amber-700",
      priorityLabel: "Cần chú ý",
      Icon: Info,
      iconClass: "text-amber-600",
    }
  }
  if (category === "OPTIMIZE") {
    return {
      containerClass: "border-blue-200 bg-blue-50/60 text-blue-900",
      titleClass: "text-blue-950",
      badgeClass: "border-blue-300 bg-white text-blue-700",
      priorityLabel: "Tối ưu điểm số",
      Icon: Sparkles,
      iconClass: "text-blue-600",
    }
  }
  return {
    containerClass: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
    titleClass: "text-emerald-950",
    badgeClass: "border-emerald-300 bg-white text-emerald-700",
    priorityLabel: "Điểm tựa tích cực",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
  }
}

/**
 * Parse inline **bold** and `code` spans safely into React elements without dangerouslySetInnerHTML.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      )
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] font-semibold text-blue-800"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    return token
  })
}

/**
 * Safe Markdown-lite renderer supporting headings, bullet lists, numbered lists, bold and inline code.
 */
function renderMarkdownLite(markdown: string): ReactNode {
  const lines = markdown.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let bulletBuffer: string[] = []
  let orderedBuffer: string[] = []

  const flushBullets = (keyPrefix: number) => {
    if (bulletBuffer.length === 0) return
    blocks.push(
      <ul key={`ul-${keyPrefix}`} className="list-disc space-y-1.5 pl-4 text-xs text-slate-700">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ul>
    )
    bulletBuffer = []
  }

  const flushOrdered = (keyPrefix: number) => {
    if (orderedBuffer.length === 0) return
    blocks.push(
      <ol key={`ol-${keyPrefix}`} className="list-decimal space-y-1.5 pl-4 text-xs text-slate-700">
        {orderedBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ol>
    )
    orderedBuffer = []
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) {
      flushBullets(index)
      flushOrdered(index)
      return
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushOrdered(index)
      bulletBuffer.push(line.slice(2).trim())
      return
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      flushBullets(index)
      orderedBuffer.push(orderedMatch[1].trim())
      return
    }

    flushBullets(index)
    flushOrdered(index)

    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={`h3-${index}`} className="pt-1 text-xs font-bold text-slate-900">
          {renderInlineMarkdown(line.slice(4).trim())}
        </h4>
      )
      return
    }
    if (line.startsWith("## ") || line.startsWith("# ")) {
      const content = line.replace(/^#{1,3}\s+/, "")
      blocks.push(
        <h3 key={`h2-${index}`} className="pt-1 text-xs font-extrabold text-blue-900">
          {renderInlineMarkdown(content)}
        </h3>
      )
      return
    }

    blocks.push(
      <p key={`p-${index}`} className="text-xs leading-relaxed text-slate-700">
        {renderInlineMarkdown(line)}
      </p>
    )
  })

  flushBullets(lines.length)
  flushOrdered(lines.length)

  return <div className="space-y-2">{blocks}</div>
}

/**
 * Displays 13-scenario pedagogical recommendations and on-demand Gemini natural-language AI advice.
 */
export const PedagogicalAdviceCard = ({
  studentId,
  courseCode,
  semesterCode,
  targetGoal,
  riskLevel,
  lecturerName,
  recommendations,
  isLoadingCounterfactual,
  whatIfMarks,
  onNavigateOverview,
  onNavigateWhatIf,
}: PedagogicalAdviceCardProps) => {
  const [adviceByKey, setAdviceByKey] = useState<
    Record<string, CourseAdviseAIResponse>
  >({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const adviseMutation = useAdviseCourseWithAI()
  const serializedWhatIf = whatIfMarks ? JSON.stringify(whatIfMarks) : ""
  const adviceKey = `${studentId ?? ""}::${courseCode}::${semesterCode}::${targetGoal}::${serializedWhatIf}`
  const activeAdvice = adviceByKey[adviceKey] ?? null

  const handleRequestAiAdvice = async (forceRefresh: boolean) => {
    if (!studentId || !courseCode) return
    setErrorMessage(null)
    try {
      const result = await adviseMutation.mutateAsync({
        student_id: studentId,
        course_code: courseCode,
        semester_code: semesterCode,
        target_goal: targetGoal,
        allow_improve_recorded_process: true,
        what_if_marks: whatIfMarks ?? null,
        force_refresh: forceRefresh,
      })
      setAdviceByKey((prev) => ({
        ...prev,
        [adviceKey]: result,
      }))
    } catch {
      setErrorMessage(
        "Trợ lý AI hiện đang bận hoặc tạm thời không khả dụng. Bạn vẫn có thể theo dõi các khuyến nghị chuẩn bên trên."
      )
    }
  }

  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          Khuyến nghị Học vụ Cá nhân hóa
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Định hướng sư phạm kết hợp Dual-XAI (TreeSHAP &amp; Counterfactual) cho mục tiêu{" "}
          <span className="font-semibold text-slate-700">
            {getGoalDisplayLabel(targetGoal)}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phần 1: Kịch bản Sư phạm có cấu trúc */}
        {isLoadingCounterfactual && recommendations.length === 0 ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full rounded-lg bg-slate-100" />
            <Skeleton className="h-16 w-full rounded-lg bg-slate-100" />
          </div>
        ) : recommendations.length > 0 ? (
          <div className="space-y-2.5">
            {recommendations.map((rec, index) => {
              const style = getRecommendationStyle(rec)
              const Icon = style.Icon

              return (
                <div
                  key={`${rec.scenario_code}-${index}`}
                  className={cn(
                    "space-y-2 rounded-lg border p-3.5 text-xs",
                    style.containerClass
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={cn("flex items-center gap-1.5 font-bold", style.titleClass)}>
                      <Icon className={cn("h-4 w-4 shrink-0", style.iconClass)} />
                      <span>{rec.title}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("px-1.5 py-0 text-[10px] font-semibold", style.badgeClass)}
                    >
                      {style.priorityLabel}
                    </Badge>
                  </div>

                  <p className="leading-relaxed">{rec.message}</p>

                  {rec.linked_shap_features.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-semibold opacity-75">
                        Yếu tố liên quan:
                      </span>
                      {rec.linked_shap_features.map((feat) => (
                        <span
                          key={feat}
                          className="rounded border border-current/15 bg-white/80 px-1.5 py-0.5 text-[10px] font-medium"
                        >
                          {formatFeatureName(feat).label}
                        </span>
                      ))}
                    </div>
                  )}

                  {rec.can_withdraw_hint && (
                    <div className="rounded-md border border-rose-300/80 bg-white/90 px-2.5 py-2 text-[11px] font-medium text-rose-900">
                      Lưu ý thời hạn học vụ: Bạn vẫn đang trong thời gian cho phép xem xét rút môn — hãy trao đổi sớm với giảng viên hoặc cố vấn học tập trước khi quyết định.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : riskLevel === "HIGH" ? (
          <div className="space-y-1.5 rounded-lg border border-rose-200 bg-rose-50/60 p-3.5 text-xs text-rose-900">
            <div className="flex items-center gap-1.5 font-bold text-rose-950">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              Cần ưu tiên can thiệp &amp; Ôn tập trọng tâm
            </div>
            <p className="leading-relaxed text-rose-800">
              Học phần này có xác suất rủi ro rớt môn cao. Bạn nên chủ động trao đổi với giảng viên{" "}
              <strong>{lecturerName || "phụ trách"}</strong> trong giờ tiếp sinh viên, tham gia học nhóm và ôn lại kiến thức của các môn học tiên quyết.
            </p>
          </div>
        ) : riskLevel === "MEDIUM" ? (
          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <Info className="h-4 w-4 shrink-0 text-amber-600" />
              Cần tập trung củng cố điểm số
            </div>
            <p className="leading-relaxed text-amber-800">
              Kết quả đang tiệm cận ngưỡng rủi ro. Tập trung làm tốt bài tập lớn, hoàn thành bài tập thực hành và chuẩn bị kỹ cho kỳ thi cuối kỳ sẽ giúp bạn nâng điểm lên mức B hoặc cao hơn.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              Phong độ học tập vững chắc
            </div>
            <p className="leading-relaxed text-emerald-800">
              Nền tảng kiến thức và điểm quá trình của bạn cho thấy rủi ro rớt môn rất thấp. Hãy duy trì chuyên cần và nỗ lực ở kỳ thi cuối kỳ để đạt điểm A xuất sắc.
            </p>
          </div>
        )}

        {/* Phần 2: Trợ lý AI Ngôn ngữ Tự nhiên (On-demand /advise-ai) */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Trợ lý Lộ trình AI (Giải thích chi tiết)
                </p>
                <p className="text-[10px] text-slate-500">
                  Chỉ phân tích khi bạn bấm yêu cầu — bám sát số liệu Counterfactual
                </p>
              </div>
            </div>

            {activeAdvice ? (
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-semibold",
                    getSourceMeta(activeAdvice.source).badgeClass
                  )}
                >
                  {getSourceMeta(activeAdvice.source).label}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleRequestAiAdvice(true)}
                  disabled={adviseMutation.isPending}
                  title="Tạo góc nhìn mới"
                  aria-label="Tạo góc nhìn mới"
                  className="h-7 w-7 cursor-pointer text-slate-500 hover:bg-white hover:text-blue-700"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      adviseMutation.isPending && "animate-spin"
                    )}
                  />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRequestAiAdvice(false)}
                disabled={adviseMutation.isPending || !studentId}
                className="cursor-pointer gap-1.5 border-blue-200 bg-white text-xs font-semibold text-blue-700 shadow-2xs hover:bg-blue-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>Giải thích lộ trình chi tiết bằng AI</span>
              </Button>
            )}
          </div>

          {adviseMutation.isPending && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <Skeleton className="h-4 w-2/3 bg-slate-100" />
              <Skeleton className="h-3.5 w-full bg-slate-100" />
              <Skeleton className="h-3.5 w-5/6 bg-slate-100" />
              <Skeleton className="h-3.5 w-4/6 bg-slate-100" />
            </div>
          )}

          {errorMessage && !adviseMutation.isPending && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-800">
              {errorMessage}
            </div>
          )}

          {activeAdvice && !adviseMutation.isPending && (
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
              {renderMarkdownLite(activeAdvice.advice_markdown)}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateOverview}
            className="cursor-pointer text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            &larr; Quay lại Tổng quan
          </Button>

          <Button
            size="sm"
            onClick={onNavigateWhatIf}
            className="cursor-pointer gap-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
          >
            <span>Thử nghiệm giả lập điểm trong What-If</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
