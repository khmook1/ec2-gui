import "../css/docker-details.css";

export interface DetailsSummaryRow {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailsSummaryRow) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div className="docker-details__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

interface DetailsSummaryListProps {
  rows: DetailsSummaryRow[];
}

export function DetailsSummaryList({ rows }: DetailsSummaryListProps) {
  return (
    <dl className="docker-details__summary">
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>
  );
}
