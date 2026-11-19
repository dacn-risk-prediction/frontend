import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
  Target,
  Award,
  CheckCircle2,
} from "lucide-react";
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
import { useAuthUser } from "@/features/auth";
import { useActiveSemester, formatSemesterLabel } from "@/hooks/use-active-semester";
import { score10ToGpa4, score10ToLetter } from "@/lib/grade-scale";
import { cn } from "@/lib/utils";
import type { CoursePredictionResponse } from "@/types";
import {
  useStudentCurrentCourses,
  useStudentEnrollments,
  useStudentPredictions,
  useStudentSummary,
} from "../api/student-api";

/**
 * Format raw backend feature identifiers into friendly Vietnamese terms
 */
function formatFeatureName(rawFeature: string): { label: string; tip?: string } {
  const f = rawFeature.toLowerCase().trim();

  if (f.includes("cumulative_gpa") || f.includes("gpa_tich_luy") || f.includes("gpa_cum")) {
    return {
      label: "Điểm trung bình tích lũy (GPA)",
      tip: "Nền tảng học lực tích lũy qua các học kỳ trước",
    };
  }
  if (f.includes("giua_ky") || f.includes("midterm") || f.includes("diem_gk")) {
    return {
      label: "Điểm thi giữa kỳ học phần",
      tip: "Điểm đánh giá giữa kỳ hiện tại trên lớp",
    };
  }
  if (f.includes("btl") || f.includes("assignment") || f.includes("bai_tap_lon") || f.includes("do_an")) {
    return {
      label: "Điểm bài tập lớn / Đồ án môn học",
      tip: "Mức độ hoàn thành bài tập thực hành nhóm",
    };
  }
  if (f.includes("lab") || f.includes("thuc_hanh")) {
    return {
      label: "Điểm thực hành thí nghiệm",
      tip: "Điểm hoàn thành các bài thí nghiệm bắt buộc",
    };
  }
  if (f.includes("quiz") || f.includes("chuyen_can") || f.includes("attendance")) {
    return {
      label: "Điểm chuyên cần & Kiểm tra nhỏ",
      tip: "Tỷ lệ đi học và tham gia xây dựng bài",
    };
  }
  if (f.includes("passed_credits") || f.includes("credits_ratio") || f.includes("tin_chi_dat")) {
    return {
      label: "Tỷ lệ tích lũy tín chỉ thành công",
      tip: "Tỷ lệ tín chỉ đậu so với tổng tín chỉ đăng ký",
    };
  }
  if (f.includes("failed_credits") || f.includes("tin_chi_rot") || f.includes("so_mon_rot")) {
    return {
      label: "Lịch sử tín chỉ rớt trước đây",
      tip: "Số lượng tín chỉ từng bị trượt ở các kỳ trước",
    };
  }
  if (f.includes("course_difficulty") || f.includes("difficulty") || f.includes("do_kho")) {
    return {
      label: "Độ khó học thuật của môn học",
      tip: "Khối lượng kiến thức và tỷ lệ trượt lịch sử của môn",
    };
  }
  if (f.includes("prereq") || f.includes("tien_quyet") || f.includes("mon_tien_quyet")) {
    return {
      label: "Nền tảng môn học tiên quyết",
      tip: "Kết quả học tập các môn làm nền tảng",
    };
  }
  if (f.includes("credit_load") || f.includes("so_tin_chi_ky") || f.includes("attempted_credits")) {
    return {
      label: "Khối lượng tín chỉ học kỳ này",
      tip: "Áp lực thời gian và số môn đang học đồng thời",
    };
  }
  if (f.includes("class_fail_rate") || f.includes("ty_le_rot_lop")) {
    return {
      label: "Tỷ lệ trượt trung bình của lớp",
      tip: "Thống kê mức độ cạnh tranh điểm số của nhóm lớp",
    };
  }
  if (f.includes("lecturer") || f.includes("giang_vien")) {
    return {
      label: "Mức độ khắt khe của giảng viên",
      tip: "Tương quan đánh giá lịch sử của giảng viên phụ trách",
    };
  }
  if (f.includes("gpa_major") || f.includes("chuyen_nganh")) {
    return {
      label: "Điểm các môn chuyên ngành",
      tip: "Điểm trung bình các môn cốt lõi ngành học",
    };
  }

  // Fallback
  const readable = rawFeature
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return { label: readable };
}

/**
 * Extract in-term process score from LMS current_marks or model baseline
 */
