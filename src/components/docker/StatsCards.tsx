import "./css/docker-details.css";
interface DockerStatRow {
  name: string;
  metrics: Array<{ label: string; value: string }>;
}

function parseDockerStats(raw: string): DockerStatRow[] | null {
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

  const headers = headerLine.includes("\t")
    ? headerLine.split("\t").map((h) => h.trim())
    : headerLine.trim().split(/\s{2,}/).map((h) => h.trim());

  if (headers.length < 2) {
    return null;
  }

  const nameIndex = headers.findIndex((header) => /^name$/i.test(header));
  const rows: DockerStatRow[] = [];

  for (const line of lines.slice(1)) {
    const parts = line.includes("\t")
      ? line.split("\t").map((p) => p.trim())
      : line.trim().split(/\s{2,}/).map((p) => p.trim());

    if (parts.length === 0) {
      continue;
    }

    const name =
      nameIndex >= 0
        ? (parts[nameIndex] ?? "").trim()
        : (parts[0] ?? "").trim();

    const metrics = headers
      .map((label, index) => ({
        label,
        value: (parts[index] ?? "").trim(),
      }))
      .filter(
        (entry, index) =>
          entry.value.length > 0 &&
          index !== nameIndex &&
          !(nameIndex < 0 && index === 0),
      );

    rows.push({
      name: name || "컨테이너",
      metrics,
    });
  }

  return rows.length > 0 ? rows : null;
}

interface DockerStatsCardsProps {
  raw: string;
}

export function DockerStatsCards({ raw }: DockerStatsCardsProps) {
  const rows = parseDockerStats(raw);

  if (!rows) {
    return (
      <p className="docker-details__process-empty" role="status">
        {raw.trim() ||
          "리소스 정보를 가져올 수 없습니다. (중지된 컨테이너일 수 있습니다)"}
      </p>
    );
  }

  return (
    <div className="docker-details__process-list" role="list">
      {rows.map((row, index) => (
        <article
          key={`${row.name}-${index}`}
          className="docker-details__process-card"
          role="listitem"
        >
          <div className="docker-details__process-card-header">
            <span className="docker-details__process-pid">{row.name}</span>
            <span className="docker-details__process-index">#{index + 1}</span>
          </div>
          {row.metrics.length > 0 ? (
            <dl className="docker-details__process-meta">
              {row.metrics.map((entry) => (
                <div
                  key={`${row.name}-${entry.label}`}
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
