import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  CounterfactualPlanResponse,
  CourseCounterfactualResponse,
  TargetGoal,
} from "@/types";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react";

interface FallbackExamTarget {
  score: number;
  label: string;
  status: "safe" | "achievable" | "challenging";
}

export interface FallbackTargetsSummary {
  pass: FallbackExamTarget;
  gradeB: FallbackExamTarget;
  gradeA: FallbackExamTarget;
  hasRecordedMarks: boolean;
  estimatedProcessScore: number;
}

interface CounterfactualRecourseCardProps {
  courseCode: string;
  counterfactualData: CourseCounterfactualResponse | null;
  isLoading: boolean;
  targetGoal: TargetGoal;
  onTargetGoalChange: (goal: TargetGoal) => void;
  fallbackTargets: FallbackTargetsSummary;
  onApplyPlanToWhatIf: (params: {
    finalTarget?: number;
    targetGoal: TargetGoal;
    changes?: Record<string, number | null>;
  }) => void;
}

const TARGET_GOAL_OPTIONS: Array<{
  value: TargetGoal;
  label: string;
}> = [
  { value: "PASS", label: "Qua môn (≥ 4.0)" },
  { value: "GRADE_C", label: "Hạng C (≥ 5.5)" },
  { value: "GRADE_B", label: "Hạng B (≥ 7.0)" },
  { value: "GRADE_A", label: "Hạng A (≥ 8.5)" },
];

function formatComponentLabel(key: string): string {
  const k = key.toLowerCase().trim();
  if (k === "lab") return "Thực hành Lab";
  if (k === "btl") return "Bài tập lớn";
  if (k === "quiz") return "Quiz / Chuyên cần";
  if (k === "giua_ky") return "Thi Giữa kỳ";
  if (k === "cuoi_ky" || k === "cuoi_ky_min") return "Thi Cuối kỳ";
  return key.toUpperCase();
}

function formatExamScoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "Vượt 10.0";
  if (score <= 3.0) return "≥ 3.0 (Tránh điểm liệt)";
  if (score > 10.0) return "Vượt 10.0";
  return `≥ ${score.toFixed(1)} điểm`;
}

function getTargetFinalForGoal(
  data: CourseCounterfactualResponse | null,
  goal: TargetGoal,
): number | undefined {
  if (!data?.final_exam_targets) return undefined;
  const t = data.final_exam_targets;
  const raw =
    goal === "PASS"
      ? t.pass_score
      : goal === "GRADE_C"
        ? t.grade_c_score
        : goal === "GRADE_B"
          ? t.grade_b_score
          : t.grade_a_score;
  if (raw === null || raw === undefined || raw > 10) return undefined;
  return Number(Math.max(3.0, Math.min(10.0, raw)).toFixed(1));
}

function extractPlanFinalTarget(
  plan: CounterfactualPlanResponse,
): number | undefined {
  const val = plan.changes.cuoi_ky_min ?? plan.changes.cuoi_ky;
  if (val === null || val === undefined) return undefined;
  return Number(Math.max(0, Math.min(10, val)).toFixed(1));
}

