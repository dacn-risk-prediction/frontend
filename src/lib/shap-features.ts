/**
 * Shared human-readable Vietnamese label formatter for ML/SHAP feature names.
 */
export function formatFeatureName(rawFeature: string): {
  label: string;
  tip?: string;
} {
  const f = rawFeature.toLowerCase().trim();

  if (
    f.includes("cumulative_gpa") ||
    f.includes("gpa_tich_luy") ||
    f.includes("gpa_cum")
  ) {
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
  if (
    f.includes("btl") ||
    f.includes("assignment") ||
    f.includes("bai_tap_lon") ||
    f.includes("do_an")
  ) {
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
  if (
    f.includes("quiz") ||
    f.includes("chuyen_can") ||
    f.includes("attendance")
  ) {
    return {
      label: "Điểm chuyên cần & Kiểm tra nhỏ",
      tip: "Tỷ lệ đi học và tham gia xây dựng bài",
    };
  }
  if (
    f.includes("passed_credits") ||
    f.includes("credits_ratio") ||
    f.includes("tin_chi_dat")
  ) {
    return {
      label: "Tỷ lệ tích lũy tín chỉ thành công",
      tip: "Tỷ lệ tín chỉ đậu so với tổng tín chỉ đăng ký",
    };
  }
  if (
    f.includes("failed_credits") ||
    f.includes("tin_chi_rot") ||
    f.includes("so_mon_rot") ||
    f.includes("prior_failed")
  ) {
    return {
      label: "Lịch sử nợ / rớt môn trước đây",
      tip: "Số lượng môn/tín chỉ từng bị trượt ở các kỳ trước",
    };
  }
  if (
    f.includes("course_difficulty") ||
    f.includes("difficulty") ||
    f.includes("do_kho")
  ) {
    return {
      label: "Độ khó học thuật của môn học",
      tip: "Khối lượng kiến thức và tỷ lệ trượt lịch sử của môn",
    };
  }
  if (
    f.includes("prereq") ||
    f.includes("tien_quyet") ||
    f.includes("mon_tien_quyet") ||
    f.startsWith("related_last_score10_")
  ) {
    return {
      label: "Nền tảng môn học tiên quyết",
      tip: "Kết quả học tập các môn làm nền tảng",
    };
  }
  if (f === "retaken") {
    return {
      label: "Trạng thái học lại môn học",
      tip: "Học phần đang được sinh viên đăng ký học lại",
    };
  }
  if (
    f.includes("credit_load") ||
    f.includes("so_tin_chi_ky") ||
    f.includes("attempted_credits") ||
    f === "credits"
  ) {
    return {
      label: "Khối lượng tín chỉ học phần",
      tip: "Áp lực thời gian và khối lượng kiến thức môn học",
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
  if (f.includes("recommended_semester") || f.includes("ky_khuyen_nghi")) {
    return {
      label: "Học kỳ khuyến nghị theo CTĐT",
      tip: "Thời điểm bố trí môn học trong khung chương trình chuẩn",
    };
  }
  if (f.startsWith("course_code_") || f === "course_code") {
    return {
      label: "Đặc thù môn học",
      tip: "Tính chất và độ phân hóa điểm lịch sử của học phần này",
    };
  }
  if (f.startsWith("semester_code") || f === "semester") {
    return {
      label: "Bối cảnh học kỳ hiện tại",
      tip: "Ảnh hưởng chung của học kỳ đang theo học",
    };
  }
  if (f.startsWith("major_") || f === "major") {
    return {
      label: "Ngành đào tạo",
      tip: "Nhóm ngành học thuật của sinh viên",
    };
  }
  if (f.startsWith("cohort_") || f === "cohort") {
    return {
      label: "Khóa đào tạo",
      tip: "Chuẩn chương trình áp dụng theo khóa tuyển sinh",
    };
  }
  if (f.includes("cuoi_ky") || f.includes("final_exam")) {
    return {
      label: "Điểm thi cuối kỳ",
      tip: "Kết quả bài thi kết thúc học phần",
    };
  }
  if (f.includes("semester_gpa") || f.includes("recent_gpa")) {
    return {
      label: "GPA học kỳ gần nhất",
      tip: "Phong độ học tập ở các học kỳ liền kề",
    };
  }

  return { label: "Yếu tố học vụ bổ sung" };
}

/**
 * Sanitize backend SHAP descriptions so raw feature identifiers
 * (e.g., course_code_*, recommended_semester, "Đặc trưng ...") never leak to UI.
 */
export function sanitizeShapDescription(
  description: string | undefined,
  rawFeature: string,
): string {
  const featureInfo = formatFeatureName(rawFeature);
  if (!description || !description.trim()) {
    return featureInfo.tip ?? `${featureInfo.label} tác động đến dự báo.`;
  }

  const cleaned = description
    .replace(/course_code_[A-Za-z0-9_-]+/gi, "đặc thù môn học")
    .replace(/recommended_semester/gi, "học kỳ khuyến nghị theo CTĐT")
    .replace(/Đặc trưng\s+[a-zA-Z0-9_.-]+/g, featureInfo.label)
    .replace(/Đặc trưng\s*:?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) {
    return featureInfo.tip ?? `${featureInfo.label} tác động đến dự báo.`;
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
