import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/common/Button";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { useDockerContainerLogsQuery } from "@/hooks/query";
import "../css/docker-details.css";

interface DockerLogEntry {
  timestamp: string | null;
  message: string;
}

const LOG_TIMESTAMP_RE =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.*)$/;

const LOG_TAIL_PRESETS = [50, 100, 200, 500] as const;

interface LogFilterFormValues {
  tail: number;
  /** `datetime-local` 값 (예: 2026-09-15T14:30). 비우면 전체. */
  sinceLocal: string;
}

interface LogQuery {
  tail: number;
  /** docker `--since` 값 (RFC3339 또는 빈 문자열) */
  since: string;
}

function localDatetimeToDockerSince(sinceLocal: string): string | null {
  const trimmed = sinceLocal.trim();
  if (!trimmed) {
    return "";
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // 로컬 입력 → UTC RFC3339 (docker logs --since)
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseDockerLogs(raw: string): DockerLogEntry[] | null {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  return lines.map((line) => {
    const match = LOG_TIMESTAMP_RE.exec(line);
    if (match) {
      return {
        timestamp: match[1] ?? null,
        message: (match[2] ?? "").trimEnd() || "(빈 로그)",
      };
    }

    return {
      timestamp: null,
      message: line,
    };
  });
}

interface LogsPanelProps {
  containerId: string;
}

export function LogsPanel({ containerId }: LogsPanelProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [query, setQuery] = useState<LogQuery>({
    tail: 200,
    since: "",
  });

  const { register, handleSubmit, setValue, watch, reset } =
    useForm<LogFilterFormValues>({
      defaultValues: { tail: 200, sinceLocal: "" },
    });

  const tailValue = watch("tail");
  const sinceLocalValue = watch("sinceLocal");

  const logsQuery = useDockerContainerLogsQuery(containerId, {
    tail: query.tail,
    since: query.since,
  });

  const raw = logsQuery.data ?? null;
  const isLoading = logsQuery.isPending || logsQuery.isFetching;
  const errorMessage =
    localError ??
    (logsQuery.isError
      ? logsQuery.error instanceof Error
        ? logsQuery.error.message
        : "로그를 불러오지 못했습니다."
      : null);

  useEffect(() => {
    reset({ tail: 200, sinceLocal: "" });
    setQuery({ tail: 200, since: "" });
    setLocalError(null);
  }, [containerId, reset]);

  useLayoutEffect(() => {
    if (isLoading || errorMessage || raw == null) {
      return;
    }

    const scroller = scrollRef.current;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }

    endRef.current?.scrollIntoView({ block: "end" });
  }, [isLoading, errorMessage, raw, query]);

  function applyQuery(tail: number, sinceLocal: string) {
    if (!Number.isFinite(tail) || tail < 1 || tail > 5000) {
      setLocalError("로그 개수는 1~5000 사이여야 합니다.");
      return;
    }

    const since = localDatetimeToDockerSince(sinceLocal);
    if (since == null) {
      setLocalError("시작 시각 형식이 올바르지 않습니다.");
      return;
    }

    setLocalError(null);
    setQuery({
      tail: Math.floor(tail),
      since,
    });
  }

  function onSubmit(values: LogFilterFormValues) {
    applyQuery(Number(values.tail), values.sinceLocal);
  }

  const entries = raw != null ? parseDockerLogs(raw) : null;
  const resolvedTail = Number.isFinite(Number(tailValue))
    ? Math.floor(Number(tailValue))
    : query.tail;

  return (
    <div className="docker-details__logs">
      <form
        className="docker-details__logs-toolbar"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="docker-details__logs-filter">
          <span className="docker-details__logs-filter-label">개수</span>
          <div
            className="docker-details__logs-presets"
            role="group"
            aria-label="로그 개수"
          >
            {LOG_TAIL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={[
                  "docker-details__logs-preset",
                  Number(tailValue) === preset
                    ? "docker-details__logs-preset--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setValue("tail", preset, { shouldDirty: true });
                  applyQuery(preset, sinceLocalValue);
                }}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            className="docker-details__logs-input docker-details__logs-input--tail"
            type="number"
            min={1}
            max={5000}
            step={1}
            aria-label="로그 개수 직접 입력"
            {...register("tail", { valueAsNumber: true })}
          />
        </div>

        <div className="docker-details__logs-filter">
          <span className="docker-details__logs-filter-label">시간</span>
          <button
            type="button"
            className={[
              "docker-details__logs-preset",
              sinceLocalValue.trim() === ""
                ? "docker-details__logs-preset--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              setValue("sinceLocal", "", { shouldDirty: true });
              applyQuery(resolvedTail, "");
            }}
          >
            전체
          </button>
          <input
            className="docker-details__logs-input docker-details__logs-input--datetime"
            type="datetime-local"
            step={60}
            aria-label="이 시각 이후 로그"
            {...register("sinceLocal")}
          />
        </div>

        <Button type="submit" variant="ghost" disabled={isLoading}>
          조회
        </Button>
      </form>

      <div className="docker-details__logs-scroll" ref={scrollRef}>
        {isLoading ? (
          <LoadingIndicator layout="dialog" message="로그를 불러오는 중" />
        ) : null}

        {!isLoading && errorMessage ? (
          <p className="file-dialog__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && !errorMessage && !entries ? (
          <p className="docker-details__process-empty" role="status">
            {raw?.trim() || "표시할 로그가 없습니다."}
          </p>
        ) : null}

        {!isLoading && !errorMessage && entries ? (
          <div className="docker-details__process-list" role="list">
            {entries.map((entry, index) => (
              <article
                key={`${entry.timestamp ?? "log"}-${index}`}
                className="docker-details__process-card"
                role="listitem"
              >
                <div className="docker-details__process-card-header">
                  <span className="docker-details__process-pid">
                    {entry.timestamp ?? `로그 #${index + 1}`}
                  </span>
                  <span className="docker-details__process-index">
                    #{index + 1}
                  </span>
                </div>
                <p
                  className="docker-details__process-cmd"
                  title={entry.message}
                >
                  {entry.message}
                </p>
              </article>
            ))}
            <div ref={endRef} aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
