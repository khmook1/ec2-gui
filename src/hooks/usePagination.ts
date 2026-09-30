import { useCallback, useState } from "react";

export interface UsePaginationOptions {
  initialPage?: number;
  /** 값이 바뀌면 1페이지로 돌아간다 (필터·검색어·페이지 크기 등) */
  resetDeps?: readonly unknown[];
  /** 페이지가 바뀔 때마다 호출 (리셋 포함). 선택 해제 등에 사용 */
  onPageChange?: (page: number) => void;
}

export interface PaginationState {
  page: number;
  setPage: (page: number) => void;
  reset: () => void;
}

export function usePagination({
  initialPage = 1,
  resetDeps = [],
  onPageChange,
}: UsePaginationOptions = {}): PaginationState {
  const [page, setPageState] = useState(initialPage);
  const resetKey = JSON.stringify(resetDeps);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (page !== 1) {
      setPageState(1);
      onPageChange?.(1);
    }
  }

  const setPage = useCallback(
    (next: number) => {
      const safe = Math.max(1, Math.floor(next));
      setPageState(safe);
      onPageChange?.(safe);
    },
    [onPageChange],
  );

  const reset = useCallback(() => setPage(1), [setPage]);

  return { page, setPage, reset };
}
