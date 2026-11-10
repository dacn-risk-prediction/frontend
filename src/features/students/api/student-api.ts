import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type {
  Course,
  CoursePredictionResponse,
  Enrollment,
  PredictCourseRequest,
  StudentAcademicSummary,
  StudentCurrentCourseItem,
  StudentDetail,
  StudentPredictionResponse,
} from "@/types"

export type {
  CoursePredictionResponse,
  StudentCurrentCourseItem,
  StudentHK261CourseItem,
  StudentPredictionResponse,
} from "@/types"

export const STUDENT_SUMMARY_QUERY_KEY = (studentId?: string) =>
  ["students", studentId, "summary"] as const

export const STUDENT_DETAIL_QUERY_KEY = (studentId?: string) =>
  ["students", studentId, "detail"] as const

export const STUDENT_CURRENT_COURSES_QUERY_KEY = (studentId?: string) =>
  ["students", studentId, "current-courses"] as const

// Backward compatibility alias
export const STUDENT_HK261_COURSES_QUERY_KEY = STUDENT_CURRENT_COURSES_QUERY_KEY

export const STUDENT_ENROLLMENTS_QUERY_KEY = (
  studentId?: string,
  semesterCode?: string
) => ["enrollments", "students", studentId, semesterCode] as const

export const COURSES_QUERY_KEY = () => ["courses"] as const

export const STUDENT_PREDICTIONS_QUERY_KEY = (
  studentId?: string,
  semesterCode?: string
) => ["predictions", "students", studentId, semesterCode] as const

export const COURSE_PREDICTION_QUERY_KEY = (
  studentId?: string,
  courseCode?: string,
  semesterCode?: string
) => ["predictions", "course", studentId, courseCode, semesterCode] as const

export const getStudentSummary = async (
  studentId: string
): Promise<StudentAcademicSummary> => {
  const response = await apiClient.get<StudentAcademicSummary>(
    `/students/${studentId}/summary`
  )
  return response.data
}

export const getStudentDetail = async (
  studentId: string
): Promise<StudentDetail | null> => {
  try {
    const response = await apiClient.get<StudentDetail>(
      `/students/${studentId}`
    )
    return response.data
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return null
    }
    throw error
  }
}

export const getStudentCurrentCourses = async (
  studentId: string
): Promise<StudentCurrentCourseItem[]> => {
  try {
    const response = await apiClient.get<StudentCurrentCourseItem[]>(
      `/students/${studentId}/current`
    )
    return response.data
  } catch (error: unknown) {
    // 404 occurs when student has graduated or has no registered courses in the current semester
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return []
    }
    throw error
  }
}

// Backward compatibility alias
export const getStudentHK261Courses = getStudentCurrentCourses

export const getStudentEnrollments = async (
  studentId: string,
  semesterCode?: string
): Promise<Enrollment[]> => {
  try {
    const response = await apiClient.get<Enrollment[]>(
      `/enrollments/students/${studentId}`,
      {
        params: semesterCode ? { semester_code: semesterCode } : undefined,
      }
    )
    return response.data
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return []
    }
    throw error
  }
}

export const getAllCourses = async (): Promise<Course[]> => {
  try {
    const response = await apiClient.get<Course[]>("/courses/", {
      params: { limit: 500 },
    })
    return response.data
  } catch {
    return []
  }
}

/**
 * Fetch term outcome predictions and XAI explanations for all courses enrolled by student
 * GET /api/v1/predictions/students/{student_id}
 */
export const getStudentPredictions = async (
  studentId: string,
  semesterCode?: string
): Promise<StudentPredictionResponse | null> => {
  try {
    const response = await apiClient.get<StudentPredictionResponse>(
      `/predictions/students/${studentId}`,
      {
        params: semesterCode ? { semester_code: semesterCode } : undefined,
      }
    )
    return response.data
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      ((error as { response?: { status?: number } }).response?.status === 404 ||
        (error as { response?: { status?: number } }).response?.status === 503)
    ) {
      return null
    }
    throw error
  }
}

/**
 * Predict risk outcome and SHAP explanations for a single course enrollment
 * POST /api/v1/predictions/course
 */
export const getCoursePrediction = async (
  payload: PredictCourseRequest
): Promise<CoursePredictionResponse | null> => {
  try {
    const response = await apiClient.post<CoursePredictionResponse>(
      "/predictions/course",
      payload
    )
    return response.data
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      ((error as { response?: { status?: number } }).response?.status === 404 ||
        (error as { response?: { status?: number } }).response?.status === 503)
    ) {
      return null
    }
    throw error
  }
}

export const useStudentSummary = (studentId?: string) => {
  return useQuery({
    queryKey: STUDENT_SUMMARY_QUERY_KEY(studentId),
    queryFn: () => getStudentSummary(studentId!),
    enabled: Boolean(studentId),
    staleTime: 5 * 60 * 1000,
  })
}

export const useStudentDetail = (studentId?: string) => {
  return useQuery({
    queryKey: STUDENT_DETAIL_QUERY_KEY(studentId),
    queryFn: () => getStudentDetail(studentId!),
    enabled: Boolean(studentId),
    staleTime: 5 * 60 * 1000,
  })
}

export const useStudentCurrentCourses = (studentId?: string) => {
  return useQuery({
    queryKey: STUDENT_CURRENT_COURSES_QUERY_KEY(studentId),
    queryFn: () => getStudentCurrentCourses(studentId!),
    enabled: Boolean(studentId),
    staleTime: 5 * 60 * 1000,
  })
}

// Backward compatibility alias
export const useStudentHK261Courses = useStudentCurrentCourses

export const useStudentEnrollments = (
  studentId?: string,
  semesterCode?: string
) => {
  return useQuery({
    queryKey: STUDENT_ENROLLMENTS_QUERY_KEY(studentId, semesterCode),
    queryFn: () => getStudentEnrollments(studentId!, semesterCode),
    enabled: Boolean(studentId),
    staleTime: 5 * 60 * 1000,
  })
}

export const useAllCourses = () => {
  return useQuery({
    queryKey: COURSES_QUERY_KEY(),
    queryFn: getAllCourses,
    staleTime: 30 * 60 * 1000,
  })
}

/**
 * Hook to retrieve holistic AI predictions across all courses enrolled in active semester
 */
export const useStudentPredictions = (
  studentId?: string,
  semesterCode?: string
) => {
  return useQuery({
    queryKey: STUDENT_PREDICTIONS_QUERY_KEY(studentId, semesterCode),
    queryFn: () => getStudentPredictions(studentId!, semesterCode),
    enabled: Boolean(studentId),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to retrieve single course prediction and TreeSHAP explanations
 */
export const useCoursePrediction = (
  studentId?: string,
  courseCode?: string,
  semesterCode?: string
) => {
  return useQuery({
    queryKey: COURSE_PREDICTION_QUERY_KEY(studentId, courseCode, semesterCode),
    queryFn: () =>
      getCoursePrediction({
        student_id: studentId!,
        course_code: courseCode!,
        semester_code: semesterCode,
      }),
    enabled: Boolean(studentId && courseCode),
    staleTime: 5 * 60 * 1000,
  })
}



