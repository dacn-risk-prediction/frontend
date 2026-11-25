// ==========================================
// Authentication Types
// ==========================================
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RefreshTokenPayload {
  refresh_token: string
}

// ==========================================
// User Types
// ==========================================
export type UserRole = "admin" | "lecturer" | "student"

export interface User {
  id: string // UUID
  user_code: string
  name: string
  email: string
  role: UserRole
  title: string | null
}

export interface UserCreatePayload {
  user_code: string
  name: string
  email: string
  role: UserRole
  title?: string | null
  password: string
}

export interface UserUpdatePayload {
  name?: string
  email?: string
  role?: UserRole
  title?: string | null
  password?: string
}

// ==========================================
// Student Types
// ==========================================
export interface Student {
  student_id: string
  cohort: string
  major: string
  program?: string | null
  specialization?: string | null
  english_pass?: boolean | null
  ctxh_days?: number | null
  user_id: string | null
}

export interface StudentDetail extends Student {
  user: User | null
}

export interface StudentCreatePayload {
  student_id: string
  cohort: string
  major: string
  program?: string | null
  specialization?: string | null
  english_pass?: boolean | null
  ctxh_days?: number | null
  user_id?: string | null
}

export interface StudentUpdatePayload {
  cohort?: string
  major?: string
  program?: string | null
  specialization?: string | null
  english_pass?: boolean | null
  ctxh_days?: number | null
  user_id?: string | null
}

export interface SemesterGPA {
  semester_code: string
  gpa: number
  semester_gpa: number
  attempted_credits: number
  passed_credits: number
  courses_count: number
}

export interface StudentAcademicSummary {
  student_id: string
  cumulative_gpa: number
  total_passed_credits: number
  total_attempted_credits: number
  passed_courses_count: number
  failed_courses_count: number
  is_graduated?: boolean
  semester_gpas: SemesterGPA[]
}

export interface StudentCurrentCourseItem {
  course_code: string
  course_name: string
  credits: number
  class_id: string | null
  class_group: string | null
  lecturer_id: string | null
  lecturer_name: string | null
  retaken: boolean
  status: string | null
}

export type StudentHK261CourseItem = StudentCurrentCourseItem


// ==========================================
// Lecturer Types
// ==========================================
export interface Lecturer {
  lecturer_id: string
  departments: string
  user_id: string | null
}

export interface LecturerDetail extends Lecturer {
  user: User | null
}

export interface LecturerCreatePayload {
  lecturer_id: string
  departments: string
  user_id?: string | null
}

export interface LecturerUpdatePayload {
  departments?: string
  user_id?: string | null
}

export interface LecturerCurrentClassItem {
  class_id: string
  class_group: string
  course_code: string
  course_name: string
  credits: number
  semester_code: string
  academic_year: string | null
  term: number | null
  total_students: number
}

// ==========================================
// Course & Prerequisite Types
// ==========================================
export interface Course {
  course_code: string
  course_name: string
  credits: number
}

export interface CoursePrerequisite {
  course_prerequisite_id: number
  course_code: string
  related_course_code: string
  relation_type: string // 'PREREQ', 'COREQ'
}

export interface CourseAssessment {
  course_code: string
  course_category: string | null
  quiz: number | null
  lab: number | null
  btl: number | null
  giua_ky: number | null
  cuoi_ky: number | null
}

export interface CourseDetail extends Course {
  prerequisites: CoursePrerequisite[]
  assessment?: CourseAssessment | null
}

export interface CourseCreatePayload {
  course_code: string
  course_name: string
  credits: number
}

export interface CourseUpdatePayload {
  course_name?: string
  credits?: number
}

export interface CoursePrerequisiteCreatePayload {
  course_code: string
  related_course_code: string
  relation_type: string
}

// ==========================================
// Admin Types
// ==========================================
export interface Admin {
  admin_id: string
  department: string
  user_id: string | null
}

export interface AdminDetail extends Admin {
  user: User | null
}

export interface AdminCreatePayload {
  admin_id: string
  department?: string
  user_id?: string | null
}

export interface AdminUpdatePayload {
  department?: string
  user_id?: string | null
}

export interface AdminSystemStats {
  users_count: number
  students_count: number
  lecturers_count: number
  admins_count: number
  courses_count: number
  active_classes_count: number
  semesters_count: number
  curriculums_count: number
  active_semester_code: string | null
}

