import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ACTIVE_SEMESTER_QUERY_KEY } from "@/hooks/use-active-semester";
import type {
  AcademicClass,
  AcademicClassCreatePayload,
  AcademicClassUpdatePayload,
  Admin,
  AdminCreatePayload,
  AdminSystemStats,
  Course,
  CourseCreatePayload,
  CourseUpdatePayload,
  Curriculum,
  CurriculumDetail,
  Lecturer,
  LecturerCreatePayload,
  ModelHealthResponse,
  Semester,
  SemesterCreatePayload,
  SemesterUpdatePayload,
  Student,
  StudentCreatePayload,
  User,
  UserCreatePayload,
  UserRole,
  UserUpdatePayload,
} from "@/types";

export const adminKeys = {
  all: ["admin"] as const,
  stats: () => [...adminKeys.all, "stats"] as const,
  usersRoot: () => [...adminKeys.all, "users"] as const,
  users: (params?: { skip?: number; limit?: number; role?: string; search?: string }) =>
    [...adminKeys.usersRoot(), params] as const,
  admins: () => [...adminKeys.all, "admins"] as const,
  students: () => [...adminKeys.all, "students"] as const,
  lecturers: () => [...adminKeys.all, "lecturers"] as const,
  semesters: () => [...adminKeys.all, "semesters"] as const,
  coursesRoot: () => [...adminKeys.all, "courses"] as const,
  courses: (search?: string) => [...adminKeys.coursesRoot(), search] as const,
  classesRoot: () => [...adminKeys.all, "classes"] as const,
  classes: (params?: { semester_code?: string; search?: string }) =>
    [...adminKeys.classesRoot(), params] as const,
  curriculums: () => [...adminKeys.all, "curriculums"] as const,
  curriculumDetail: (curriculumId?: string) =>
    [...adminKeys.all, "curriculums", curriculumId] as const,
  modelHealth: () => [...adminKeys.all, "model-health"] as const,
};

// ==========================================
// System Stats API (Exact SQL COUNT(*))
// ==========================================

export const useAdminSystemStats = () => {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: async () => {
      const res = await apiClient.get<AdminSystemStats>("/admins/stats");
      return res.data;
    },
    staleTime: 30 * 1000,
  });
};

// ==========================================
// Users & Profiles API
// ==========================================

export interface ListUsersParams {
  skip?: number;
  limit?: number;
  role?: UserRole | "";
  search?: string;
}

export const getAdminUsers = async (params: ListUsersParams = {}): Promise<User[]> => {
  const response = await apiClient.get<User[]>("/users/", {
    params: {
      skip: params.skip ?? 0,
      limit: params.limit ?? 100,
      ...(params.role ? { role: params.role } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    },
  });
  return response.data;
};

export const useAdminUsers = (params: ListUsersParams = {}) => {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => getAdminUsers(params),
    staleTime: 30 * 1000,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UserCreatePayload) => {
      const response = await apiClient.post<User>("/users/", payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersRoot() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: UserUpdatePayload;
    }) => {
      const response = await apiClient.put<User>(`/users/${userId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersRoot() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersRoot() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useCreateAdminProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AdminCreatePayload) => {
      const res = await apiClient.post<Admin>("/admins/", payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.admins() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useCreateStudentProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StudentCreatePayload) => {
      const res = await apiClient.post<Student>("/students/", payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.students() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useCreateLecturerProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LecturerCreatePayload) => {
      const res = await apiClient.post<Lecturer>("/lecturers/", payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.lecturers() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useAdminLecturers = () => {
  return useQuery({
    queryKey: adminKeys.lecturers(),
    queryFn: async () => {
      const res = await apiClient.get<Lecturer[]>("/lecturers/", {
        params: { limit: 500 },
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
};

// ==========================================
// Semesters API
// ==========================================

export const useAdminSemesters = () => {
  return useQuery({
    queryKey: adminKeys.semesters(),
    queryFn: async () => {
      const res = await apiClient.get<Semester[]>("/semesters/", {
        params: { limit: 200 },
      });
      return res.data;
    },
    staleTime: 30 * 1000,
  });
};

export const useCreateSemester = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SemesterCreatePayload) => {
      const res = await apiClient.post<Semester>("/semesters/", payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.semesters() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      void queryClient.invalidateQueries({ queryKey: ACTIVE_SEMESTER_QUERY_KEY() });
    },
  });
};

export const useUpdateSemester = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      semesterCode,
      payload,
    }: {
      semesterCode: string;
      payload: SemesterUpdatePayload;
    }) => {
      const res = await apiClient.put<Semester>(
        `/semesters/${encodeURIComponent(semesterCode)}`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.semesters() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      void queryClient.invalidateQueries({ queryKey: ACTIVE_SEMESTER_QUERY_KEY() });
    },
  });
};

export const useDeleteSemester = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (semesterCode: string) => {
      await apiClient.delete(`/semesters/${encodeURIComponent(semesterCode)}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.semesters() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      void queryClient.invalidateQueries({ queryKey: ACTIVE_SEMESTER_QUERY_KEY() });
    },
  });
};

