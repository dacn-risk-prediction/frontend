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
import { formatFeatureName } from "@/lib/shap-features";
import { cn } from "@/lib/utils";
import type {
  CourseAdviseAIResponse,
  PedagogicalRecommendationResponse,
  RiskLevel,
  TargetGoal,
} from "@/types";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAdviseCourseWithAI } from "../api/student-api";

interface PedagogicalAdviceCardProps {
  studentId?: string;
  courseCode: string;
  semesterCode: string;
  targetGoal: TargetGoal;
  riskLevel?: RiskLevel;
  lecturerName?: string | null;
  recommendations: PedagogicalRecommendationResponse[];
  isLoadingCounterfactual: boolean;
  whatIfMarks?: Record<string, number | null> | null;
  onNavigateOverview: () => void;
  onNavigateWhatIf: () => void;
}

function getGoalDisplayLabel(goal: TargetGoal): string {
  switch (goal) {
    case "PASS":
      return "Qua môn";
    case "GRADE_C":
      return "Hạng C";
    case "GRADE_B":
      return "Hạng B";
    case "GRADE_A":
      return "Hạng A";
  }
}

function getSourceMeta(source: CourseAdviseAIResponse["source"]): {
  label: string;
  badgeClass: string;
} {
  if (source === "gemini") {
    return {
      label: "AI Gemini",
      badgeClass:
        "border-blue-200 bg-sidebar-accent text-sidebar-accent-foreground",
    };
  }
  if (source === "cache") {
    return {
      label: "Từ bộ nhớ đệm",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  return {
    label: "Gợi ý chuẩn",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
  };
}

function getRecommendationStyle(rec: PedagogicalRecommendationResponse): {
  rowTint: string;
  titleClass: string;
  badgeClass: string;
  priorityLabel: string;
  Icon: typeof AlertTriangle;
  iconClass: string;
} {
  const priority = rec.priority.toUpperCase();
  const category = rec.category.toUpperCase();

  if (priority === "HIGH" || category === "WITHDRAW_ADVICE") {
    return {
      rowTint: "bg-rose-50/40",
      titleClass: "text-rose-950",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
      priorityLabel:
        category === "WITHDRAW_ADVICE" ? "Cảnh báo học vụ" : "Ưu tiên cao",
      Icon: AlertTriangle,
      iconClass: "text-rose-600",
    };
  }
  if (priority === "MEDIUM" || category === "WARNING") {
    return {
      rowTint: "bg-amber-50/40",
      titleClass: "text-amber-950",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
      priorityLabel: "Cần chú ý",
      Icon: Info,
      iconClass: "text-amber-600",
    };
  }
  if (category === "OPTIMIZE") {
    return {
      rowTint: "bg-sidebar-accent/35",
      titleClass: "text-slate-900",
      badgeClass:
        "border-blue-200 bg-sidebar-accent text-sidebar-accent-foreground",
      priorityLabel: "Tối ưu điểm số",
      Icon: Sparkles,
      iconClass: "text-primary",
    };
  }
  return {
    rowTint: "bg-emerald-50/35",
    titleClass: "text-emerald-950",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    priorityLabel: "Điểm tựa tích cực",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
  };
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs font-semibold text-sidebar-accent-foreground"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}

function renderMarkdownLite(markdown: string): ReactNode {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let orderedBuffer: string[] = [];

  const flushBullets = (keyPrefix: number) => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${keyPrefix}`}
        className="list-disc space-y-1.5 pl-4 text-sm text-slate-700"
      >
        {bulletBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  const flushOrdered = (keyPrefix: number) => {
    if (orderedBuffer.length === 0) return;
    blocks.push(
      <ol
        key={`ol-${keyPrefix}`}
        className="list-decimal space-y-1.5 pl-4 text-sm text-slate-700"
      >
        {orderedBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ol>,
    );
    orderedBuffer = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets(index);
      flushOrdered(index);
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushOrdered(index);
      bulletBuffer.push(line.slice(2).trim());
      return;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushBullets(index);
      orderedBuffer.push(orderedMatch[1].trim());
      return;
    }

    flushBullets(index);
    flushOrdered(index);

    if (line.startsWith("### ")) {
      blocks.push(
        <h4
          key={`h3-${index}`}
          className="pt-1 text-sm font-bold text-slate-900"
        >
          {renderInlineMarkdown(line.slice(4).trim())}
        </h4>,
      );
      return;
    }
    if (line.startsWith("## ") || line.startsWith("# ")) {
      const content = line.replace(/^#{1,3}\s+/, "");
      blocks.push(
        <h3
          key={`h2-${index}`}
          className="pt-1 text-sm font-extrabold text-sidebar-accent-foreground"
        >
          {renderInlineMarkdown(content)}
        </h3>,
      );
      return;
    }

    blocks.push(
      <p key={`p-${index}`} className="text-sm leading-relaxed text-slate-700">
        {renderInlineMarkdown(line)}
      </p>,
    );
  });

  flushBullets(lines.length);
  flushOrdered(lines.length);

  return <div className="max-w-[70ch] space-y-2">{blocks}</div>;
}

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
  >({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const adviseMutation = useAdviseCourseWithAI();
  const serializedWhatIf = whatIfMarks ? JSON.stringify(whatIfMarks) : "";
  const adviceKey = `${studentId ?? ""}::${courseCode}::${semesterCode}::${targetGoal}::${serializedWhatIf}`;
  const activeAdvice = adviceByKey[adviceKey] ?? null;

  const handleRequestAiAdvice = async (forceRefresh: boolean) => {
    if (!studentId || !courseCode) return;
    setErrorMessage(null);
    try {
      const result = await adviseMutation.mutateAsync({
        student_id: studentId,
        course_code: courseCode,
        semester_code: semesterCode,
        target_goal: targetGoal,
        allow_improve_recorded_process: true,
        what_if_marks: whatIfMarks ?? null,
        force_refresh: forceRefresh,
      });
      setAdviceByKey((prev) => ({
        ...prev,
        [adviceKey]: result,
      }));
    } catch {
      setErrorMessage(
        "Trợ lý AI hiện đang bận hoặc tạm thời không khả dụng. Bạn vẫn có thể theo dõi các khuyến nghị chuẩn bên trên.",
      );
    }
  };

  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <ShieldCheck
            className="h-4.5 w-4.5 text-primary"
            aria-hidden="true"
          />
          Khuyến nghị học vụ cá nhân hóa
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Định hướng sư phạm dựa trên phân tích XAI cho mục tiêu{" "}
          <strong className="font-semibold text-slate-700">
            {getGoalDisplayLabel(targetGoal)}
          </strong>
        </CardDescription>
      </CardHeader>

      <CardContent className="divide-y divide-slate-200 p-0">
        {/* Part 1: Structured Pedagogical Recommendations (Hairline rows) */}
        {isLoadingCounterfactual && recommendations.length === 0 ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : recommendations.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recommendations.map((rec, index) => {
              const style = getRecommendationStyle(rec);
              const Icon = style.Icon;

              return (
                <div
                  key={`${rec.scenario_code}-${index}`}
                  className={cn("space-y-2 px-5 py-4", style.rowTint)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                      className={cn(
                        "flex items-center gap-2 text-sm font-bold",
                        style.titleClass,
                      )}
                    >
                      <Icon
                        className={cn("h-4 w-4 shrink-0", style.iconClass)}
                        aria-hidden="true"
                      />
                      <span>{rec.title}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-2 py-0 text-xs font-semibold",
                        style.badgeClass,
                      )}
                    >
                      {style.priorityLabel}
                    </Badge>
                  </div>

                  <p className="max-w-[70ch] text-sm leading-relaxed text-slate-700">
                    {rec.message}
                  </p>

                  {rec.linked_shap_features.length > 0 && (
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">
                        Yếu tố liên quan:{" "}
                      </span>
                      {Array.from(
                        new Set(
                          rec.linked_shap_features.map(
                            (feat) => formatFeatureName(feat).label,
                          ),
                        ),
                      ).join(" · ")}
                    </p>
                  )}

                  {rec.can_withdraw_hint && (
                    <p className="max-w-[70ch] border-t border-rose-200/70 pt-2 text-xs font-medium text-rose-800">
                      Lưu ý thời hạn học vụ: Bạn vẫn đang trong thời gian xem
                      xét rút môn — hãy trao đổi sớm với giảng viên hoặc cố vấn
                      trước khi quyết định.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : riskLevel === "HIGH" ? (
          <div className="space-y-1.5 bg-rose-50/40 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-950">
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <span>Cần ưu tiên can thiệp &amp; Ôn tập trọng tâm</span>
            </div>
            <p className="max-w-[70ch] text-sm leading-relaxed text-rose-900">
              Học phần này có xác suất rủi ro rớt môn cao. Bạn nên chủ động trao
              đổi với giảng viên{" "}
              <strong>{lecturerName || "phụ trách"}</strong> trong giờ tiếp sinh
              viên và ôn lại kiến thức các môn tiên quyết.
            </p>
          </div>
        ) : riskLevel === "MEDIUM" ? (
          <div className="space-y-1.5 bg-amber-50/40 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
              <Info
                className="h-4 w-4 shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <span>Cần tập trung củng cố điểm số</span>
            </div>
            <p className="max-w-[70ch] text-sm leading-relaxed text-amber-900">
              Kết quả đang tiệm cận ngưỡng rủi ro. Tập trung bài tập lớn, thực
              hành và ôn tập sớm cho kỳ thi cuối kỳ sẽ giúp nâng kết quả lên mức
              khá trở lên.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 bg-emerald-50/40 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span>Phong độ học tập vững chắc</span>
            </div>
            <p className="max-w-[70ch] text-sm leading-relaxed text-emerald-900">
              Nền tảng kiến thức và điểm quá trình cho thấy rủi ro rớt môn thấp.
              Hãy duy trì nhịp học hiện tại để hướng tới điểm A.
            </p>
          </div>
        )}

        {/* Part 2: On-demand AI Advisor (Flattened section) */}
        <div className="space-y-3.5 bg-slate-50/60 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Trợ lý lộ trình AI (Giải thích chi tiết)
                </p>
                <p className="text-xs text-slate-500">
                  Phân tích theo yêu cầu dựa trực tiếp trên số liệu dự báo của
                  bạn.
                </p>
              </div>
            </div>

            {activeAdvice ? (
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 text-xs font-semibold",
                    getSourceMeta(activeAdvice.source).badgeClass,
                  )}
                >
                  {getSourceMeta(activeAdvice.source).label}
                </Badge>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => void handleRequestAiAdvice(true)}
                  disabled={adviseMutation.isPending}
                  title="Tạo lại gợi ý"
                  aria-label="Tạo lại gợi ý"
                  className="h-8 w-8 cursor-pointer border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      adviseMutation.isPending && "animate-spin",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRequestAiAdvice(false)}
                disabled={adviseMutation.isPending || !studentId}
                className="h-8 cursor-pointer gap-1.5 border-slate-200 bg-white text-xs font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Giải thích lộ trình bằng AI</span>
              </Button>
            )}
          </div>

          {adviseMutation.isPending && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-4/6" />
            </div>
          )}

          {errorMessage && !adviseMutation.isPending && (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
            >
              {errorMessage}
            </div>
          )}

          {activeAdvice && !adviseMutation.isPending && (
            <div className="border-t border-slate-200 pt-3.5">
              {renderMarkdownLite(activeAdvice.advice_markdown)}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateOverview}
            className="h-8 cursor-pointer text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            &larr; Quay lại Tổng quan
          </Button>

          <Button
            size="sm"
            onClick={onNavigateWhatIf}
            className="h-9 cursor-pointer gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-brand-blue-hover"
          >
            <span>Mở giả lập What-If</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
