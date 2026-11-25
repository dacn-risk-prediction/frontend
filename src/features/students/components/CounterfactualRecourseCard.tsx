import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  CounterfactualPlanResponse,
  CourseCounterfactualResponse,
  TargetGoal,
} from "@/types"

interface FallbackExamTarget {
  score: number
  label: string
  status: "safe" | "achievable" | "challenging"
}

export interface FallbackTargetsSummary {
  pass: FallbackExamTarget
  gradeB: FallbackExamTarget
  gradeA: FallbackExamTarget
  hasRecordedMarks: boolean
  estimatedProcessScore: number
}

interface CounterfactualRecourseCardProps {
  courseCode: string
  counterfactualData: CourseCounterfactualResponse | null
  isLoading: boolean
  targetGoal: TargetGoal
  onTargetGoalChange: (goal: TargetGoal) => void
  fallbackTargets: FallbackTargetsSummary
  onApplyPlanToWhatIf: (params: {
    finalTarget?: number
    targetGoal: TargetGoal
    changes?: Record<string, number | null>
  }) => void
}

const TARGET_GOAL_OPTIONS: Array<{
  value: TargetGoal
  label: string
  shortHint: string
}> = [
  { value: "PASS", label: "Qua môn (≥ 4.0)", shortHint: "Mốc an toàn" },
  { value: "GRADE_C", label: "Hạng C (≥ 5.5)", shortHint: "Trung bình" },
  { value: "GRADE_B", label: "Hạng B (≥ 7.0)", shortHint: "Khá" },
  { value: "GRADE_A", label: "Hạng A (≥ 8.5)", shortHint: "Giỏi" },
]

function formatComponentLabel(key: string): string {
  const k = key.toLowerCase().trim()
  if (k === "lab") return "Thực hành Lab"
  if (k === "btl") return "Bài tập lớn"
  if (k === "quiz") return "Quiz / Chuyên cần"
  if (k === "giua_ky") return "Thi Giữa kỳ"
  if (k === "cuoi_ky" || k === "cuoi_ky_min") return "Thi Cuối kỳ"
  return key.toUpperCase()
}

function formatExamScoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "Vượt 10.0"
  if (score <= 3.0) return "≥ 3.0 (Tránh điểm liệt)"
  if (score > 10.0) return "Vượt 10.0"
  return `≥ ${score.toFixed(1)} điểm`
}

function getTargetFinalForGoal(
  data: CourseCounterfactualResponse | null,
  goal: TargetGoal
): number | undefined {
  if (!data?.final_exam_targets) return undefined
  const t = data.final_exam_targets
  const raw =
    goal === "PASS"
      ? t.pass_score
      : goal === "GRADE_C"
        ? t.grade_c_score
        : goal === "GRADE_B"
          ? t.grade_b_score
          : t.grade_a_score
  if (raw === null || raw === undefined || raw > 10) return undefined
  return Number(Math.max(3.0, Math.min(10.0, raw)).toFixed(1))
}

function extractPlanFinalTarget(
  plan: CounterfactualPlanResponse
): number | undefined {
  const val = plan.changes.cuoi_ky_min ?? plan.changes.cuoi_ky
  if (val === null || val === undefined) return undefined
  return Number(Math.max(0, Math.min(10, val)).toFixed(1))
}

/**
 * Displays interactive Counterfactual Recourse plans & exact weighted final exam targets.
 */
