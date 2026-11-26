/**
 * Shared formatting and API error extraction utilities.
 */

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "AU";
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function extractApiError(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (
      err as {
        response?: { data?: { detail?: string | Array<{ msg?: string }> } };
      }
    ).response;
    const detail = response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg;
    }
  }
  return fallback;
}
