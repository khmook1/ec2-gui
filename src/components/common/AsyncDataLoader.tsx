import type { ReactNode } from "react";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import "./css/async-data-loader.css";

interface AsyncDataLoaderProps {
  /** 캐시·이전 데이터 없이 최초 로드 중일 때 */
  isLoading: boolean;
  /** 화면에 바로 그릴 캐시·데이터가 있는지 */
  hasData: boolean;
  message?: string;
  children: ReactNode;
}

export function AsyncDataLoader({
  isLoading,
  hasData,
  message = "데이터를 가져옵니다",
  children,
}: AsyncDataLoaderProps) {
  if (isLoading && !hasData) {
    return <LoadingIndicator layout="fill" message={message} />;
  }

  return <div className="async-load-host">{children}</div>;
}
