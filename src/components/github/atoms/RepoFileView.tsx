import { CodeBlock } from "@/components/common/CodeBlock";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { useGitHubFileQuery } from "@/hooks/query";
import { githubErrorMessage } from "@/lib/github";
import { formatFileSize } from "@/utils/file";

interface RepoFileViewProps {
  repo: string;
  path: string;
  gitRef: string;
}

export function RepoFileView({ repo, path, gitRef }: RepoFileViewProps) {
  const fileQuery = useGitHubFileQuery(repo, path, gitRef);
  const file = fileQuery.data;

  if (fileQuery.isLoading) {
    return <LoadingIndicator message="파일을 불러오는 중" />;
  }
  if (fileQuery.error) {
    return (
      <p className="explorer-error" role="alert">
        {githubErrorMessage(fileQuery.error, "파일을 불러오지 못했습니다.")}
      </p>
    );
  }
  if (!file) {
    return null;
  }

  const lineCount = file.content ? file.content.split("\n").length : 0;

  return (
    <div className="github-file">
      <header className="github-file__header">
        <span className="github-file__name">{file.name}</span>
        <span className="github-file__meta">
          {lineCount > 0 ? `${lineCount.toLocaleString("ko-KR")}줄 · ` : ""}
          {formatFileSize(file.size)}
        </span>
      </header>
      {file.tooLarge ? (
        <p className="github-file__notice">
          1MB를 넘는 파일은 GitHub API로 내용을 볼 수 없습니다.
        </p>
      ) : file.binary ? (
        <p className="github-file__notice">바이너리 파일은 미리 볼 수 없습니다.</p>
      ) : (
        <CodeBlock
          code={file.content ?? ""}
          filename={file.name}
          className="github-file__code"
        />
      )}
    </div>
  );
}
