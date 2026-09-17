import "./css/dashboard.css";

const PLACEHOLDER_EVENTS = [
  { id: "1", text: "시스템 이벤트 피드", detail: "준비 중", warn: false },
  { id: "2", text: "컨테이너 변경 이력", detail: "준비 중", warn: false },
  { id: "3", text: "디스크·SSH 알림", detail: "준비 중", warn: true },
] as const;

export function ActivityPlaceholder() {
  return (
    <ul className="dashboard-activity" aria-label="최근 활동">
      {PLACEHOLDER_EVENTS.map((event) => (
        <li
          key={event.id}
          className={`dashboard-activity__event${event.warn ? " dashboard-activity__event--warn" : ""}`}
        >
          <span className="dashboard-activity__dot" aria-hidden />
          <div className="dashboard-activity__text">
            <strong>{event.text}</strong>
            <span> · {event.detail}</span>
          </div>
          <time className="dashboard-activity__time">—</time>
        </li>
      ))}
    </ul>
  );
}
