import { CodeBlock } from "@/components/common/CodeBlock";
import type { DockerContainerDetails } from "@/types/docker";
import "../css/docker-details.css";

function DetailRow({ label, value }: { label: string; value: string }) {
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

interface DetailsSummaryProps {
  details: DockerContainerDetails;
}

export function DetailsSummary({ details }: DetailsSummaryProps) {
  return (
    <dl className="docker-details__summary">
      <DetailRow label="이름" value={details.name} />
      <DetailRow label="이미지" value={details.image} />
      <DetailRow label="상태" value={details.status} />
      <DetailRow label="생성" value={details.created} />
      <DetailRow label="플랫폼" value={details.platform} />
      <DetailRow label="재시작 정책" value={details.restartPolicy} />
      <DetailRow label="IP" value={details.ipAddress} />
      <DetailRow label="MAC" value={details.macAddress} />
      <DetailRow label="네트워크" value={details.networks} />
      <DetailRow label="포트" value={details.ports} />
      <DetailRow label="마운트" value={details.mounts} />
      <DetailRow label="WorkingDir" value={details.workingDir} />
      <DetailRow label="Entrypoint" value={details.entrypoint} />
      <DetailRow label="Cmd" value={details.cmd} />
      {details.env.trim() ? (
        <div className="docker-details__row docker-details__row--code">
          <dt>Env</dt>
          <dd>
            <CodeBlock code={details.env} filename="container.env" />
          </dd>
        </div>
      ) : null}
      <DetailRow label="Labels" value={details.labels} />
    </dl>
  );
}
