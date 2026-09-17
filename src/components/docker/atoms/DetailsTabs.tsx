import "../css/docker-details.css";

export interface DetailsTabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

interface DetailsTabsProps {
  items: DetailsTabItem[];
  activeId: string;
  ariaLabel?: string;
  onChange: (id: string) => void;
}

export function DetailsTabs({
  items,
  activeId,
  ariaLabel = "상세 정보",
  onChange,
}: DetailsTabsProps) {
  return (
    <div className="docker-details__tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          disabled={tab.disabled}
          className={[
            "docker-details__tab",
            activeId === tab.id ? "docker-details__tab--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
