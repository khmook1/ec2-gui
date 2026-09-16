import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

interface UseDeferredAsyncResourceOptions<TKey extends string, TData> {
  /** null이면 닫힘. 값이 바뀌면 즉시 로딩 상태로 리셋한다. */
  key: TKey | null;
  load: (key: TKey) => Promise<TData>;
  fallbackErrorMessage?: string;
  mapError?: (error: unknown) => string;
}

interface UseDeferredAsyncResourceResult<TData> {
  data: TData | null;
  isLoading: boolean;
  errorMessage: string | null;
  isOpen: boolean;
  reload: () => void;
}

/**
 * 다이얼로그를 먼저 띄운 뒤, 한 프레임 양보하고 비동기 로드를 시작한다.
 * Tauri sync 커맨드가 메인 스레드를 막는 경우에도 모달 셸이 먼저 페인트되도록 한다.
 * (커맨드 쪽은 `#[tauri::command(async)]`와 함께 쓰는 것을 권장)
 */
export function useDeferredAsyncResource<TKey extends string, TData>({
  key,
  load,
  fallbackErrorMessage = "데이터를 불러오지 못했습니다.",
  mapError,
}: UseDeferredAsyncResourceOptions<TKey, TData>): UseDeferredAsyncResourceResult<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(() => key != null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadRef = useRef(load);
  const mapErrorRef = useRef(mapError);
  const fallbackRef = useRef(fallbackErrorMessage);
  loadRef.current = load;
  mapErrorRef.current = mapError;
  fallbackRef.current = fallbackErrorMessage;

  useLayoutEffect(() => {
    if (key == null) {
      setData(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    setData(null);
    setErrorMessage(null);
    setIsLoading(true);
  }, [key]);

  useEffect(() => {
    if (key == null) {
      return;
    }

    let cancelled = false;
    const paintFrame = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const next = await loadRef.current(key);
          if (!cancelled) {
            setData(next);
            setErrorMessage(null);
          }
        } catch (error) {
          if (!cancelled) {
            const mapper = mapErrorRef.current;
            setErrorMessage(
              mapper
                ? mapper(error)
                : toErrorMessage(error, fallbackRef.current),
            );
            setData(null);
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(paintFrame);
    };
  }, [key, reloadToken]);

  const reload = useCallback(() => {
    if (key == null) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setReloadToken((token) => token + 1);
  }, [key]);

  return {
    data,
    isLoading,
    errorMessage,
    isOpen: key != null,
    reload,
  };
}
