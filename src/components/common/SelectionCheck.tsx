import "./css/selection-check.css";

interface SelectionCheckProps {
  checked: boolean;
  className?: string;
}

/** 선택 카드 오른쪽 위의 원형 체크. 부모는 `position: relative`여야 하고, 색은 `--selection-check-color`로 바꾼다. */
export function SelectionCheck({ checked, className }: SelectionCheckProps) {
  const classes = [
    "selection-check",
    checked ? "selection-check--checked" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} aria-hidden />;
}
