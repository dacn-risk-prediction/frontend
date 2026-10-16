import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { StudentAcademicSummary } from "@/types"

export const STUDENT_SUMMARY_QUERY_KEY = (studentId?: string) =>
  ["students", studentId, "summary"] as const

export const getStudentSummary = async (
  studentId: string
): Promise<StudentAcademicSummary> => {
  const response = await apiClient.get<StudentAcademicSummary>(
    `/students/${studentId}/summary`
  )
  return response.data
}

export const useStudentSummary = (studentId?: string) => {
  return useQuery({
    queryKey: STUDENT_SUMMARY_QUERY_KEY(studentId),
    queryFn: () => getStudentSummary(studentId!),
    enabled: Boolean(studentId),
    staleTime: 5 * 60 * 1000,
  })
}

