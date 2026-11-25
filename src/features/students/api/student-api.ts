import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { AUTH_QUERY_KEY } from "@/features/auth"
import type {
  Course,
  CourseAdviseAIRequest,
  CourseAdviseAIResponse,
  CourseAssessment,
  CourseCounterfactualResponse,
  CourseDetail,
  CoursePredictionResponse,
  Curriculum,
  CurriculumDetail,
  Enrollment,
  PredictCourseCounterfactualRequest,
  PredictCourseRequest,
  StudentAcademicSummary,
  StudentCurrentCourseItem,
  StudentDetail,
  StudentPredictionResponse,
  TargetGoal,
  User,
  UserUpdatePayload,
} from "@/types"

export type {
  CourseAdviseAIRequest,
  CourseAdviseAIResponse,
  CourseAssessment,
  CourseCounterfactualResponse,
  CoursePredictionResponse,
  PredictCourseCounterfactualRequest,
  StudentCurrentCourseItem,
  StudentHK261CourseItem,
  StudentPredictionResponse,
  TargetGoal,
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

export const COURSE_COUNTERFACTUAL_QUERY_KEY = (
  studentId?: string,
  courseCode?: string,
  semesterCode?: string,
  targetGoal: TargetGoal = "PASS"
) =>
  [
    "predictions",
    "course-counterfactual",
    studentId,
    courseCode,
    semesterCode,
    targetGoal,
  ] as const

export const STUDENT_COURSE_ASSESSMENT_QUERY_KEY = (courseCode?: string) =>
  ["courses", courseCode, "assessment"] as const

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
        params: semesterCode
          ? { semester_code: semesterCode, limit: 500 }
          : { limit: 500 },
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

/**
 * Compute constrained counterfactual recourse plans & 13-scenario pedagogical advice
 * POST /api/v1/predictions/course/counterfactual
 */
export const getCourseCounterfactual = async (
  payload: PredictCourseCounterfactualRequest
): Promise<CourseCounterfactualResponse | null> => {
  try {
    const response = await apiClient.post<CourseCounterfactualResponse>(
      "/predictions/course/counterfactual",
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

/**
 * Generate on-demand grounded natural-language AI advice with cache & fallback
 * POST /api/v1/predictions/course/advise-ai
 */
export const adviseCourseWithAI = async (
  payload: CourseAdviseAIRequest
): Promise<CourseAdviseAIResponse> => {
  const response = await apiClient.post<CourseAdviseAIResponse>(
    "/predictions/course/advise-ai",
    payload
  )
  return response.data
}

/**
 * Fetch course grading weights breakdown
 * GET /api/v1/courses/{course_code}/assessment
 */
export const getStudentCourseAssessment = async (
  courseCode: string
): Promise<CourseAssessment | null> => {
  try {
    const response = await apiClient.get<CourseAssessment>(
      `/courses/${courseCode}/assessment`
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
  semesterCode?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: COURSE_PREDICTION_QUERY_KEY(studentId, courseCode, semesterCode),
    queryFn: () =>
      getCoursePrediction({
        student_id: studentId!,
        course_code: courseCode!,
        semester_code: semesterCode,
      }),
    enabled: Boolean(studentId && courseCode) && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to compute constrained counterfactual recourse & pedagogical advice for a course
 */
export const useCourseCounterfactual = (
  studentId?: string,
  courseCode?: string,
  semesterCode?: string,
  targetGoal: TargetGoal = "PASS",
  options?: {
    enabled?: boolean
    whatIfMarks?: Record<string, number | null> | null
    allowImproveRecordedProcess?: boolean
    lockedComponents?: string[] | null
  }
) => {
  const whatIfMarks = options?.whatIfMarks ?? null
  return useQuery({
    queryKey: whatIfMarks
      ? [
          ...COURSE_COUNTERFACTUAL_QUERY_KEY(
            studentId,
            courseCode,
            semesterCode,
            targetGoal
          ),
          whatIfMarks,
        ]
      : COURSE_COUNTERFACTUAL_QUERY_KEY(
          studentId,
          courseCode,
          semesterCode,
          targetGoal
        ),
    queryFn: () =>
      getCourseCounterfactual({
        student_id: studentId!,
        course_code: courseCode!,
        semester_code: semesterCode,
        target_goal: targetGoal,
        locked_components: options?.lockedComponents ?? null,
        allow_improve_recorded_process:
          options?.allowImproveRecordedProcess ?? true,
        what_if_marks: whatIfMarks,
      }),
    enabled: Boolean(studentId && courseCode) && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

/**
 * On-demand mutation for grounded natural-language Gemini AI advice
 */
export const useAdviseCourseWithAI = () => {
  return useMutation({
    mutationFn: (payload: CourseAdviseAIRequest) => adviseCourseWithAI(payload),
  })
}

/**
 * Batch-fetch grading weights breakdown for multiple courses (used in What-If simulator)
 */
export const useStudentCourseAssessments = (courseCodes: string[]) => {
  return useQueries({
    queries: courseCodes.map((code) => ({
      queryKey: STUDENT_COURSE_ASSESSMENT_QUERY_KEY(code),
      queryFn: () => getStudentCourseAssessment(code),
      staleTime: 30 * 60 * 1000,
      retry: false,
    })),
  })
}

export const useCurriculums = (cohort?: string) => {
  return useQuery({
    queryKey: ["curriculums", cohort ?? "all"] as const,
    queryFn: async (): Promise<Curriculum[]> => {
      const response = await apiClient.get<Curriculum[]>("/curriculums/", {
        params: { limit: 200, ...(cohort ? { cohort } : {}) },
      })
      return response.data
    },
    staleTime: 30 * 60 * 1000,
  })
}

export const useCurriculumDetail = (curriculumId?: string) => {
  return useQuery({
    queryKey: ["curriculums", curriculumId, "detail"] as const,
    queryFn: async (): Promise<CurriculumDetail> => {
      const response = await apiClient.get<CurriculumDetail>(
        `/curriculums/${encodeURIComponent(curriculumId!)}`
      )
      return response.data
    },
    enabled: Boolean(curriculumId),
    staleTime: 30 * 60 * 1000,
  })
}

export const useCourseDetail = (courseCode?: string) => {
  return useQuery({
    queryKey: ["courses", courseCode, "detail"] as const,
    queryFn: async (): Promise<CourseDetail | null> => {
      try {
        const response = await apiClient.get<CourseDetail>(
          `/courses/${encodeURIComponent(courseCode!)}`
        )
        return response.data
      } catch {
        return null
      }
    },
    enabled: Boolean(courseCode),
    staleTime: 30 * 60 * 1000,
  })
}

export const useUpdateStudentAccount = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string
      payload: UserUpdatePayload
    }): Promise<User> => {
      const response = await apiClient.put<User>(`/users/${userId}`, payload)
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
    },
  })
}



