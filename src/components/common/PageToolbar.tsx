import type { ReactNode } from "react";
import { IconButton } from "@/components/common/IconButton";
import { useOptionalPageViewMode } from "@/components/common/PageViewMode";
import {
  GuiViewIcon,
  TableListViewIcon,
} from "@/components/icons/ToolbarIcons";
import "./css/page-toolbar.css";

export type { PageViewMode } from "@/components/common/PageViewMode";

export interface PageToolbarProps {
  /** 왼쪽 액션 영역 (IconButton 등) */
  actions?: ReactNode;
  /** 액션 오른쪽 본문 (브레드크럼, 안내 문구 등) */
  children?: ReactNode;
  className?: string;
  /** 본문 영역 추가 class */
  bodyClassName?: string;
}

/**
 * 파일 탐색기·Docker 등 페이지 상단 툴바 공통 레이아웃.
 * 보기 토글은 PageViewModeProvider 하위에서만 표시된다.
 */
export function PageToolbar({
  actions,
  children,
  className,
  bodyClassName,
}: PageToolbarProps) {
  const viewModeCtx = useOptionalPageViewMode();

  const rootClass = ["page-toolbar", className].filter(Boolean).join(" ");
  const bodyClass = ["page-toolbar__body", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {actions != null ? (
        <div className="page-toolbar__actions">{actions}</div>
      ) : null}
      {children != null ? <div className={bodyClass}>{children}</div> : null}

      {viewModeCtx ? (
        <div
          className="page-toolbar__view-toggle"
          role="group"
          aria-label="보기 방식"
        >
          <IconButton
            tone="neutral"
            tooltip="GUI 보기"
            aria-label="GUI 보기"
            aria-pressed={viewModeCtx.viewMode === "gui"}
            className={
              viewModeCtx.viewMode === "gui"
                ? "page-toolbar__view-btn page-toolbar__view-btn--active"
                : "page-toolbar__view-btn"
            }
            onClick={() => viewModeCtx.setViewMode("gui")}
          >
            <GuiViewIcon />
          </IconButton>
          <IconButton
            tone="neutral"
            tooltip="리스트 보기"
            aria-label="리스트 보기"
            aria-pressed={viewModeCtx.viewMode === "tableList"}
            className={
              viewModeCtx.viewMode === "tableList"
                ? "page-toolbar__view-btn page-toolbar__view-btn--active"
                : "page-toolbar__view-btn"
            }
            onClick={() => viewModeCtx.setViewMode("tableList")}
          >
            <TableListViewIcon />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}