export const useSwitchActiveSemester = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetSemesterCode: string) => {
      // Backend atomically deactivates previous active semesters inside 1 DB transaction
      const res = await apiClient.put<Semester>(
        `/semesters/${encodeURIComponent(targetSemesterCode)}`,
        { is_active: true },
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.semesters() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      void queryClient.invalidateQueries({ queryKey: ACTIVE_SEMESTER_QUERY_KEY() });
    },
  });
};

// ==========================================
// Courses, Classes & Curriculums API
// ==========================================

export const useAdminCourses = (search?: string) => {
  return useQuery({
    queryKey: adminKeys.courses(search),
    queryFn: async () => {
      const res = await apiClient.get<Course[]>("/courses/", {
        params: {
          limit: 500,
          ...(search?.trim() ? { search: search.trim() } : {}),
        },
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
};

export const useCreateCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CourseCreatePayload) => {
      const res = await apiClient.post<Course>("/courses/", payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.coursesRoot() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useUpdateCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      courseCode,
      payload,
    }: {
      courseCode: string;
      payload: CourseUpdatePayload;
    }) => {
      const res = await apiClient.put<Course>(
        `/courses/${encodeURIComponent(courseCode)}`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.coursesRoot() });
    },
  });
};

export const useDeleteCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (courseCode: string) => {
      await apiClient.delete(`/courses/${encodeURIComponent(courseCode)}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.coursesRoot() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useAdminClasses = (params?: {
  semester_code?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: adminKeys.classes(params),
    queryFn: async () => {
      const res = await apiClient.get<AcademicClass[]>("/classes/", {
        params: {
          limit: 500,
          ...(params?.semester_code ? { semester_code: params.semester_code } : {}),
          ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
        },
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
};

export const useCreateClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AcademicClassCreatePayload) => {
      const res = await apiClient.post<AcademicClass>("/classes/", payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.classesRoot() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useUpdateClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      classId,
      payload,
    }: {
      classId: string;
      payload: AcademicClassUpdatePayload;
    }) => {
      const res = await apiClient.put<AcademicClass>(
        `/classes/${encodeURIComponent(classId)}`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.classesRoot() });
    },
  });
};

export const useDeleteClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (classId: string) => {
      await apiClient.delete(`/classes/${encodeURIComponent(classId)}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.classesRoot() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
};

export const useAdminCurriculums = () => {
  return useQuery({
    queryKey: adminKeys.curriculums(),
    queryFn: async () => {
      const res = await apiClient.get<Curriculum[]>("/curriculums/", {
        params: { limit: 200 },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useAdminCurriculumDetail = (curriculumId?: string) => {
  return useQuery({
    queryKey: adminKeys.curriculumDetail(curriculumId),
    queryFn: async () => {
      const res = await apiClient.get<CurriculumDetail>(
        `/curriculums/${encodeURIComponent(curriculumId!)}`,
      );
      return res.data;
    },
    enabled: Boolean(curriculumId),
    staleTime: 5 * 60 * 1000,
  });
};

// ==========================================
// AI Model Health API
// ==========================================

export const useModelHealth = () => {
  return useQuery({
    queryKey: adminKeys.modelHealth(),
    queryFn: async (): Promise<ModelHealthResponse | null> => {
      try {
        const res = await apiClient.get<ModelHealthResponse>("/predictions/health");
        return res.data;
      } catch {
        return null;
      }
    },
    staleTime: 30 * 1000,
    retry: false,
  });
};
