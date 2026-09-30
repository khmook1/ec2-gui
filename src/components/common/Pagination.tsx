import type { ReactNode } from "react";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import "./css/pagination.css";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChangePage: (page: number) => void;
  ariaLabel?: string;
}

function buildPageNumbers(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  for (const value of sorted) {
    const prev = result[result.length - 1];
    if (typeof prev === "number" && value - prev > 1) {
      result.push("gap");
    }
    result.push(value);
  }
  return result;
}

export function PaginationBar({
  page,
  totalPages,
  disabled = false,
  onChangePage,
  ariaLabel = "페이지",
}: PaginationBarProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <button
        type="button"
        className="pagination__btn"
        disabled={disabled || page <= 1}
        onClick={() => onChangePage(page - 1)}
      >
        이전
      </button>
      {buildPageNumbers(page, totalPages).map((value, index) =>
        value === "gap" ? (
          <span key={`gap-${index}`} className="pagination__gap">
            …
          </span>
        ) : (
          <button
            key={value}
            type="button"
            className={[
              "pagination__btn",
              value === page ? "pagination__btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={value === page ? "page" : undefined}
            disabled={disabled}
            onClick={() => onChangePage(value)}
          >
            {value}
          </button>
        ),
      )}
      <button
        type="button"
        className="pagination__btn"
        disabled={disabled || page >= totalPages}
        onClick={() => onChangePage(page + 1)}
      >
        다음
      </button>
    </nav>
  );
}

export interface PaginatedContentProps {
  page: number;
  totalPages: number;
  onChangePage: (page: number) => void;
  /** 데이터 조회 중이면 목록 위에 로딩 UI를 덮고 페이지 버튼을 잠근다 */
  isFetching: boolean;
  loadingMessage?: string;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

/**
 * 페이지 단위 목록 공통 셸. 목록(children) 아래에 페이지 바를 붙이고,
 * `isFetching` 동안 로딩 오버레이를 자동으로 표시한다.
 */
export function PaginatedContent({
  page,
  totalPages,
  onChangePage,
  isFetching,
  loadingMessage = "페이지를 불러오는 중",
  ariaLabel,
  className,
  children,
}: PaginatedContentProps) {
  return (
    <div className={["paginated", className].filter(Boolean).join(" ")}>
      <div className="paginated__body" aria-busy={isFetching || undefined}>
        {children}
        {isFetching ? (
          <div className="paginated__overlay">
            <LoadingIndicator size={72} message={loadingMessage} />
          </div>
        ) : null}
      </div>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        disabled={isFetching}
        onChangePage={onChangePage}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
