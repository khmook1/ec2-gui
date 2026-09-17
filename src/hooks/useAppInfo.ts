import { useAppInfoQuery } from "@/hooks/query";
import type { AppRuntimeStatus } from "@/types/app";

export function useAppInfo() {
  const query = useAppInfoQuery();

  const status: AppRuntimeStatus = query.isPending
    ? "loading"
    : query.isError
      ? "error"
      : query.isSuccess
        ? "ready"
        : "idle";

  const errorMessage =
    query.error instanceof Error
      ? query.error.message
      : query.isError
        ? "앱 정보를 불러오지 못했습니다."
        : null;

  return {
    status,
    appInfo: query.data ?? null,
    errorMessage,
    isReady: status === "ready",
  };
}