// ==========================================
// Curriculum & Knowledge Block Types
// ==========================================
export interface KnowledgeBlock {
  block_id: string
  block_code: string | null
  block_name_vi: string
  block_name_en: string | null
  category: string | null
  required_credits: number | null
  description: string | null
}

export interface Curriculum {
  curriculum_id: string
  curriculum_name: string
  major_code: string
  major_name: string
  cohort: string
  academic_year_start: number | null
  total_credits: number | null
  base_curriculum_id: string | null
  faculty: string | null
}

export interface CurriculumStructureItem {
  structure_id: number
  curriculum_id: string | null
  course_code: string | null
  block_id: string | null
  course_type: string | null
  elective_group: string | null
  specialization: string | null
  credits: number | null
  recommended_semester: string | null
  prerequisites: string | null
  knowledge_block: KnowledgeBlock | null
}

export interface CurriculumDetail extends Curriculum {
  structures: CurriculumStructureItem[]
}

// ==========================================
// Semester Types
// ==========================================
export interface Semester {
  semester_code: string
  academic_year: string
  term: number
  is_active?: boolean
  withdraw_deadline?: string | null
}

export interface SemesterCreatePayload {
  semester_code: string
  academic_year: string
  term: number
  is_active?: boolean
  withdraw_deadline?: string | null
}

export interface SemesterUpdatePayload {
  academic_year?: string
  term?: number
  is_active?: boolean
  withdraw_deadline?: string | null
}

// ==========================================
// Academic Class Types
// ==========================================
export interface AcademicClass {
  class_id: string
  class_group: string
  course_code: string | null
  semester_code: string | null
  lecturer_id: string | null
}

export interface AcademicClassDetail extends AcademicClass {
  course: Course | null
  semester: Semester | null
  lecturer: Lecturer | null
}

export interface AcademicClassCreatePayload {
  class_id: string
  class_group: string
  course_code?: string | null
  semester_code?: string | null
  lecturer_id?: string | null
}

export interface AcademicClassUpdatePayload {
  class_group?: string
  course_code?: string | null
  semester_code?: string | null
  lecturer_id?: string | null
}

// ==========================================
// Enrollment & Grade Types
// ==========================================
export interface Enrollment {
  id: string // UUID
  student_id: string
  class_id: string
  course_code: string
  semester_code: string
  retaken: boolean
  quiz: number | null
  lab: number | null
  btl: number | null
  giua_ky: number | null
  cuoi_ky: number | null
  final_score: number | null
  letter_grade: string | null
  gpa_4: number | null
  passed: boolean | null
  semester_gpa_4: number | null
  final_gpa_4: number | null
  status: string | null
}

export interface EnrollmentCreatePayload {
  student_id: string
  class_id: string
  course_code: string
  semester_code: string
  retaken?: boolean
  status?: string | null
}

export interface EnrollmentUpdatePayload {
  retaken?: boolean
  quiz?: number | null
  lab?: number | null
  btl?: number | null
  giua_ky?: number | null
  cuoi_ky?: number | null
  final_score?: number | null
  letter_grade?: string | null
  gpa_4?: number | null
  passed?: boolean | null
  semester_gpa_4?: number | null
  final_gpa_4?: number | null
  status?: string | null
}

// ==========================================
// Prediction & Explainable AI (XAI) Types
// ==========================================
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ShapImpact = 'INCREASE_RISK' | 'DECREASE_RISK'

export interface ShapFactorResponse {
  feature: string
  shap_value: number
  impact: ShapImpact
  description: string
}

export interface CoursePredictionResponse {
  course_code: string
  course_name: string | null
  credits: number | null
  class_id: string | null
  class_group: string | null
  lecturer_name: string | null
  semester_code: string
  record_status: string | null
  fail_probability: number
  predicted_course_fail: number // 0 (Pass) or 1 (Fail)
  is_at_risk: boolean
  risk_level: RiskLevel
  predicted_score10: number
  predicted_gpa4: number
  current_marks: {
    quiz?: number | null
    lab?: number | null
    btl?: number | null
    giua_ky?: number | null
    [key: string]: number | null | undefined
  }
  top_shap_factors: ShapFactorResponse[]
}

export interface StudentPredictionResponse {
  student_id: string
  semester_code: string
  total_courses: number
  at_risk_count: number
  predicted_semester_gpa4: number
  courses: CoursePredictionResponse[]
}

export interface PredictCourseRequest {
  student_id: string
  course_code: string
  semester_code?: string | null
}

export interface PredictStudentRequest {
  student_id: string
  semester_code?: string | null
}

