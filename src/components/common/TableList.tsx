import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";

export const SORT_DIRECTION = {
  ASC: "ASC",
  DESC: "DESC",
} as const;

export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

export type TableAlign = "left" | "center" | "right";

export interface TableColumnSetting<T> {
  /** 헤더 문구 */
  name: ReactNode;
  /** 헤더/셀 너비 */
  width?: string | number;
  /** 셀 속성 (align 등) */
  colProp?: {
    align?: TableAlign;
  };
  /** true면 행 번호 표시 */
  isIndex?: boolean;
  /** list 항목의 키 */
  colKey?: keyof T & string;
  /** 커스텀 셀 렌더 */
  render?: (row: T, index: number) => ReactNode;
  /** 정렬 키 (onChangeSort와 함께 사용) */
  sortKey?: string;
  /** 열 숨김 가능 여부 */
  hidable?: boolean;
  /** 초기 숨김 */
  defaultHide?: boolean;
  className?: string;
}

export interface TableListMeta {
  currentPage: number;
  currentTake: number;
  totalPage: number;
}

export interface TableListProps<T> {
  list?: T[];
  settings: TableColumnSetting<T>[];
  isLoading?: boolean;
  /** 행 고유 키. 없으면 index 사용 */
  getRowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  onRowContextMenu?: (row: T, index: number, event: MouseEvent) => void;
  onBackgroundClick?: () => void;
  getRowClassName?: (row: T, index: number) => string | undefined;
  getRowStyle?: (
    row: T,
    index: number,
    isLast: boolean,
  ) => CSSProperties | undefined;
  headerShow?: boolean;
  emptyMessage?: ReactNode;
  loadingMessage?: ReactNode;
  /** `sortKey:ASC|DESC` 형식 */
  sortOrder?: string;
  onChangeSort?: (sortKey: string, direction: SortDirection) => void;
  meta?: TableListMeta;
  onChangePage?: (page: number) => void;
  hidePagination?: boolean;
  fillHeight?: boolean;
  className?: string;
  ariaLabel?: string;
  maxHeight?: number | string;
}