function getProcessScore(pred?: CoursePredictionResponse): {
  score: number;
  isRecorded: boolean;
  marksSummary: string;
} {
  const marks = pred?.current_marks;
  if (marks && Object.keys(marks).length > 0) {
    const gk = marks.giua_ky ?? null;
    const btl = marks.btl ?? null;
    const lab = marks.lab ?? null;
    const quiz = marks.quiz ?? null;

    const others = [btl, lab, quiz].filter((v): v is number => v !== null && v !== undefined);
    const otherAvg = others.length > 0 ? others.reduce((a, b) => a + b, 0) / others.length : null;

    let score: number;
    if (gk !== null && otherAvg !== null) {
      score = gk * 0.6 + otherAvg * 0.4;
    } else if (gk !== null) {
      score = gk;
    } else if (otherAvg !== null) {
      score = otherAvg;
    } else {
      score = pred?.predicted_score10 ?? 6.5;
    }

    const parts: string[] = [];
    if (gk !== null) parts.push(`GK: ${Number(gk).toFixed(1)}`);
    if (btl !== null) parts.push(`BTL: ${Number(btl).toFixed(1)}`);
    if (lab !== null) parts.push(`Lab: ${Number(lab).toFixed(1)}`);
    if (quiz !== null) parts.push(`Quiz: ${Number(quiz).toFixed(1)}`);

    return {
      score: Number(score.toFixed(1)),
      isRecorded: parts.length > 0,
      marksSummary: parts.length > 0 ? parts.join(" • ") : "Chưa có điểm LMS",
    };
  }

  const fallback = pred?.predicted_score10 ? Math.min(10, Math.max(0, pred.predicted_score10)) : 6.5;
  return {
    score: Number(fallback.toFixed(1)),
    isRecorded: false,
    marksSummary: "Ước lượng theo mô hình AI",
  };
}

/**
 * Feasibility gauge assessment based on final exam score and AI baseline
 */
function getFeasibilityInfo(
  finalExamScore: number,
  baselinePredScore?: number,
  riskLevel?: string
): { label: string; badgeClass: string; message: string; level: "safe" | "challenging" | "danger" | "disqualified" } {
  if (finalExamScore < 3.0) {
    return {
      label: "🚨 Điểm liệt (< 3.0)",
      badgeClass: "border-rose-300 bg-rose-100 text-rose-800",
      message: "Theo quy chế đào tạo, điểm thi kết thúc học phần dưới 3.0 bị tính điểm liệt và rớt môn (F) bất kể điểm quá trình.",
      level: "disqualified",
    };
  }

  const baseline = baselinePredScore ?? 6.5;
  const diff = Number((finalExamScore - baseline).toFixed(1));

  if (diff <= 0.5) {
    return {
      label: "🛡️ Rất khả thi",
      badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-700",
      message: "Mục tiêu điểm số nằm hoàn toàn trong tầm tay, rất phù hợp với phong độ và năng lực học tập của bạn.",
      level: "safe",
    };
  }

  if (diff <= 1.8) {
    return {
      label: "⚡ Cần nỗ lực cao",
      badgeClass: "border-amber-300 bg-amber-50 text-amber-700",
      message: "Mục tiêu này đòi hỏi bạn cần tăng thêm thời gian tự học, giải thêm bài tập và ôn tập kỹ các chuyên đề trọng tâm.",
      level: "challenging",
    };
  }

  return {
    label: "⚠️ Thử thách rất lớn",
    badgeClass: "border-rose-300 bg-rose-50 text-rose-700",
    message: riskLevel === "HIGH"
      ? "Mục tiêu đòi hỏi nỗ lực vượt bậc do môn học có tỷ lệ rớt cao và điểm giữa kỳ chưa tốt. Hãy lập kế hoạch ôn thi từ sớm."
      : "Mục tiêu cao hơn đáng kể so với dự báo của mô hình. Cần quyết tâm cao độ và chuẩn bị kỹ lưỡng cho kỳ thi cuối kỳ.",
    level: "danger",
  };
}