export interface ModelHealthResponse {
  status: string
  service: string
  model_status: 'loaded' | 'not_loaded' | string
  fail_threshold: number
  total_records_cached: number
  metrics: Record<string, unknown>
}

export interface ClassRiskFactor {
  feature: string
  mean_shap: number
  impact: ShapImpact
  description: string
}

export interface ClassRiskAnalytics {
  total_students: number
  high_risk_count: number
  medium_risk_count: number
  low_risk_count: number
  high_risk_rate: number
  average_predicted_score10: number
  average_predicted_gpa4: number
  grade_distribution: Record<string, number>
  top_class_risk_factors: ClassRiskFactor[]
}

export interface ClassStudentPrediction {
  student_id: string
  student_name: string | null
  fail_probability: number
  predicted_course_fail: number
  is_at_risk: boolean
  risk_level: RiskLevel
  predicted_score10: number
  predicted_gpa4: number
  predicted_letter_grade: string
  current_marks: {
    quiz?: number | null
    lab?: number | null
    btl?: number | null
    giua_ky?: number | null
    cuoi_ky?: number | null
    [key: string]: number | null | undefined
  }
  top_shap_factors: ShapFactorResponse[]
}

export interface ClassPrediction {
  class_id: string
  course_code: string
  course_name: string | null
  credits: number | null
  class_group: string | null
  lecturer_name: string | null
  semester_code: string
  inference_time_ms: number
  analytics: ClassRiskAnalytics
  students: ClassStudentPrediction[]
}

export type ClassPredictionResponse = ClassPrediction

export interface PredictClassPayload {
  class_id: string
  include_shap?: boolean
}

export type TargetGoal = 'PASS' | 'GRADE_C' | 'GRADE_B' | 'GRADE_A'
export type AdviceSource = 'cache' | 'gemini' | 'fallback'
export type RecommendationCategory =
  | 'RECOVERY'
  | 'WARNING'
  | 'OPTIMIZE'
  | 'WITHDRAW_ADVICE'
  | 'STRENGTH'
  | string

export interface PredictCourseCounterfactualRequest {
  student_id: string
  course_code: string
  semester_code?: string | null
  target_goal?: TargetGoal
  locked_components?: string[] | null
  allow_improve_recorded_process?: boolean
  what_if_marks?: Record<string, number | null> | null
}

export interface CounterfactualPlanResponse {
  plan_id: string
  title: string
  changes: Record<string, number | null>
  projected_fail_probability: number
  projected_score10: number
  projected_letter_grade: string
  effort_score: number
  is_feasible: boolean
}

export interface FinalExamTargetSummaryResponse {
  pass_score: number | null
  grade_c_score: number | null
  grade_b_score: number | null
  grade_a_score: number | null
  is_pass_feasible: boolean
  used_exact_marks: boolean
  final_exam_weight: number
}

export interface PedagogicalRecommendationResponse {
  scenario_code: string
  category: RecommendationCategory
  priority: string
  title: string
  message: string
  targets: Record<string, unknown>
  linked_shap_features: string[]
  can_withdraw_hint: boolean
}

export interface CourseCounterfactualBaselineResponse {
  fail_probability: number
  is_calibrated: boolean
  predicted_course_fail: number
  is_at_risk: boolean
  risk_level: RiskLevel
  predicted_score10: number
  predicted_gpa4: number
  predicted_letter_grade: string
  current_marks: Record<string, number | null>
  weights: Record<string, number>
}

export interface CourseCounterfactualResponse {
  student_id: string
  course_code: string
  course_name: string | null
  credits: number | null
  class_id: string | null
  class_group: string | null
  lecturer_name: string | null
  semester_code: string
  target_goal: TargetGoal | string
  already_at_target: boolean
  is_feasible: boolean
  editable_components: string[]
  inference_time_ms: number
  baseline: CourseCounterfactualBaselineResponse
  plans: CounterfactualPlanResponse[]
  final_exam_targets: FinalExamTargetSummaryResponse
  recommendations: PedagogicalRecommendationResponse[]
  top_shap_factors: ShapFactorResponse[]
}

export interface CourseAdviseAIRequest extends PredictCourseCounterfactualRequest {
  force_refresh?: boolean
}

export interface CourseAdviseAIResponse {
  course_code: string
  course_name: string | null
  semester_code: string
  target_goal: string
  scenario_code: string | null
  advice_markdown: string
  source: AdviceSource
  model_name: string | null
  cached_at: string | null
}