export const CounterfactualRecourseCard = ({
  courseCode,
  counterfactualData,
  isLoading,
  targetGoal,
  onTargetGoalChange,
  fallbackTargets,
  onApplyPlanToWhatIf,
}: CounterfactualRecourseCardProps) => {
  const baselineFailPct = counterfactualData
    ? Math.round(counterfactualData.baseline.fail_probability * 100)
    : null

  const finalTargets = counterfactualData?.final_exam_targets
  const finalWeightPct = finalTargets
    ? Math.round(
        (finalTargets.final_exam_weight <= 1
          ? finalTargets.final_exam_weight * 100
          : finalTargets.final_exam_weight) || 50
      )
    : 50

  const showInfeasibleAlert =
    counterfactualData !== null &&
    (!counterfactualData.is_feasible ||
      (!counterfactualData.final_exam_targets.is_pass_feasible &&
        counterfactualData.plans.length === 0))

  return (
    <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
      {/* Header + Goal Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold tracking-wide text-slate-800 uppercase">
              Lộ trình Cải thiện &amp; Mục tiêu ({courseCode})
            </span>
          </div>
          {counterfactualData ? (
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-[10px] font-semibold text-blue-700"
            >
              {finalTargets?.used_exact_marks
                ? `Điểm quá trình đã chốt • Cuối kỳ ${finalWeightPct}%`
                : `Ước lượng cột chưa chấm • Cuối kỳ ${finalWeightPct}%`}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-slate-200 bg-white text-[10px] font-semibold text-slate-600"
            >
              {fallbackTargets.hasRecordedMarks
                ? "Dựa trên điểm thành phần (50%)"
                : "Ước lượng theo mô hình AI"}
            </Badge>
          )}
        </div>

        {/* 4 Target Goal Tabs */}
        <div
          className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1 sm:flex sm:flex-wrap"
          role="group"
          aria-label="Chọn mục tiêu điểm học phần"
        >
          {TARGET_GOAL_OPTIONS.map((opt) => {
            const isActive = targetGoal === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTargetGoalChange(opt.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                  isActive
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && !counterfactualData ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full rounded-lg bg-white/80" />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg bg-white/80" />
            ))}
          </div>
        </div>
      ) : counterfactualData ? (
        <>
          {/* Already at target banner */}
          {counterfactualData.already_at_target && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold text-emerald-950">
                  Phong độ hiện tại đã đạt mục tiêu đã chọn
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-800">
                  Với kết quả dự kiến{" "}
                  <span className="font-bold">
                    {counterfactualData.baseline.predicted_score10.toFixed(1)}/10 (hạng{" "}
                    {counterfactualData.baseline.predicted_letter_grade})
                  </span>
                  , bạn đang đi đúng hướng. Có thể nâng mục tiêu lên{" "}
                  <span className="font-semibold">Hạng B</span> hoặc{" "}
                  <span className="font-semibold">Hạng A</span> để tối ưu GPA.
                </p>
              </div>
            </div>
          )}

          {/* Infeasible warning */}
          {showInfeasibleAlert && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="font-bold text-rose-950">
                  Cảnh báo: Khó bù bằng điểm thi Cuối kỳ (vượt ngưỡng 10.0/10)
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-rose-800">
                  Các cột điểm quá trình đã chốt khiến điểm thi cuối kỳ cần đạt vượt quá{" "}
                  <span className="font-semibold">10.0/10</span> để chạm mục tiêu này. Hãy thử giảm mục tiêu hoặc trao đổi sớm với giảng viên / cố vấn học tập để cân nhắc phương án thay thế.
                </p>
              </div>
            </div>
          )}

          {/* Counterfactual Plans */}
          {counterfactualData.plans.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700">
                  Phương án Counterfactual tối ưu ({counterfactualData.plans.length})
                </span>
                {counterfactualData.editable_components.length > 0 && (
                  <span className="text-slate-500">
                    Cột còn cải thiện được:{" "}
                    <span className="font-semibold text-slate-700">
                      {counterfactualData.editable_components
                        .map(formatComponentLabel)
                        .join(", ")}
                    </span>
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {counterfactualData.plans.map((plan) => {
                  const projectedFailPct = Math.round(
                    plan.projected_fail_probability * 100
                  )
                  const changeEntries = Object.entries(plan.changes).filter(
                    ([, val]) => val !== null && val !== undefined
                  )
                  const planFinalTarget = extractPlanFinalTarget(plan)

                  return (
                    <div
                      key={plan.plan_id}
                      className={cn(
                        "rounded-xl border bg-white p-3.5 shadow-2xs transition-all",
                        plan.is_feasible
                          ? "border-slate-200 hover:border-blue-300"
                          : "border-rose-200 bg-rose-50/30"
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {plan.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-1.5 py-0 text-[10px] font-semibold",
                              plan.is_feasible
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            )}
                          >
                            {plan.is_feasible ? "Khả thi" : "Thử thách cao"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          {baselineFailPct !== null && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                              <TrendingDown className="h-3 w-3 text-emerald-600" />
                              Rớt môn:{" "}
                              <span className="text-slate-500 line-through">
                                {baselineFailPct}%
                              </span>
                              <ArrowRight className="h-2.5 w-2.5 text-slate-400" />
                              <span className="font-bold text-emerald-700">
                                {projectedFailPct}%
                              </span>
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 font-mono text-[10px] font-bold text-blue-700"
                          >
                            Dự kiến {plan.projected_score10.toFixed(1)}/10 (Hạng{" "}
                            {plan.projected_letter_grade})
                          </Badge>
                        </div>
                      </div>

                      {/* Target Component Changes + What-If Trigger */}
                      <div className="mt-2.5 flex flex-col gap-2.5 border-t border-slate-100 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {changeEntries.map(([compKey, val]) => (
                            <span
                              key={compKey}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/70 px-2 py-0.5 text-[11px] font-semibold text-blue-900"
                            >
                              <span>{formatComponentLabel(compKey)}</span>
                              <span className="font-mono font-bold text-blue-700">
                                ≥ {Number(val).toFixed(1)}
                              </span>
                            </span>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onApplyPlanToWhatIf({
                              finalTarget:
                                planFinalTarget ??
                                getTargetFinalForGoal(
                                  counterfactualData,
                                  targetGoal
                                ),
                              targetGoal,
                              changes: plan.changes,
                            })
                          }
                          className="w-fit shrink-0 cursor-pointer gap-1.5 border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          <span>Thử mức này trong What-If</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Exact Weighted Final Exam Targets Summary (4 Milestones) */}
          {finalTargets && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Điểm thi Cuối kỳ tối thiểu cần đạt theo trọng số thật của môn (
                <span className="font-semibold text-slate-800">
                  Cuối kỳ {finalWeightPct}%
                </span>{" "}
                &amp; điểm liệt ≥ 3.0):
              </p>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Qua môn (≥ 4.0)
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatExamScoreLabel(finalTargets.pass_score)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Hạng C (≥ 5.5)
                    </span>
                    <Target className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatExamScoreLabel(finalTargets.grade_c_score)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Hạng B (≥ 7.0)
                    </span>
                    <Award className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <p className="mt-1 text-sm font-bold text-blue-700">
                    {formatExamScoreLabel(finalTargets.grade_b_score)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Hạng A (≥ 8.5)
                    </span>
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <p className="mt-1 text-sm font-bold text-amber-700">
                    {formatExamScoreLabel(finalTargets.grade_a_score)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Graceful fallback when Counterfactual endpoint is unreachable (503) */
        <>
          <p className="text-xs text-slate-600 leading-relaxed">
            Điểm thi kết thúc học phần cần đạt để đạt các mốc xếp loại (ước lượng theo tỷ trọng cuối kỳ 50% và điểm liệt ≥ 3.0):
          </p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  Để Qua môn (≥ 5.0)
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="mt-1 text-base font-bold text-slate-900">
                {fallbackTargets.pass.label}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Đạt điểm D/C học phần
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  Để Đạt điểm B (≥ 7.0)
                </span>
                <Award className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <p className="mt-1 text-base font-bold text-blue-700">
                {fallbackTargets.gradeB.label}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Xếp loại Khá</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  Để Đạt điểm A (≥ 8.5)
                </span>
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <p className="mt-1 text-base font-bold text-amber-700">
                {fallbackTargets.gradeA.label}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Xếp loại Giỏi</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