/**
 * Displays interactive Counterfactual Recourse plans & exact weighted final exam targets
 * following DESIGN.md Hairline-First (no nested card soup, tabular-nums, min 12px labels).
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
    : null;

  const finalTargets = counterfactualData?.final_exam_targets;
  const finalWeightPct = finalTargets
    ? Math.round(
        (finalTargets.final_exam_weight <= 1
          ? finalTargets.final_exam_weight * 100
          : finalTargets.final_exam_weight) || 50,
      )
    : 50;

  const showInfeasibleAlert =
    counterfactualData !== null &&
    (!counterfactualData.is_feasible ||
      (!counterfactualData.final_exam_targets.is_pass_feasible &&
        counterfactualData.plans.length === 0));

  return (
    <section
      aria-label={`Lộ trình cải thiện môn ${courseCode}`}
      className="space-y-4 border-t border-slate-200 pt-5"
    >
      {/* Header + Goal Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              Lộ trình cải thiện &amp; Mục tiêu ({courseCode})
            </h3>
          </div>
          <p className="text-xs text-slate-500 tabular-nums">
            {counterfactualData
              ? finalTargets?.used_exact_marks
                ? `Dựa trên điểm quá trình đã chốt · Trọng số cuối kỳ ${finalWeightPct}%`
                : `Ước lượng cột chưa chấm · Trọng số cuối kỳ ${finalWeightPct}%`
              : fallbackTargets.hasRecordedMarks
                ? "Dựa trên điểm thành phần hiện có · Trọng số cuối kỳ 50%"
                : "Ước lượng theo mô hình XAI"}
          </p>
        </div>

        {/* 4 Target Goal Tabs */}
        <div
          className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex sm:flex-wrap"
          role="group"
          aria-label="Chọn mục tiêu điểm học phần"
        >
          {TARGET_GOAL_OPTIONS.map((opt) => {
            const isActive = targetGoal === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onTargetGoalChange(opt.value)}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors tabular-nums",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-slate-600 hover:bg-white hover:text-slate-900",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && !counterfactualData ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : counterfactualData ? (
        <>
          {/* Already at target banner */}
          {counterfactualData.already_at_target && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <div className="max-w-[70ch]">
                <p className="font-bold text-emerald-950">
                  Phong độ hiện tại đã đạt mục tiêu đã chọn
                </p>
                <p className="mt-0.5 leading-relaxed text-emerald-800 tabular-nums">
                  Với kết quả dự kiến{" "}
                  <strong>
                    {counterfactualData.baseline.predicted_score10.toFixed(1)}/10
                    (hạng {counterfactualData.baseline.predicted_letter_grade})
                  </strong>
                  , bạn đang đi đúng hướng. Có thể nâng mục tiêu lên Hạng B hoặc
                  Hạng A để tối ưu GPA.
                </p>
              </div>
            </div>
          )}

          {/* Infeasible warning */}
          {showInfeasibleAlert && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <div className="max-w-[70ch]">
                <p className="font-bold text-rose-950">
                  Cảnh báo: Điểm thi cuối kỳ cần đạt vượt ngưỡng 10.0/10
                </p>
                <p className="mt-0.5 leading-relaxed text-rose-800">
                  Các cột điểm quá trình đã chốt khiến mục tiêu này khó đạt bằng
                  bài thi cuối kỳ. Hãy thử giảm mục tiêu hoặc trao đổi sớm với
                  giảng viên / cố vấn học tập.
                </p>
              </div>
            </div>
          )}

          {/* Flattened Counterfactual Plans List */}
          {counterfactualData.plans.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800 tabular-nums">
                  Phương án cải thiện khả thi ({counterfactualData.plans.length})
                </span>
                {counterfactualData.editable_components.length > 0 && (
                  <span className="text-slate-500">
                    Cột còn cải thiện được:{" "}
                    <strong className="font-semibold text-slate-800">
                      {counterfactualData.editable_components
                        .map(formatComponentLabel)
                        .join(", ")}
                    </strong>
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {counterfactualData.plans.map((plan) => {
                  const projectedFailPct = Math.round(
                    plan.projected_fail_probability * 100,
                  );
                  const changeEntries = Object.entries(plan.changes).filter(
                    ([, val]) => val !== null && val !== undefined,
                  );
                  const planFinalTarget = extractPlanFinalTarget(plan);

                  return (
                    <div
                      key={plan.plan_id}
                      className={cn(
                        "p-4 transition-colors",
                        !plan.is_feasible && "bg-rose-50/40",
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {plan.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-2 py-0 text-xs font-semibold",
                              plan.is_feasible
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700",
                            )}
                          >
                            {plan.is_feasible ? "Khả thi" : "Thử thách cao"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-xs tabular-nums">
                          {baselineFailPct !== null && (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                              <TrendingDown
                                className="h-3.5 w-3.5 text-emerald-600"
                                aria-hidden="true"
                              />
                              <span>Rủi ro:</span>
                              <span className="text-slate-400 line-through">
                                {baselineFailPct}%
                              </span>
                              <ArrowRight
                                className="h-3 w-3 text-slate-400"
                                aria-hidden="true"
                              />
                              <strong className="font-bold text-emerald-700">
                                {projectedFailPct}%
                              </strong>
                            </span>
                          )}
                          <span className="font-mono font-bold text-sidebar-accent-foreground">
                            · Dự kiến {plan.projected_score10.toFixed(1)}/10 (
                            {plan.projected_letter_grade})
                          </span>
                        </div>
                      </div>

                      {/* Target Component Changes + What-If Trigger */}
                      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                          {changeEntries.map(([compKey, val]) => (
                            <span
                              key={compKey}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-800"
                            >
                              <span>{formatComponentLabel(compKey)}</span>
                              <strong className="font-mono font-bold text-sidebar-accent-foreground">
                                ≥ {Number(val).toFixed(1)}
                              </strong>
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
                                  targetGoal,
                                ),
                              targetGoal,
                              changes: plan.changes,
                            })
                          }
                          className="h-8 w-fit shrink-0 cursor-pointer gap-1.5 border-slate-200 bg-white text-xs font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent"
                        >
                          <SlidersHorizontal
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span>Thử trong What-If</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Exact Weighted Final Exam Targets Summary (Hairline strip) */}
          {finalTargets && (
            <div className="space-y-2 pt-1">
              <p className="text-xs leading-relaxed text-slate-600 tabular-nums">
                Điểm thi cuối kỳ tối thiểu theo trọng số thật của môn (Cuối kỳ{" "}
                <strong className="font-semibold text-slate-900">
                  {finalWeightPct}%
                </strong>{" "}
                · tránh điểm liệt ≥ 3.0):
              </p>

              <div className="grid grid-cols-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                <div className="p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Qua môn (≥ 4.0)</span>
                    <CheckCircle2
                      className="h-3.5 w-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {formatExamScoreLabel(finalTargets.pass_score)}
                  </p>
                </div>

                <div className="p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Hạng C (≥ 5.5)</span>
                    <Target
                      className="h-3.5 w-3.5 text-slate-500"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {formatExamScoreLabel(finalTargets.grade_c_score)}
                  </p>
                </div>

                <div className="p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Hạng B (≥ 7.0)</span>
                    <Award
                      className="h-3.5 w-3.5 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-sm font-bold text-sidebar-accent-foreground tabular-nums">
                    {formatExamScoreLabel(finalTargets.grade_b_score)}
                  </p>
                </div>

                <div className="p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Hạng A (≥ 8.5)</span>
                    <Sparkles
                      className="h-3.5 w-3.5 text-amber-500"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-sm font-bold text-amber-700 tabular-nums">
                    {formatExamScoreLabel(finalTargets.grade_a_score)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Graceful fallback when Counterfactual endpoint is unreachable */
        <>
          <p className="text-xs leading-relaxed text-slate-600">
            Điểm thi kết thúc học phần cần đạt để chạm các mốc xếp loại (ước
            lượng theo tỷ trọng cuối kỳ 50% · điểm liệt ≥ 3.0):
          </p>

          <div className="grid grid-cols-1 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-3.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Qua môn (≥ 4.0)</span>
                <CheckCircle2
                  className="h-3.5 w-3.5 text-emerald-600"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 font-mono text-sm font-bold text-slate-900 tabular-nums">
                {fallbackTargets.pass.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Đạt điểm D/C</p>
            </div>

            <div className="p-3.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Hạng B (≥ 7.0)</span>
                <Award
                  className="h-3.5 w-3.5 text-primary"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 font-mono text-sm font-bold text-sidebar-accent-foreground tabular-nums">
                {fallbackTargets.gradeB.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Xếp loại Khá</p>
            </div>

            <div className="p-3.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Hạng A (≥ 8.5)</span>
                <Sparkles
                  className="h-3.5 w-3.5 text-amber-500"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 font-mono text-sm font-bold text-amber-700 tabular-nums">
                {fallbackTargets.gradeA.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Xếp loại Giỏi</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
