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
  user_id: string | null
}

export interface StudentDetail extends Student {
  user: User | null
}

export interface StudentCreatePayload {
  student_id: string
  cohort: string
  major: string
  user_id?: string | null
}

export interface StudentUpdatePayload {
  cohort?: string
  major?: string
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

export interface CourseDetail extends Course {
  prerequisites: CoursePrerequisite[]
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
// Semester Types
// ==========================================
export interface Semester {
  semester_code: string
  academic_year: string
  term: number
}

export interface SemesterCreatePayload {
  semester_code: string
  academic_year: string
  term: number
}

export interface SemesterUpdatePayload {
  academic_year?: string
  term?: number
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

