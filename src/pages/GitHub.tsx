import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { AsyncDataLoader } from "@/components/common/AsyncDataLoader";
import { IconButton } from "@/components/common/IconButton";
import { PageToolbar } from "@/components/common/PageToolbar";
import {
  PageViewModeProvider,
  PageViewSwitch,
} from "@/components/common/PageViewMode";
import { RepoGrid } from "@/components/github/atoms/RepoGrid";
import { RepoList } from "@/components/github/atoms/RepoList";
import { PaginatedContent } from "@/components/common/Pagination";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import { useGitHubReposQuery, useGitHubViewerQuery } from "@/hooks/query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagination } from "@/hooks/usePagination";
import {
  ListSelectionProvider,
  ListSelectionSurface,
} from "@/providers/ListSelectionProvider";
import {
  GITHUB_AFFILIATION_OPTIONS,
  GITHUB_PER_PAGE_OPTIONS,
  GITHUB_VISIBILITY_OPTIONS,
  type GitHubAffiliation,
  type GitHubRepo,
  type GitHubVisibility,
} from "@/types/github";
import "@/components/github/css/github.css";

interface RepoFilterValues {
  keyword: string;
  affiliation: GitHubAffiliation;
  visibility: GitHubVisibility;
  perPage: number;
}

const EMPTY_REPOS: GitHubRepo[] = [];
/** GitHub 검색 API 호출 한도(분당 30회)를 고려한 입력 지연 */
const KEYWORD_DEBOUNCE_MS = 400;

function getErrorMessage(error: unknown): string | null {
  if (error == null) {
    return null;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "GitHub 저장소 목록을 불러오지 못했습니다.";
}

export function GitHubPage() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { register, watch } = useForm<RepoFilterValues>({
    defaultValues: {
      keyword: "",
      affiliation: "owner,collaborator,organization_member",
      visibility: "all",
      perPage: GITHUB_PER_PAGE_OPTIONS[0],
    },
  });
  const affiliation = watch("affiliation");
  const visibility = watch("visibility");
  const perPage = watch("perPage");
  const keyword = useDebouncedValue(watch("keyword").trim(), KEYWORD_DEBOUNCE_MS);
  const isSearching = keyword.length > 0;

  const clearSelection = useCallback(() => setSelectedKey(null), []);
  const { page, setPage } = usePagination({
    resetDeps: [affiliation, visibility, perPage, keyword],
    onPageChange: clearSelection,
  });

  const viewerQuery = useGitHubViewerQuery();
  const reposQuery = useGitHubReposQuery({
    page,
    perPage,
    affiliation,
    visibility,
    keyword,
  });

  const viewer = viewerQuery.data ?? null;
  const repoPage = reposQuery.data ?? null;
  const repos = repoPage?.repos ?? EMPTY_REPOS;
  const totalPages = repoPage?.totalPages ?? 1;
  const hasData = repoPage != null;
  const isFetching = reposQuery.isFetching;
  const errorMessage =
    getErrorMessage(reposQuery.error) ?? getErrorMessage(viewerQuery.error);

  function refresh() {
    void reposQuery.refetch();
    if (viewerQuery.isError) {
      void viewerQuery.refetch();
    }
  }

  return (
    <PageViewModeProvider>
      <ListSelectionProvider
        selectedKey={selectedKey}
        onSelectedKeyChange={setSelectedKey}
      >
        <section className="explorer github-page">
          <PageToolbar
            actions={
              <IconButton
                tone="success"
                tooltip="새로고침"
                aria-label="새로고침"
                disabled={isFetching}
                onClick={refresh}
              >
                <RefreshIcon />
              </IconButton>
            }
            bodyClassName="github-page__toolbar"
          >
            {viewer ? (
              <span className="github-page__viewer" title="로컬 git 인증 계정">
                <img
                  className="github-page__avatar"
                  src={viewer.avatarUrl}
                  alt=""
                  width={24}
                  height={24}
                />
                <span className="github-page__login">{viewer.login}</span>
              </span>
            ) : (
              <p className="page-toolbar__hint">
                로컬 git 인증 정보로 GitHub 저장소를 불러옵니다.
              </p>
            )}
            <input
              type="search"
              className="github-page__search"
              placeholder="GitHub에서 저장소 검색 (이름·설명)"
              aria-label="GitHub 저장소 검색"
              autoComplete="off"
              spellCheck={false}
              {...register("keyword")}
            />
            <div className="github-page__filters">
              <label className="github-page__filter">
                <span>소유 범위</span>
                <select
                  className="github-page__select"
                  {...register("affiliation")}
                >
                  {GITHUB_AFFILIATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="github-page__filter">
                <span>공개 범위</span>
                <select
                  className="github-page__select"
                  {...register("visibility")}
                >
                  {GITHUB_VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="github-page__filter">
                <span>페이지당</span>
                <select
                  className="github-page__select"
                  {...register("perPage", { valueAsNumber: true })}
                >
                  {GITHUB_PER_PAGE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}개
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </PageToolbar>

          <AsyncDataLoader
            isLoading={isFetching && !hasData}
            hasData={hasData}
            message="GitHub 저장소를 가져옵니다"
          >
            {errorMessage ? (
              <p className="explorer-error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <PaginatedContent
              page={page}
              totalPages={totalPages}
              onChangePage={setPage}
              isFetching={isFetching}
              loadingMessage="저장소를 불러오는 중"
              ariaLabel="저장소 페이지"
            >
              <ListSelectionSurface className="explorer__selection-surface">
                <PageViewSwitch
                  tableList={<RepoList repos={repos} />}
                  gui={<RepoGrid repos={repos} />}
                />
              </ListSelectionSurface>
            </PaginatedContent>

            <footer className="explorer-statusbar">
              <span>
                {isSearching && repoPage?.totalCount != null
                  ? `"${keyword}" 검색 결과 ${repoPage.totalCount.toLocaleString("ko-KR")}개 · `
                  : ""}
                {page} / {totalPages} 페이지 · {repos.length}개 저장소
              </span>
              {selectedKey ? (
                <span>{selectedKey}</span>
              ) : isFetching ? (
                <span>갱신 중…</span>
              ) : (
                <span>⌘F 로 현재 페이지 검색</span>
              )}
            </footer>
          </AsyncDataLoader>
        </section>
      </ListSelectionProvider>
    </PageViewModeProvider>
  );
}
