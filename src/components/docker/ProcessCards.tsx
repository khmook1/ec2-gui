import "./css/docker-details.css";
interface DockerProcess {
  pid: string;
  cmd: string;
  meta: Array<{ label: string; value: string }>;
}

function splitTopRow(
  line: string,
  columnCount: number,
  cmdIndex: number,
): string[] {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0) {
    return [];
  }

  const joinFrom =
    cmdIndex >= 0 && cmdIndex < columnCount ? cmdIndex : columnCount - 1;

  if (tokens.length <= columnCount || joinFrom < 0) {
    return tokens;
  }

  const head = tokens.slice(0, joinFrom);
  const cmd = tokens.slice(joinFrom).join(" ");
  return [...head, cmd];
}

function parseDockerTop(raw: string): DockerProcess[] | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return null;
  }

  const headerLine = lines[0];
  if (headerLine == null) {
    return null;
  }

  const headers = headerLine.trim().split(/\s+/);
  if (headers.length < 2) {
    return null;
  }

  const pidIndex = headers.findIndex((header) => /^pid$/i.test(header));
  const cmdIndex = headers.findIndex((header) =>
    /^(cmd|command)$/i.test(header),
  );

  const processes: DockerProcess[] = [];

  for (const line of lines.slice(1)) {
    const parts = splitTopRow(line, headers.length, cmdIndex);
    if (parts.length === 0) {
      continue;
    }

    const pid =
      pidIndex >= 0 ? (parts[pidIndex] ?? "").trim() : (parts[0] ?? "").trim();
    const cmd =
      cmdIndex >= 0
        ? (parts[cmdIndex] ?? "").trim()
        : (parts[parts.length - 1] ?? "").trim();

    const meta = headers
      .map((label, index) => ({
        label,
        value: (parts[index] ?? "").trim(),
      }))
      .filter(
        (entry, index) =>
          entry.value.length > 0 &&
          index !== pidIndex &&
          index !== cmdIndex &&
          !(pidIndex < 0 && index === 0) &&
          !(cmdIndex < 0 && index === parts.length - 1),
      );

    processes.push({
      pid: pid || "—",
      cmd: cmd || "(명령 없음)",
      meta,
    });
  }

  return processes.length > 0 ? processes : null;
}

interface DockerProcessCardsProps {
  raw: string;
}

export function DockerProcessCards({ raw }: DockerProcessCardsProps) {
  const processes = parseDockerTop(raw);

  if (!processes) {
    return (
      <p className="docker-details__process-empty" role="status">
        {raw.trim() ||
          "프로세스 정보를 가져올 수 없습니다. (중지된 컨테이너일 수 있습니다)"}
      </p>
    );
  }

  return (
    <div className="docker-details__process-list" role="list">
      {processes.map((process, index) => (
        <article
          key={`${process.pid}-${index}`}
          className="docker-details__process-card"
          role="listitem"
        >
          <div className="docker-details__process-card-header">
            <span className="docker-details__process-pid">
              PID {process.pid}
            </span>
            <span className="docker-details__process-index">#{index + 1}</span>
          </div>
          <p className="docker-details__process-cmd" title={process.cmd}>
            {process.cmd}
          </p>
          {process.meta.length > 0 ? (
            <dl className="docker-details__process-meta">
              {process.meta.map((entry) => (
                <div
                  key={`${process.pid}-${entry.label}`}
                  className="docker-details__process-meta-item"
                >
                  <dt>{entry.label}</dt>
                  <dd>{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </article>
      ))}
    </div>
  );
}
