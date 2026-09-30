import "./css/favorite-star-button.css";

interface FavoriteStarButtonProps {
  active: boolean;
  name: string;
  className?: string;
  onToggle: () => void;
}

export function FavoriteStarButton({
  active,
  name,
  className,
  onToggle,
}: FavoriteStarButtonProps) {
  const label = active ? `${name} 즐겨찾기 해제` : `${name} 즐겨찾기 추가`;

  return (
    <button
      type="button"
      className={[
        "favorite-star-button",
        active ? "favorite-star-button--active" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      aria-pressed={active}
      title={active ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <path d="M12 3.3l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 17.08l-5.4 2.84 1.03-6.01-4.37-4.26 6.04-.88L12 3.3z" />
      </svg>
    </button>
  );
}
