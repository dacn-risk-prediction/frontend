import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Semester } from "@/types";

export const ACTIVE_SEMESTER_QUERY_KEY = () =>
  ["semesters", "active"] as const;

/**
 * Fetch active semester configuration
 * GET /api/v1/semesters/active
 */
export const getActiveSemester = async (): Promise<Semester | null> => {
  try {
    const response = await apiClient.get<Semester>("/semesters/active");
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

export const useActiveSemester = () => {
  return useQuery({
    queryKey: ACTIVE_SEMESTER_QUERY_KEY(),
    queryFn: getActiveSemester,
    staleTime: 30 * 60 * 1000,
  });
};

export function formatSemesterLabel(semesterCode?: string | null): string {
  if (!semesterCode) return "Active Semester";
  return semesterCode.startsWith("HK")
    ? `Học kỳ ${semesterCode.slice(2)}`
    : semesterCode;
}
