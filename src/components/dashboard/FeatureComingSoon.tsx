import "./css/dashboard.css";

interface FeatureComingSoonProps {
  /** 접근성용 구역 라벨 */
  label?: string;
}

export function FeatureComingSoon({
  label = "준비 중 기능",
}: FeatureComingSoonProps) {
  return (
    <div className="dashboard-coming-soon" role="status" aria-label={label}>
      <img
        className="dashboard-coming-soon__icon"
        src="/app-icon.png"
        alt=""
        width={96}
        height={96}
        decoding="async"
      />
      <p className="dashboard-coming-soon__title">기능을 준비 중입니다</p>
      <p className="dashboard-coming-soon__desc">
        이 OS에서는 아직 표시할 항목이 없습니다.
      </p>
    </div>
  );
}
