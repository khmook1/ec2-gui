import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { getAppInfo } from "@/services/tauri";

export function useAppInfoQuery() {
  return useQuery({
    queryKey: queryKeys.appInfo,
    queryFn: getAppInfo,
  });
}