export const StudentWhatIfPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedCourse = searchParams.get("course");
  const navigate = useNavigate();

  const { data: user } = useAuthUser();
  const studentId = user?.user_code || user?.id;
  const { data: activeSemester } = useActiveSemester();
  const activeSemesterLabel = formatSemesterLabel(activeSemester?.semester_code);

  // Real academic data queries
  const { data: summary, isLoading: isLoadingSummary } =
    useStudentSummary(studentId);
  const { data: rawCurrentCourses, isLoading: isLoadingCourses } =
    useStudentCurrentCourses(studentId);
  const { data: enrollments } = useStudentEnrollments(studentId);
  const { data: predictions, isLoading: isLoadingPredictions } =
    useStudentPredictions(studentId);

  // Exclude exempted courses (final_score === 12) so only active studied courses are simulated
  const currentCourses = useMemo(() => {
    if (!rawCurrentCourses) return undefined;
    const exemptedCodes = new Set<string>();
    const exemptedClassIds = new Set<string>();
    if (enrollments) {
      for (const e of enrollments) {
        if (
          e.final_score !== null &&
          e.final_score !== undefined &&
          Number(e.final_score) === 12
        ) {
          exemptedCodes.add(e.course_code);
          if (e.class_id) exemptedClassIds.add(e.class_id);
        }
      }
    }
    return rawCurrentCourses.filter(
      (c) =>
        !(c.class_id && exemptedClassIds.has(c.class_id)) &&
        !exemptedCodes.has(c.course_code),
    );
  }, [rawCurrentCourses, enrollments]);

  // Map AI predictions by course_code
  const predictionMap = useMemo(() => {
    const map = new Map<string, CoursePredictionResponse>();
    if (predictions?.courses) {
      for (const item of predictions.courses) {
        map.set(item.course_code, item);
      }
    }
    return map;
  }, [predictions]);

  // Selected course for XAI SHAP factor explanations (derived)
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(
    null,
  );

  const activeCourseCode = useMemo(() => {
    if (selectedCourseCode) return selectedCourseCode;
    if (preselectedCourse) return preselectedCourse;
    if (currentCourses && currentCourses.length > 0) {
      const highestRisk =
        currentCourses.find(
          (c) => predictionMap.get(c.course_code)?.risk_level === "HIGH",
        ) ||
        currentCourses.find(
          (c) => predictionMap.get(c.course_code)?.risk_level === "MEDIUM",
        ) ||
        currentCourses[0];
      return highestRisk?.course_code ?? "";
    }
    return "";
  }, [selectedCourseCode, preselectedCourse, currentCourses, predictionMap]);

  // ⭐ CẢI TIẾN 1: Interactive simulated overrides for FINAL EXAM SCORES (0 - 10)
  // course_code -> expected final exam score
  const [userFinalExamScores, setUserFinalExamScores] = useState<Record<string, number>>({});

  const handleFinalExamChange = (courseCode: string, newScore: number) => {
    setUserFinalExamScores((prev) => ({
      ...prev,
      [courseCode]: newScore,
    }));
  };

  // ⭐ CẢI TIẾN 2: 3 Kịch bản Thông minh (Smart Presets) sát thực tế

  // 1. 🛡️ Kịch bản "Cứu nguy học vụ" (Pass All)
  const handlePresetPassAll = () => {
    if (!currentCourses) return;
    const updated: Record<string, number> = {};
    for (const course of currentCourses) {
      const pred = predictionMap.get(course.course_code);
      const proc = getProcessScore(pred).score;
      const isAtRisk =
        pred?.risk_level === "HIGH" ||
        pred?.risk_level === "MEDIUM" ||
        pred?.is_at_risk ||
        (pred?.predicted_score10 ?? 7.0) < 5.0;

      if (isAtRisk) {
        // Cần tổng kết >= 5.0 => FinalExam >= 2 * 5.0 - proc = 10.0 - proc, tối thiểu >= 3.0
        const req = Math.max(3.0, Math.min(10.0, Number((10.0 - proc).toFixed(1))));
        updated[course.course_code] = req;
      } else {
        // Môn an toàn: giữ mức điểm dự báo của AI (hoặc >= 5.5)
        const safeScore = pred?.predicted_score10 ? Math.max(5.5, pred.predicted_score10) : 6.5;
        updated[course.course_code] = Number(safeScore.toFixed(1));
      }
    }
    setUserFinalExamScores(updated);
  };

  // 2. 🎯 Kịch bản "Tối ưu Tín chỉ" (Maximize High-Credit Courses)
  const handlePresetOptimizeCredits = () => {
    if (!currentCourses) return;
    const updated: Record<string, number> = {};
    for (const course of currentCourses) {
      const credits = course.credits || 0;
      if (credits >= 3) {
        // Môn 3-4 tín chỉ: Dồn điểm thi cao 8.5 để tối ưu hóa GPA học kỳ
        updated[course.course_code] = 8.5;
      } else {
        // Môn 1-2 tín chỉ: Đặt mức an toàn 6.5 để tiết kiệm công sức
        updated[course.course_code] = 6.5;
      }
    }
    setUserFinalExamScores(updated);
  };

  // 3. 🏆 Kịch bản "Săn Học bổng" (Honor Roll - Hướng tới GPA >= 3.6)
  const handlePresetHonorRoll = () => {
    if (!currentCourses) return;
    const updated: Record<string, number> = {};
    for (const course of currentCourses) {
      const pred = predictionMap.get(course.course_code);
      const proc = getProcessScore(pred).score;
      // Để tổng kết >= 8.5 (Điểm A) => FinalExam >= 2 * 8.5 - proc = 17.0 - proc
      const reqA = Number((17.0 - proc).toFixed(1));
      if (reqA <= 10.0) {
        updated[course.course_code] = Math.max(8.0, reqA);
      } else {
        // Nếu điểm quá trình thấp hơn, nhắm điểm B+ (tổng kết >= 8.0) => FinalExam >= 16.0 - proc
        const reqBPlus = Number((16.0 - proc).toFixed(1));
        updated[course.course_code] = Math.max(7.5, Math.min(10.0, reqBPlus));
      }
    }
    setUserFinalExamScores(updated);
  };

  // Khôi phục mặc định AI
  const handleResetToPredictions = () => {
    setUserFinalExamScores({});
  };

  const handleSelectCourse = (code: string) => {
    setSelectedCourseCode(code);
    setSearchParams({ course: code });
  };

  // Dynamic calculations based on simulated final exam scores & process scores
  const {
    baselineTermGpa,
    simulatedTermGpa,
    termGpaDelta,
    currentCumulativeGpa,
    projectedCumulativeGpa,
    cumulativeGpaDelta,
    totalTermCredits,
    simulatedAtRiskCount,
    baselineAtRiskCount,
    disqualifiedCount,
    courseSimulationDetails,
  } = useMemo(() => {
    if (!currentCourses || currentCourses.length === 0) {
      return {
        baselineTermGpa: 0,
        simulatedTermGpa: 0,
        termGpaDelta: 0,
        currentCumulativeGpa: summary?.cumulative_gpa ?? 0,
        projectedCumulativeGpa: summary?.cumulative_gpa ?? 0,
        cumulativeGpaDelta: 0,
        totalTermCredits: 0,
        simulatedAtRiskCount: 0,
        baselineAtRiskCount: 0,
        disqualifiedCount: 0,
        courseSimulationDetails: new Map<string, {
          processScore: number;
          finalExamScore: number;
          totalScore10: number;
          gpa4: number;
          letter: string;
          isDisqualified: boolean;
          isAtRisk: boolean;
        }>(),
      };
    }

    const totalCredits = currentCourses.reduce(
      (sum, c) => sum + (c.credits || 0),
      0,
    );
    const baselineGpa =
      predictions?.predicted_semester_gpa4 ??
      (summary?.cumulative_gpa ?? 3.0);

    let simGradePoints = 0;
    let simRiskCount = 0;
    let disqCount = 0;

    const detailsMap = new Map<string, {
      processScore: number;
      finalExamScore: number;
      totalScore10: number;
      gpa4: number;
      letter: string;
      isDisqualified: boolean;
      isAtRisk: boolean;
    }>();

    for (const course of currentCourses) {
      const pred = predictionMap.get(course.course_code);
      const procInfo = getProcessScore(pred);
      const processScore = procInfo.score;

      // Default final exam score: AI predicted score or 7.0
      const defaultFinalExam = pred?.predicted_score10 ?? 7.0;
      const finalExamScore = userFinalExamScores[course.course_code] ?? defaultFinalExam;

      // Rule: Final exam < 3.0 is a fail (điểm liệt)
      const isDisqualified = finalExamScore < 3.0;

      // Course total score = Process * 0.5 + FinalExam * 0.5
      let totalScore10: number;
      let gpa4: number;
      let letter: string;

      if (isDisqualified) {
        totalScore10 = Number(finalExamScore.toFixed(1));
        gpa4 = 0.0;
        letter = "F";
        disqCount += 1;
        simRiskCount += 1;
      } else {
        totalScore10 = Number((processScore * 0.5 + finalExamScore * 0.5).toFixed(1));
        gpa4 = score10ToGpa4(totalScore10);
        letter = score10ToLetter(totalScore10);

        // Course is considered at risk if total score < 5.0
        if (totalScore10 < 5.0) {
          simRiskCount += 1;
        }
      }

      simGradePoints += gpa4 * (course.credits || 0);

      detailsMap.set(course.course_code, {
        processScore,
        finalExamScore,
        totalScore10,
        gpa4,
        letter,
        isDisqualified,
        isAtRisk: isDisqualified || totalScore10 < 5.0,
      });
    }

    const simTermGpa = totalCredits > 0 ? simGradePoints / totalCredits : 0;
    const termDelta = Number((simTermGpa - baselineGpa).toFixed(2));

    // Projected Cumulative GPA
    const passedCredits = summary?.total_passed_credits ?? 0;
    const curCumGpa = summary?.cumulative_gpa ?? 3.0;
    const pastGradePoints = curCumGpa * passedCredits;

    const projCumGpa =
      passedCredits + totalCredits > 0
        ? (pastGradePoints + simGradePoints) / (passedCredits + totalCredits)
        : simTermGpa;
    const cumDelta = Number((projCumGpa - curCumGpa).toFixed(2));

    const baseRiskCount = predictions?.at_risk_count ?? 0;

    return {
      baselineTermGpa: baselineGpa,
      simulatedTermGpa: Number(simTermGpa.toFixed(2)),
      termGpaDelta: termDelta,
      currentCumulativeGpa: curCumGpa,
      projectedCumulativeGpa: Number(projCumGpa.toFixed(2)),
      cumulativeGpaDelta: cumDelta,
      totalTermCredits: totalCredits,
      simulatedAtRiskCount: simRiskCount,
      baselineAtRiskCount: baseRiskCount,
      disqualifiedCount: disqCount,
      courseSimulationDetails: detailsMap,
    };
  }, [currentCourses, predictions, predictionMap, userFinalExamScores, summary]);

  // Selected course details & SHAP factors
  const focusedCourse = useMemo(() => {
    return currentCourses?.find((c) => c.course_code === activeCourseCode);
  }, [currentCourses, activeCourseCode]);

  const focusedPrediction = useMemo(() => {
    return predictionMap.get(activeCourseCode);
  }, [predictionMap, activeCourseCode]);

  const isLoading =
    isLoadingCourses || isLoadingSummary || isLoadingPredictions;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner (Việt hóa chuẩn) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Giả lập Điểm Học tập What-If
            </h1>
            <Badge className="bg-blue-600 font-semibold text-white shadow-2xs">
              <Sparkles className="mr-1 h-3 w-3" />
              Động cơ XAI
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Mô phỏng điểm thi cuối kỳ trên các môn đang học và khám phá giải thích TreeSHAP trực quan.
          </p>
        </div>
      </div>

      {/* 2. Active Target Course Focus Callout */}
      {focusedCourse && (
        <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white shadow-xs">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-900">
                Đang tập trung mô phỏng:{" "}
                <span className="font-mono text-sm font-bold">
                  {focusedCourse.course_code}
                </span>{" "}
                • {focusedCourse.course_name}
              </p>
              <p className="text-xs text-blue-700">
                Mô hình giải thích TreeSHAP đã sẵn sàng. Bạn có thể kéo thử điểm thi cuối kỳ bên dưới.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer border-blue-200 bg-white text-xs font-medium text-blue-800 shadow-2xs hover:bg-blue-50"
              onClick={handleResetToPredictions}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Khôi phục Mặc định AI
            </Button>
          </div>
        </div>
      )}

      {/* 3. Main Simulator Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <div className="space-y-4 pt-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-6 shadow-xs">
            <div className="space-y-4">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          </Card>
        </div>
      ) : summary?.is_graduated ? (
        <Card className="border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h3 className="mt-3 text-lg font-bold text-slate-800">
            Đã Hoàn Thành Chương Trình Đào Tạo
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Sinh viên đã tốt nghiệp và không còn môn học đăng ký trong học kỳ hiện tại để thực hiện mô phỏng điểm số.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => navigate("/student/overview")}
          >
            Quay lại Tổng quan
          </Button>
        </Card>
      ) : !currentCourses || currentCourses.length === 0 ? (
        <Card className="border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="mt-3 text-lg font-bold text-slate-800">
            Không Tìm Thấy Môn Học Đang Đăng Ký
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Không có môn học nào đang được đăng ký trong học kỳ hiện tại. Vui lòng đăng ký môn học để mở khóa tính năng mô phỏng.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => navigate("/student/overview")}
          >
            Quay lại Tổng quan
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* CỘT TRÁI (2 Cols): Giả lập Điểm thi Cuối kỳ & Giải thích SHAP */}
          <div className="space-y-6 lg:col-span-2">
            {/* Thẻ Giả Lập Điểm Thi Cuối Kỳ */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                        <SlidersHorizontal className="h-5 w-5 text-blue-700" />
                        Giả lập Điểm thi Cuối kỳ
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Điều chỉnh điểm thi cuối kỳ (tỷ trọng 50%) kết hợp với điểm quá trình LMS để tính điểm tổng kết.
                      </CardDescription>
                    </div>
                  </div>

                  {/* ⭐ CẢI TIẾN 2: 3 Kịch bản Thông minh (Smart Presets) sát thực tế */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Target className="h-3.5 w-3.5 text-blue-600" />
                      Kịch bản nhanh:
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer border-slate-200 bg-white text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 shadow-2xs"
                      onClick={handlePresetPassAll}
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                      Cứu nguy học vụ (Pass All)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer border-slate-200 bg-white text-xs font-semibold text-blue-700 hover:bg-blue-50 hover:border-blue-300 shadow-2xs"
                      onClick={handlePresetOptimizeCredits}
                    >
                      <Target className="mr-1 h-3.5 w-3.5 text-blue-600" />
                      Tối ưu Tín chỉ (3-4 tín)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer border-slate-200 bg-white text-xs font-semibold text-amber-700 hover:bg-amber-50 hover:border-amber-300 shadow-2xs"
                      onClick={handlePresetHonorRoll}
                    >
                      <Award className="mr-1 h-3.5 w-3.5 text-amber-600" />
                      Săn Học bổng (GPA ≥ 3.6)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800"
                      onClick={handleResetToPredictions}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Mặc định AI
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {currentCourses.map((course) => {
                  const pred = predictionMap.get(course.course_code);
                  const sim = courseSimulationDetails.get(course.course_code);
                  const isTarget = course.course_code === activeCourseCode;

                  const finalExamScore = sim?.finalExamScore ?? (pred?.predicted_score10 ?? 7.0);
                  const processScore = sim?.processScore ?? 6.5;
                  const totalScore10 = sim?.totalScore10 ?? 7.0;
                  const gpa4 = sim?.gpa4 ?? 3.0;
                  const letter = sim?.letter ?? "B";
                  const isDisqualified = sim?.isDisqualified ?? false;

                  const procInfo = getProcessScore(pred);

                  // Feasibility assessment for this course
                  const feasibility = getFeasibilityInfo(
                    finalExamScore,
                    pred?.predicted_score10,
                    pred?.risk_level
                  );

                  return (
                    <div
                      key={course.class_id || course.course_code}
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        isTarget
                          ? "border-blue-400 bg-blue-50/20 ring-1 ring-blue-300 shadow-2xs"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      {/* Course Header & LMS Info */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900">
                            {course.course_code}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">
                            {course.course_name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="h-5 border border-slate-200 bg-slate-100 text-[10px] font-medium text-slate-700"
                          >
                            {course.credits} tín chỉ
                          </Badge>
                          {course.class_group && (
                            <Badge
                              variant="outline"
                              className="h-5 border-slate-200 bg-white text-[10px] font-medium text-slate-600"
                            >
                              Nhóm {course.class_group}
                            </Badge>
                          )}
                        </div>

                        {/* Baseline AI Status & Inspect Button */}
                        {pred && (
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold",
                                pred.risk_level === "HIGH" &&
                                  "border-rose-200 bg-rose-50 text-rose-700",
                                pred.risk_level === "MEDIUM" &&
                                  "border-amber-200 bg-amber-50 text-amber-700",
                                pred.risk_level === "LOW" &&
                                  "border-emerald-200 bg-emerald-50 text-emerald-700",
                              )}
                            >
                              Dự báo AI: {pred.risk_level === "HIGH" ? "Nguy cơ cao" : pred.risk_level === "MEDIUM" ? "Cần chú ý" : "An toàn"} ({Math.round(pred.fail_probability * 100)}% rớt)
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-6 px-2 text-[10px] font-semibold cursor-pointer",
                                isTarget
                                  ? "bg-blue-100 text-blue-800"
                                  : "text-blue-600 hover:bg-blue-50",
                              )}
                              onClick={() =>
                                handleSelectCourse(course.course_code)
                              }
                            >
                              {isTarget ? "Đang xem SHAP" : "Xem SHAP"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* ⭐ CẢI TIẾN 1: Điểm Quá Trình (LMS) + Thanh Trượt Điểm Thi Cuối Kỳ */}
                      <div className="mt-3.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">
                              Điểm Quá trình:
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {processScore.toFixed(1)}/10
                            </span>
                            <span className="text-[11px] text-slate-400">
                              (Tỷ trọng 50% • {procInfo.marksSummary})
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Tổng kết giả định:</span>
                            {isDisqualified ? (
                              <Badge variant="destructive" className="text-xs font-bold">
                                Điểm liệt (F)
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-mono text-xs font-bold",
                                  totalScore10 >= 8.5
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : totalScore10 >= 7.0
                                      ? "border-blue-300 bg-blue-50 text-blue-700"
                                      : totalScore10 >= 5.0
                                        ? "border-slate-300 bg-white text-slate-800"
                                        : "border-rose-300 bg-rose-50 text-rose-700"
                                )}
                              >
                                {totalScore10.toFixed(1)}/10 • {letter} (GPA {gpa4.toFixed(1)})
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Thanh trượt Điểm thi Cuối kỳ */}
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                              <span>Điểm thi Cuối kỳ (Tỷ trọng 50%)</span>
                              <span className="font-mono font-bold text-blue-700">
                                {finalExamScore.toFixed(1)} / 10
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.5"
                              value={finalExamScore}
                              onChange={(e) =>
                                handleFinalExamChange(
                                  course.course_code,
                                  parseFloat(e.target.value),
                                )
                              }
                              className={cn(
                                "h-2 w-full cursor-pointer",
                                isDisqualified ? "accent-rose-600" : "accent-blue-700"
                              )}
                              aria-label={`Điểm thi cuối kỳ cho ${course.course_name}`}
                            />
                            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                              <span>0 (Liệt)</span>
                              <span className="text-amber-600 font-semibold">3.0 (Chặn liệt)</span>
                              <span>5.0 (Qua môn)</span>
                              <span>7.0 (Khá)</span>
                              <span>8.5 (Giỏi)</span>
                              <span>10</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ⭐ CẢI TIẾN 4: Thẻ Đánh giá Mức độ Khả thi (Feasibility Gauge) */}
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-bold px-2 py-0.5", feasibility.badgeClass)}
                          >
                            {feasibility.label}
                          </Badge>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            {feasibility.message}
                          </span>
                        </div>

                        {pred?.predicted_score10 !== undefined && (
                          <span className="text-[11px] text-slate-400 shrink-0">
                            AI ước tính: <span className="font-semibold text-slate-600">{pred.predicted_score10.toFixed(1)}/10</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* TreeSHAP Explainable AI Insights Card (Việt hóa chuẩn) */}
            {focusedCourse && (
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <Sparkles className="h-4.5 w-4.5 text-blue-600" />
                        Giải thích TreeSHAP: {focusedCourse.course_code}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Các yếu tố học thuật gốc rễ tác động đến kết quả học phần {focusedCourse.course_name}
                      </CardDescription>
                    </div>
                    {focusedPrediction && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2 py-0.5 text-xs font-semibold",
                          focusedPrediction.risk_level === "HIGH" &&
                            "border-rose-200 bg-rose-50 text-rose-700",
                          focusedPrediction.risk_level === "MEDIUM" &&
                            "border-amber-200 bg-amber-50 text-amber-700",
                          focusedPrediction.risk_level === "LOW" &&
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {focusedPrediction.risk_level === "HIGH" ? "Nguy cơ cao" : focusedPrediction.risk_level === "MEDIUM" ? "Rủi ro vừa" : "An toàn"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-1">
                  {focusedPrediction?.top_shap_factors &&
                  focusedPrediction.top_shap_factors.length > 0 ? (
                    <div className="space-y-2.5">
                      {focusedPrediction.top_shap_factors.map(
                        (factor, index) => {
                          const isRiskIncrease =
                            factor.impact === "INCREASE_RISK";
                          const isRiskDecrease =
                            factor.impact === "DECREASE_RISK";
                          const featureInfo = formatFeatureName(factor.feature);

                          return (
                            <div
                              key={index}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 text-xs transition-colors",
                                isRiskIncrease &&
                                  "border-rose-200 bg-rose-50/50 text-rose-900",
                                isRiskDecrease &&
                                  "border-emerald-200 bg-emerald-50/50 text-emerald-900",
                                !isRiskIncrease &&
                                  !isRiskDecrease &&
                                  "border-slate-200 bg-slate-50/50 text-slate-800",
                              )}
                            >
                              <div
                                className={cn(
                                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                  isRiskIncrease &&
                                    "bg-rose-100 text-rose-700",
                                  isRiskDecrease &&
                                    "bg-emerald-100 text-emerald-700",
                                  !isRiskIncrease &&
                                    !isRiskDecrease &&
                                    "bg-slate-200 text-slate-700",
                                )}
                              >
                                {isRiskIncrease && (
                                  <TrendingUp className="h-3 w-3" />
                                )}
                                {isRiskDecrease && (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {!isRiskIncrease && !isRiskDecrease && (
                                  <ShieldCheck className="h-3 w-3" />
                                )}
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-xs text-slate-900">
                                    {featureInfo.label}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] font-semibold h-4.5 px-1.5",
                                      isRiskIncrease &&
                                        "border-rose-300 bg-white text-rose-700",
                                      isRiskDecrease &&
                                        "border-emerald-300 bg-white text-emerald-700",
                                      !isRiskIncrease &&
                                        !isRiskDecrease &&
                                        "border-slate-300 bg-white text-slate-700",
                                    )}
                                  >
                                    {isRiskIncrease && "Tăng rủi ro"}
                                    {isRiskDecrease && "Giảm rủi ro"}
                                    {!isRiskIncrease &&
                                      !isRiskDecrease &&
                                      "Trung tính"}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                                  {factor.description ||
                                    (isRiskDecrease
                                      ? `${featureInfo.label} có chỉ số tốt, tạo điểm tựa bảo vệ và kéo giảm nguy cơ rớt môn.`
                                      : `${featureInfo.label} đang ở mức bất lợi, làm gia tăng nguy cơ rớt học phần.`)}
                                </p>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500">
                      Mô hình đánh giá điểm tích lũy tiên quyết, dữ liệu chuyên cần và độ khó của môn học để xác định các yếu tố rủi ro.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* CỘT PHẢI (1 Col): Kết quả Dự phóng Học kỳ */}
          <div className="space-y-6">
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-900">
                  Kết quả Dự phóng Học kỳ
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Chỉ số ước tính thời gian thực dựa trên điểm thi cuối kỳ bạn vừa kéo thử
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Projected Term GPA */}
                <div className="rounded-xl bg-slate-900 p-5 text-white shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                      GPA Dự phóng Học kỳ
                    </p>
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-800 text-[10px] text-slate-300"
                    >
                      {activeSemesterLabel}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-white">
                      {simulatedTermGpa.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        termGpaDelta > 0 && "text-emerald-400",
                        termGpaDelta < 0 && "text-rose-400",
                        termGpaDelta === 0 && "text-slate-400",
                      )}
                    >
                      {termGpaDelta > 0 && `+${termGpaDelta.toFixed(2)} tăng so với AI`}
                      {termGpaDelta < 0 && `${termGpaDelta.toFixed(2)} giảm so với AI`}
                      {termGpaDelta === 0 && "Trùng khớp AI"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{totalTermCredits} tín chỉ đăng ký</span>
                    <span>
                      AI Baseline:{" "}
                      <span className="font-semibold text-slate-300">
                        {baselineTermGpa.toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Projected Cumulative GPA */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    GPA Tích lũy Dự phóng
                  </p>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900">
                        {projectedCumulativeGpa.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">
                        (Hiện tại: {currentCumulativeGpa.toFixed(2)})
                      </span>
                    </div>
                    {cumulativeGpaDelta !== 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold",
                          cumulativeGpaDelta > 0 &&
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                          cumulativeGpaDelta < 0 &&
                            "border-rose-200 bg-rose-50 text-rose-700",
                        )}
                      >
                        {cumulativeGpaDelta > 0
                          ? `+${cumulativeGpaDelta.toFixed(2)}`
                          : cumulativeGpaDelta.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Risk Level Shift */}
                <div
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    simulatedAtRiskCount === 0
                      ? "border-emerald-200 bg-emerald-50/70"
                      : simulatedAtRiskCount === 1
                        ? "border-amber-200 bg-amber-50/70"
                        : "border-rose-200 bg-rose-50/70",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className={cn(
                        "h-4 w-4",
                        simulatedAtRiskCount === 0
                          ? "text-emerald-700"
                          : simulatedAtRiskCount === 1
                            ? "text-amber-700"
                            : "text-rose-700",
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-bold uppercase tracking-wide",
                        simulatedAtRiskCount === 0
                          ? "text-emerald-900"
                          : simulatedAtRiskCount === 1
                            ? "text-amber-900"
                            : "text-rose-900",
                      )}
                    >
                      Chuyển dịch Mức độ Rủi ro
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2 text-sm">
                    <span className="text-xs text-slate-500 line-through">
                      {baselineAtRiskCount > 0
                        ? `${baselineAtRiskCount} môn nguy cơ`
                        : "AI: An toàn"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span
                      className={cn(
                        "font-bold text-sm",
                        simulatedAtRiskCount === 0
                          ? "text-emerald-700"
                          : simulatedAtRiskCount === 1
                            ? "text-amber-700"
                            : "text-rose-700",
                      )}
                    >
                      {simulatedAtRiskCount === 0
                        ? "An toàn tuyệt đối (0 môn rớt)"
                        : `${simulatedAtRiskCount} môn có nguy cơ`}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                    {disqualifiedCount > 0 ? (
                      <span className="text-rose-700 font-semibold">
                        Cảnh báo: Có {disqualifiedCount} môn đang bị điểm liệt cuối kỳ (&lt; 3.0). Cần điều chỉnh điểm thi cuối kỳ ngay!
                      </span>
                    ) : simulatedAtRiskCount === 0 ? (
                      "Tất cả các môn đều đạt trên ngưỡng an toàn (≥ 5.0) và không bị điểm liệt. Nguy cơ rớt học kỳ được triệt tiêu hoàn toàn."
                    ) : (
                      `Hiện có ${simulatedAtRiskCount} môn đang dưới 5.0 hoặc có nguy cơ. Hãy tập trung ưu tiên cho các môn này khi ôn thi.`
                    )}
                  </p>
                </div>

                {/* ⭐ CẢI TIẾN 4: Thẻ Đánh giá Khả thi Toàn kỳ (Feasibility Overview) */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    Đánh giá Mức độ Khả thi Kịch bản
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {disqualifiedCount > 0
                      ? "Kịch bản hiện tại có môn bị điểm liệt, không hợp lệ theo quy chế thi."
                      : termGpaDelta > 0.6
                        ? "Kịch bản này đòi hỏi nỗ lực bứt phá lớn trong kỳ thi cuối kỳ so với dự báo AI hiện tại."
                        : termGpaDelta > 0
                          ? "Kịch bản tích cực, hoàn toàn khả thi nếu bạn duy trì kỷ luật ôn tập tốt."
                          : "Kịch bản rất sát với phong độ thực tế dự báo của bạn."}
                  </p>
                </div>

                {/* Nút Reset */}
                <Button
                  variant="outline"
                  className="w-full cursor-pointer border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={handleResetToPredictions}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5 text-slate-500" />
                  Khôi phục Mặc định AI
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
