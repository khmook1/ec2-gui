import { useState } from "react";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { BranchIcon, ExternalLinkIcon } from "@/components/icons/GitHubIcons";
import { MarkdownHtml } from "@/components/github/atoms/MarkdownHtml";
import { RepoAbout } from "@/components/github/atoms/RepoAbout";
import { RepoFileList } from "@/components/github/atoms/RepoFileList";
import { RepoFileView } from "@/components/github/atoms/RepoFileView";
import {
  useGitHubBranchesQuery,
  useGitHubContentsQuery,
  useGitHubReadmeQuery,
} from "@/hooks/query";
import { githubErrorMessage } from "@/lib/github";
import { openExternalUrl } from "@/services/tauri";
import type { GitHubContentEntry, GitHubRepoDetail } from "@/types/github";

const BRANCH_SELECT_LIMIT = 100;

function parentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

export function RepoCodeTab({ detail }: { detail: GitHubRepoDetail }) {
  const repo = detail.fullName;
  const [gitRef, setGitRef] = useState(detail.defaultBranch);
  const [dirPath, setDirPath] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);

  const branchesQuery = useGitHubBranchesQuery(repo, 1, BRANCH_SELECT_LIMIT);
  const contentsQuery = useGitHubContentsQuery(
    repo,
    dirPath,
    gitRef,
    filePath == null,
  );
  const readmeQuery = useGitHubReadmeQuery(repo, gitRef);

  const branchNames = branchesQuery.data?.items.map((branch) => branch.name) ?? [];
  if (!branchNames.includes(gitRef)) {
    branchNames.unshift(gitRef);
  }

  const currentPath = filePath ?? dirPath;
  const segments = currentPath ? currentPath.split("/") : [];
  const showReadme = filePath == null && dirPath === "";

  function changeRef(next: string) {
    setGitRef(next);
    setDirPath("");
    setFilePath(null);
  }

  function goTo(path: string) {
    setFilePath(null);
    setDirPath(path);
  }

  function openEntry(entry: GitHubContentEntry) {
    if (entry.kind === "dir") {
      goTo(entry.path);
    } else {
      setFilePath(entry.path);
    }
  }

  function openOnGitHub() {
    const kind = filePath ? "blob" : "tree";
    const suffix = currentPath ? `/${currentPath}` : "";
    void openExternalUrl(
      `${detail.htmlUrl}/${kind}/${encodeURIComponent(gitRef)}${suffix}`,
    );
  }

  return (
    <div className="github-code">
      <div className="github-code__main">
        <div className="github-code__bar">
          <label className="github-branch-select">
            <BranchIcon />
            <select
              value={gitRef}
              aria-label="브랜치"
              onChange={(event) => changeRef(event.target.value)}
            >
              {branchNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <nav className="github-breadcrumb" aria-label="경로">
            <button
              type="button"
              className="github-breadcrumb__item"
              onClick={() => goTo("")}
            >
              {detail.name}
            </button>
            {segments.map((segment, index) => {
              const path = segments.slice(0, index + 1).join("/");
              const isLast = index === segments.length - 1;
              return (
                <span key={path} className="github-breadcrumb__part">
                  <span className="github-breadcrumb__sep">/</span>
                  {isLast ? (
                    <span className="github-breadcrumb__current">{segment}</span>
                  ) : (
                    <button
                      type="button"
                      className="github-breadcrumb__item"
                      onClick={() => goTo(path)}
                    >
                      {segment}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
          <button
            type="button"
            className="github-link github-code__external"
            onClick={openOnGitHub}
          >
            <ExternalLinkIcon />
            GitHub에서 보기
          </button>
        </div>

        {filePath ? (
          <RepoFileView repo={repo} path={filePath} gitRef={gitRef} />
        ) : contentsQuery.isLoading ? (
          <LoadingIndicator message="파일 목록을 불러오는 중" />
        ) : contentsQuery.error ? (
          <p className="explorer-error" role="alert">
            {githubErrorMessage(contentsQuery.error, "파일 목록을 불러오지 못했습니다.")}
          </p>
        ) : (
          <div
            className="github-code__files"
            aria-busy={contentsQuery.isFetching || undefined}
          >
            <RepoFileList
              entries={contentsQuery.data ?? []}
              canGoUp={dirPath !== ""}
              onGoUp={() => goTo(parentPath(dirPath))}
              onOpen={openEntry}
            />
          </div>
        )}

        {showReadme && readmeQuery.data ? (
          <section className="github-readme">
            <header className="github-readme__header">README</header>
            <MarkdownHtml html={readmeQuery.data} className="github-readme__body" />
          </section>
        ) : null}
      </div>

      <RepoAbout detail={detail} />
    </div>
  );
}
