import { useEffect, useState, type ComponentType } from "react";
import { AsyncDataLoader } from "@/components/common/AsyncDataLoader";
import { IconButton } from "@/components/common/IconButton";
import { RepoActionsTab } from "@/components/github/RepoActionsTab";
import { RepoBranchesTab } from "@/components/github/RepoBranchesTab";
import { RepoCodeTab } from "@/components/github/RepoCodeTab";
import { RepoIssuesTab } from "@/components/github/RepoIssuesTab";
import { RepoPullsTab } from "@/components/github/RepoPullsTab";
import { RepoSettingsTab } from "@/components/github/RepoSettingsTab";
import {
  ArrowLeftIcon,
  BranchIcon,
  CodeIcon,
  ExternalLinkIcon,
  GearIcon,
  IssueIcon,
  PlayIcon,
  PullRequestIcon,
} from "@/components/icons/GitHubIcons";
import type { ToolbarIconProps } from "@/components/icons/ToolbarIcons";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import { queryKeys, useGitHubRepoQuery } from "@/hooks/query";
import { githubErrorMessage } from "@/lib/github";
import { openExternalUrl } from "@/services/tauri";
import { useGitHubStore } from "@/stores/githubStore";
import { useNavStore } from "@/stores/navStore";
import { useQueryClient } from "@tanstack/react-query";
import type { GitHubRepoDetail } from "@/types/github";
import "@/components/github/css/github.css";
import "@/components/github/css/github-repo.css";

type RepoTabId =
  | "code"
  | "issues"
  | "pulls"
  | "actions"
  | "branches"
  | "settings";

interface RepoTab {
  id: RepoTabId;
  label: string;
  icon: ComponentType<ToolbarIconProps>;
}

const TABS: RepoTab[] = [
  { id: "code", label: "Code", icon: CodeIcon },
  { id: "issues", label: "Issues", icon: IssueIcon },
  { id: "pulls", label: "Pull requests", icon: PullRequestIcon },
  { id: "actions", label: "Actions", icon: PlayIcon },
  { id: "branches", label: "Branches", icon: BranchIcon },
  { id: "settings", label: "Settings", icon: GearIcon },
];

function goToList() {
  useNavStore.getState().goBack();
}

function visibleTabs(detail: GitHubRepoDetail): RepoTab[] {
  return TABS.filter((tab) => {
    if (tab.id === "settings") {
      return detail.permissions.admin;
    }
    if (tab.id === "issues") {
      return detail.hasIssues;
    }
    return true;
  });
}

export function GitHubRepoPage() {
  const selectedRepo = useGitHubStore((state) => state.selectedRepo);

  useEffect(() => {
    if (selectedRepo == null) {
      goToList();
    }
  }, [selectedRepo]);

  if (selectedRepo == null) {
    return null;
  }
  return <RepoDetail key={selectedRepo} repo={selectedRepo} />;
}

function RepoDetail({ repo }: { repo: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<RepoTabId>("code");
  const repoQuery = useGitHubRepoQuery(repo);
  const detail = repoQuery.data ?? null;
  const tabs = detail ? visibleTabs(detail) : TABS.slice(0, 1);
  const currentTab = tabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "code";
  const [owner, name] = repo.split("/");

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.githubRepoScope(repo),
    });
  }

  return (
    <section className="github-repo">
      <header className="github-repo__header">
        <IconButton tooltip="목록으로" aria-label="목록으로" onClick={goToList}>
          <ArrowLeftIcon />
        </IconButton>
        {detail ? (
          <img
            className="github-repo__owner-avatar"
            src={detail.ownerAvatarUrl}
            alt=""
            width={28}
            height={28}
          />
        ) : null}
        <h1 className="github-repo__title">
          <span className="github-repo__owner">{owner}</span>
          <span className="github-repo__slash">/</span>
          <strong>{name}</strong>
        </h1>
        {detail ? (
          <span className="github-repo__badges">
            <span
              className={[
                "github-repo__badge",
                detail.private ? "github-repo__badge--private" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {detail.visibility === "internal"
                ? "Internal"
                : detail.private
                  ? "Private"
                  : "Public"}
            </span>
            {detail.fork ? <span className="github-repo__badge">Fork</span> : null}
            {detail.archived ? (
              <span className="github-repo__badge github-repo__badge--archived">
                Archived
              </span>
            ) : null}
          </span>
        ) : null}
        <div className="github-repo__header-actions">
          <IconButton
            tone="success"
            tooltip="새로고침"
            aria-label="새로고침"
            disabled={repoQuery.isFetching}
            onClick={refresh}
          >
            <RefreshIcon />
          </IconButton>
          {detail ? (
            <IconButton
              tooltip="GitHub에서 열기"
              aria-label="GitHub에서 열기"
              tooltipPosition="bottom"
              onClick={() => void openExternalUrl(detail.htmlUrl)}
            >
              <ExternalLinkIcon />
            </IconButton>
          ) : null}
        </div>
      </header>

      <nav className="github-tabs" role="tablist" aria-label="저장소 메뉴">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={currentTab === tab.id}
              className={[
                "github-tabs__item",
                currentTab === tab.id ? "github-tabs__item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="github-repo__content">
        <AsyncDataLoader
          isLoading={repoQuery.isLoading}
          hasData={detail != null}
          message="저장소 정보를 가져옵니다"
        >
          {repoQuery.error && !detail ? (
            <p className="explorer-error" role="alert">
              {githubErrorMessage(repoQuery.error, "저장소 정보를 불러오지 못했습니다.")}
            </p>
          ) : null}
          {detail ? <RepoTabContent tab={currentTab} detail={detail} /> : null}
        </AsyncDataLoader>
      </div>
    </section>
  );
}

function RepoTabContent({
  tab,
  detail,
}: {
  tab: RepoTabId;
  detail: GitHubRepoDetail;
}) {
  switch (tab) {
    case "issues":
      return <RepoIssuesTab detail={detail} />;
    case "pulls":
      return <RepoPullsTab detail={detail} />;
    case "actions":
      return <RepoActionsTab detail={detail} />;
    case "branches":
      return <RepoBranchesTab detail={detail} />;
    case "settings":
      return <RepoSettingsTab detail={detail} />;
    default:
      return <RepoCodeTab detail={detail} />;
  }
}
