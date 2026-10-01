import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { useGitHubJobLogsQuery } from "@/hooks/query";
import { githubErrorMessage } from "@/lib/github";

export function JobLogPanel({ repo, jobId }: { repo: string; jobId: number }) {
  const logsQuery = useGitHubJobLogsQuery(repo, jobId);

  if (logsQuery.isLoading) {
    return <LoadingIndicator message="로그를 불러오는 중" />;
  }
  if (logsQuery.error) {
    return (
      <p className="explorer-error" role="alert">
        {githubErrorMessage(logsQuery.error, "로그를 불러오지 못했습니다.")}
      </p>
    );
  }
  const text = logsQuery.data ?? "";
  return (
    <pre className="github-job-log">{text.trim() ? text : "로그가 비어 있습니다."}</pre>
  );
}