function SortIcons({
  active,
  descending,
}: {
  active: boolean;
  descending: boolean;
}) {
  return (
    <span className="table-list__sort" aria-hidden>
      <svg
        className={[
          "table-list__sort-icon",
          active && !descending ? "table-list__sort-icon--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M6 2.5 9 6H3L6 2.5Z" fill="currentColor" stroke="none" />
      </svg>
      <svg
        className={[
          "table-list__sort-icon",
          active && descending ? "table-list__sort-icon--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M6 9.5 3 6h6L6 9.5Z" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

export function TableList<T>({
  list = [],
  settings,
  isLoading = false,
  getRowKey,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  onBackgroundClick,
  getRowClassName,
  getRowStyle,
  headerShow = true,
  emptyMessage = "데이터가 없습니다.",
  loadingMessage = "불러오는 중…",
  sortOrder = "",
  onChangeSort,
  meta,
  onChangePage,
  hidePagination = false,
  fillHeight = true,
  className,
  ariaLabel = "목록",
  maxHeight,
}: TableListProps<T>) {
  const [hideHeaders, setHideHeaders] = useState(
    () =>
      settings
        .filter((col) => col.hidable && col.defaultHide && typeof col.name === "string")
        .map((col) => col.name as string),
  );

  const visibleSettings = useMemo(
    () =>
      settings.filter((col) => {
        if (
          col.hidable &&
          typeof col.name === "string" &&
          hideHeaders.includes(col.name)
        ) {
          return false;
        }
        return true;
      }),
    [settings, hideHeaders],
  );

  const colCount = visibleSettings.length;

  const indexNumber = useCallback(
    (index: number) => {
      if (!meta) return index + 1;
      return (meta.currentPage - 1) * meta.currentTake + index + 1;
    },
    [meta],
  );

  const hidableNames = useMemo(
    () =>
      settings
        .filter((col) => col.hidable && typeof col.name === "string")
        .map((col) => col.name as string),
    [settings],
  );

  function toggleHeader(name: string) {
    setHideHeaders((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
    );
  }

  const rootClass = [
    "table-list",
    fillHeight ? "table-list--fill" : "",
    isLoading ? "table-list--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const containerStyle: CSSProperties | undefined = maxHeight
    ? { maxHeight }
    : undefined;

  return (
    <div className={rootClass}>
      {hidableNames.length > 0 ? (
        <div className="table-list__toolbar">
          <details className="table-list__cols">
            <summary className="table-list__cols-summary">
              열
              {hideHeaders.length > 0 ? (
                <span className="table-list__cols-badge">{hideHeaders.length}</span>
              ) : null}
            </summary>
            <div className="table-list__cols-panel">
              <p className="table-list__cols-title">열 표시</p>
              {hidableNames.map((name) => (
                <label key={name} className="table-list__cols-item">
                  <input
                    type="checkbox"
                    checked={!hideHeaders.includes(name)}
                    onChange={() => toggleHeader(name)}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      <div
        className="table-list__scroll"
        style={containerStyle}
        onMouseDown={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) {
            return;
          }
          if (target.closest("tr.table-list__row")) {
            return;
          }
          onBackgroundClick?.();
        }}
      >
        {isLoading ? <div className="table-list__progress" aria-hidden /> : null}

        <table className="table-list__table" aria-label={ariaLabel}>
          {headerShow ? (
            <thead>
              <tr>
                {visibleSettings.map((header, index) => {
                  const align = header.colProp?.align ?? "left";
                  const sortable = Boolean(header.sortKey && onChangeSort);
                  const isActive =
                    sortable &&
                    Boolean(header.sortKey) &&
                    sortOrder.startsWith(`${header.sortKey}:`);
                  const isDesc =
                    isActive &&
                    sortOrder.split(":")[1] === SORT_DIRECTION.DESC;

                  return (
                    <th
                      key={`${String(header.name)}-${index}`}
                      className={[
                        "table-list__th",
                        `table-list__cell--${align}`,
                        sortable ? "table-list__th--sortable" : "",
                        isActive ? "table-list__th--sorted" : "",
                        header.className,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        header.width != null
                          ? {
                              width: header.width,
                              minWidth: header.width,
                              maxWidth: header.width,
                            }
                          : undefined
                      }
                      onClick={() => {
                        if (!header.sortKey || !onChangeSort) return;
                        onChangeSort(
                          header.sortKey,
                          isDesc ? SORT_DIRECTION.ASC : SORT_DIRECTION.DESC,
                        );
                      }}
                    >
                      <span className="table-list__th-inner">
                        {header.name}
                        {sortable ? (
                          <SortIcons active={Boolean(isActive)} descending={Boolean(isDesc)} />
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
          ) : null}

          <tbody>
            {isLoading && list.length === 0 ? (
              <tr>
                <td className="table-list__empty" colSpan={Math.max(colCount, 1)}>
                  <LoadingIndicator
                    message={
                      typeof loadingMessage === "string"
                        ? loadingMessage
                        : undefined
                    }
                    label={
                      typeof loadingMessage === "string"
                        ? loadingMessage
                        : "불러오는 중"
                    }
                  />
                </td>
              </tr>
            ) : null}

            {!isLoading && list.length === 0 ? (
              <tr>
                <td className="table-list__empty" colSpan={Math.max(colCount, 1)}>
                  {emptyMessage}
                </td>
              </tr>
            ) : null}

            {list.map((row, index) => {
              const key = getRowKey?.(row, index) ?? index;
              const rowClass = [
                "table-list__row",
                onRowClick || onRowDoubleClick ? "table-list__row--interactive" : "",
                getRowClassName?.(row, index),
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <Fragment key={key}>
                  <tr
                    className={rowClass}
                    style={getRowStyle?.(row, index, index === list.length - 1)}
                    onClick={
                      onRowClick ? () => onRowClick(row, index) : undefined
                    }
                    onDoubleClick={
                      onRowDoubleClick
                        ? () => onRowDoubleClick(row, index)
                        : undefined
                    }
                    onContextMenu={
                      onRowContextMenu
                        ? (event) => onRowContextMenu(row, index, event)
                        : undefined
                    }
                  >
                    {visibleSettings.map((col, colIndex) => {
                      const align = col.colProp?.align ?? "left";
                      const content = col.render
                        ? col.render(row, index)
                        : col.isIndex
                          ? indexNumber(index).toLocaleString()
                          : col.colKey
                            ? ((row[col.colKey] as ReactNode) ?? "—")
                            : "—";

                      return (
                        <td
                          key={`${key}-${colIndex}`}
                          className={[
                            "table-list__td",
                            `table-list__cell--${align}`,
                            col.className,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={
                            col.width != null
                              ? {
                                  width: col.width,
                                  minWidth: col.width,
                                  maxWidth: col.width,
                                }
                              : undefined
                          }
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {onChangePage && list.length > 0 && !hidePagination ? (
        <div className="table-list__pagination">
          <button
            type="button"
            className="table-list__page-btn"
            disabled={!meta || meta.currentPage <= 1}
            onClick={() => onChangePage((meta?.currentPage ?? 2) - 1)}
          >
            이전
          </button>
          <span className="table-list__page-label">
            {meta?.currentPage ?? 1} / {meta?.totalPage ?? 1}
          </span>
          <button
            type="button"
            className="table-list__page-btn"
            disabled={!meta || meta.currentPage >= meta.totalPage}
            onClick={() => onChangePage((meta?.currentPage ?? 0) + 1)}
          >
            다음
          </button>
        </div>
      ) : null}
    </div>
  );
}
