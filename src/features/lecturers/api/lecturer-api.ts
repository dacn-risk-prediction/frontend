import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { AUTH_QUERY_KEY } from "@/features/auth";
import {
  ACTIVE_SEMESTER_QUERY_KEY,
  getActiveSemester,
  useActiveSemester,
} from "@/hooks/use-active-semester";
import type {
  ClassPrediction,
  CourseAssessment,
  Enrollment,
  Lecturer,
  LecturerCurrentClassItem,
  LecturerDetail,
  LecturerUpdatePayload,
  User,
  UserUpdatePayload,
} from "@/types";

export {
  ACTIVE_SEMESTER_QUERY_KEY,
  getActiveSemester,
  useActiveSemester,
};

export const LECTURER_CURRENT_CLASSES_QUERY_KEY = (lecturerId?: string) =>
  ["lecturers", lecturerId, "current-classes"] as const;

export const LECTURER_DETAIL_QUERY_KEY = (lecturerId?: string) =>
  ["lecturers", lecturerId, "detail"] as const;

export const CLASS_ENROLLMENTS_QUERY_KEY = (classId?: string) =>
  ["enrollments", "classes", classId] as const;

export const CLASS_PREDICTIONS_QUERY_KEY = (
  classId?: string,
  includeShap: boolean = true
) => ["predictions", "classes", classId, includeShap] as const;

export const COURSE_ASSESSMENT_QUERY_KEY = (courseCode?: string) =>
  ["courses", courseCode, "assessment"] as const;

/**
 * Fetch classes taught by lecturer in the current active semester
 * GET /api/v1/lecturers/{lecturer_id}/current
 */
export const getLecturerCurrentClasses = async (
  lecturerId: string
): Promise<LecturerCurrentClassItem[]> => {
  try {
    const response = await apiClient.get<LecturerCurrentClassItem[]>(
      `/lecturers/${lecturerId}/current`
    );
    return response.data ?? [];
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return [];
    }
    throw error;
  }
};

/**
 * Fetch lecturer profile details
 * GET /api/v1/lecturers/{lecturer_id}
 */
export const getLecturerDetail = async (
  lecturerId: string
): Promise<LecturerDetail | null> => {
  try {
    const response = await apiClient.get<LecturerDetail>(
      `/lecturers/${lecturerId}`
    );
    return response.data;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return null;
    }
    throw error;
  }
};

/**
 * Fetch class grade roster & enrollments
 * GET /api/v1/enrollments/classes/{class_id}
 */
export const getClassEnrollments = async (
  classId: string
): Promise<Enrollment[]> => {
  try {
    const response = await apiClient.get<Enrollment[]>(
      `/enrollments/classes/${classId}`,
      {
        params: { limit: 500 },
      }
    );
    return response.data ?? [];
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return [];
    }
    throw error;
  }
};

/**
 * Fetch AI predictions and risk analytics for an entire class (Batch inference)
 * GET /api/v1/predictions/classes/{class_id}?include_shap=true
 */
export const getClassPredictions = async (
  classId: string,
  includeShap: boolean = true
): Promise<ClassPrediction | null> => {
  try {
    const response = await apiClient.get<ClassPrediction>(
      `/predictions/classes/${classId}`,
      {
        params: { include_shap: includeShap },
      }
    );
    return response.data;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      ((error as { response?: { status?: number } }).response?.status === 404 ||
        (error as { response?: { status?: number } }).response?.status === 503)
    ) {
      return null;
    }
    throw error;
  }
};

/**
 * Fetch course grading weights breakdown
 * GET /api/v1/courses/{course_code}/assessment
 */
export const getCourseAssessment = async (
  courseCode: string
): Promise<CourseAssessment | null> => {
  try {
    const response = await apiClient.get<CourseAssessment>(
      `/courses/${courseCode}/assessment`
    );
    return response.data;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return null;
    }
    throw error;
  }
};

// ==========================================
// TanStack Query Hooks
// ==========================================

export const useLecturerCurrentClasses = (lecturerId?: string) => {
  return useQuery({
    queryKey: LECTURER_CURRENT_CLASSES_QUERY_KEY(lecturerId),
    queryFn: () => getLecturerCurrentClasses(lecturerId!),
    enabled: Boolean(lecturerId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useLecturerDetail = (lecturerId?: string) => {
  return useQuery({
    queryKey: LECTURER_DETAIL_QUERY_KEY(lecturerId),
    queryFn: () => getLecturerDetail(lecturerId!),
    enabled: Boolean(lecturerId),
    staleTime: 10 * 60 * 1000,
  });
};

export const useClassEnrollments = (classId?: string) => {
  return useQuery({
    queryKey: CLASS_ENROLLMENTS_QUERY_KEY(classId),
    queryFn: () => getClassEnrollments(classId!),
    enabled: Boolean(classId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useClassPredictions = (
  classId?: string,
  includeShap: boolean = true
) => {
  return useQuery({
    queryKey: CLASS_PREDICTIONS_QUERY_KEY(classId, includeShap),
    queryFn: () => getClassPredictions(classId!, includeShap),
    enabled: Boolean(classId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAllClassesEnrollments = (classIds: string[]) => {
  return useQueries({
    queries: classIds.map((classId) => ({
      queryKey: CLASS_ENROLLMENTS_QUERY_KEY(classId),
      queryFn: () => getClassEnrollments(classId),
      staleTime: 5 * 60 * 1000,
    })),
  });
};

export const useAllClassesPredictions = (
  classIds: string[],
  includeShap: boolean = true
) => {
  return useQueries({
    queries: classIds.map((classId) => ({
      queryKey: CLASS_PREDICTIONS_QUERY_KEY(classId, includeShap),
      queryFn: () => getClassPredictions(classId, includeShap),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
};

export const useCourseAssessment = (courseCode?: string) => {
  return useQuery({
    queryKey: COURSE_ASSESSMENT_QUERY_KEY(courseCode),
    queryFn: () => getCourseAssessment(courseCode!),
    enabled: Boolean(courseCode),
    staleTime: 30 * 60 * 1000,
  });
};

export const useUpdateLecturerProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      lecturerId,
      userPayload,
      lecturerPayload,
    }: {
      userId: string;
      lecturerId?: string;
      userPayload: UserUpdatePayload;
      lecturerPayload?: LecturerUpdatePayload;
    }) => {
      const updatedUser = await apiClient.put<User>(
        `/users/${userId}`,
        userPayload,
      );
      let updatedLecturer: Lecturer | null = null;
      if (lecturerId && lecturerPayload) {
        const res = await apiClient.put<Lecturer>(
          `/lecturers/${encodeURIComponent(lecturerId)}`,
          lecturerPayload,
        );
        updatedLecturer = res.data;
      }
      return { user: updatedUser.data, lecturer: updatedLecturer };
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      if (variables.lecturerId) {
        void queryClient.invalidateQueries({
          queryKey: LECTURER_DETAIL_QUERY_KEY(variables.lecturerId),
        });
      }
    },
  });
};
