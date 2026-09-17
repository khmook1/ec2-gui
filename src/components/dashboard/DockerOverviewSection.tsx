import {
  getDockerContainerState,
  isNginxContainer,
  type DockerContainer,
  type DockerContainerCounts,
  type DockerContainerState,
  type DockerOverview,
} from "@/types/docker";
import "./css/dashboard.css";
import "../docker/css/docker-list.css";

export type DockerOverviewCounts = Pick<
  DockerOverview,
  "containers" | "images" | "volumes" | "networks"
>;

interface DockerOverviewSectionProps {
  counts: DockerOverviewCounts | null;
  recentContainers: DockerContainer[];
  loading: boolean;
  error: string | null;
}

const RESOURCE_ITEMS = [
  { key: "images" as const, label: "이미지" },
  { key: "volumes" as const, label: "볼륨" },
  { key: "networks" as const, label: "네트워크" },
];

const STATE_LABEL: Record<DockerContainerState, string> = {
  running: "실행 중",
  paused: "일시정지",
  stopped: "중지",
  unknown: "기타",
};

function formatContainerName(names: string): string {
  const primary = names.split(",")[0]?.trim() ?? names;
  return primary.replace(/^\//, "") || names;
}

export function DockerOverviewSection({
  counts,
  recentContainers,
  loading,
  error,
}: DockerOverviewSectionProps) {
  if (loading) {
    return (
      <div
        className="dashboard-skeleton"
        aria-busy="true"
        aria-label="불러오는 중"
      >
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__row dashboard-skeleton__row--short" />
      </div>
    );
  }

  if (error && !counts) {
    return (
      <p
        className="dashboard-section__status dashboard-section__status--error"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (!counts) {
    return null;
  }

  return (
    <div className="dashboard-docker">
      {error ? (
        <p
          className="dashboard-section__status dashboard-section__status--error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {recentContainers.length === 0 ? (
        <p className="dashboard-section__status" role="status">
          표시할 컨테이너가 없습니다.
        </p>
      ) : (
        <ul className="dashboard-container-list" aria-label="최근 컨테이너">
          {recentContainers.map((container) => {
            const state = getDockerContainerState(container.status);
            const nginx = isNginxContainer(container);
            return (
              <li
                key={container.id}
                className={[
                  "dashboard-container",
                  nginx ? "dashboard-container--nginx" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={`${container.names}\n${container.image}\n${container.status}`}
              >
                <span
                  className={`dashboard-container__icon dashboard-container__icon--${state}`}
                  aria-hidden
                >
                  D
                </span>
                <div className="dashboard-container__main">
                  <div className="dashboard-container__name-row">
                    {nginx ? (
                      <span
                        className="docker-list__nginx-badge"
                        aria-label="nginx"
                      >
                        NGINX
                      </span>
                    ) : null}
                    <span className="dashboard-container__name">
                      {formatContainerName(container.names)}
                    </span>
                  </div>
                  <div className="dashboard-container__image">
                    {container.image}
                  </div>
                </div>
                <div className="dashboard-container__right">
                  <div
                    className={`dashboard-container__status dashboard-container__status--${state}`}
                  >
                    <span className="dashboard-container__dot" aria-hidden />
                    {STATE_LABEL[state]}
                  </div>
                  <div className="dashboard-container__uptime">
                    {container.status}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ul className="dashboard-docker__footer" aria-label="Docker 리소스">
        {RESOURCE_ITEMS.map((item) => (
          <li key={item.key} className="dashboard-mini-stat">
            <span>{item.label}</span>
            <strong>{counts[item.key]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { DockerContainerCounts };
