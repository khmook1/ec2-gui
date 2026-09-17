import { PageToolbar } from "@/components/common/PageToolbar";
import "./css/docker-placeholder.css";

interface DockerFeaturePlaceholderProps {
  title: string;
  description: string;
  commands?: string[];
}

export function DockerFeaturePlaceholder({
  title,
  description,
  commands = [],
}: DockerFeaturePlaceholderProps) {
  return (
    <section className="explorer docker-page">
      <PageToolbar>
        <p className="page-toolbar__hint">{description}</p>
      </PageToolbar>
      <div className="docker-placeholder">
        <h2 className="docker-placeholder__title">{title}</h2>
        <p className="docker-placeholder__desc">
          원격 Docker 연동 UI는 준비 중입니다. 아래 명령으로 서버에서 확인할 수
          있습니다.
        </p>
        {commands.length > 0 ? (
          <ul className="docker-placeholder__commands">
            {commands.map((command) => (
              <li key={command}>
                <code>{command}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
