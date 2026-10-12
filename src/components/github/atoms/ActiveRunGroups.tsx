import { RunList } from "@/components/github/atoms/RunList";
import { useGitHubStore } from "@/stores/githubStore";
import type { GitHubActiveRun } from "@/types/github";

interface RepoGroup {
  repo: string;
  owner: string;
  name: string;
  runs: GitHubActiveRun[];
  running: number;
  waiting: number;
}

/** 입력이 최신순이므로 최근 실행이 있는 저장소가 먼저 온다 */
function groupByRepo(runs: GitHubActiveRun[]): RepoGroup[] {
  const groups = new Map<string, RepoGroup>();
  for (const run of runs) {
    let group = groups.get(run.repo);
    if (group == null) {
      const [owner = "", name = run.repo] = run.repo.split("/");
      group = { repo: run.repo, owner, name, runs: [], running: 0, waiting: 0 };
      groups.set(run.repo, group);
    }
    group.runs.push(run);
    if (run.status === "in_progress") {
      group.running += 1;
    } else {
      group.waiting += 1;
    }
  }
  return [...groups.values()];
}

interface ActiveRunGroupsProps {
  runs: GitHubActiveRun[];
  onOpen: (run: GitHubActiveRun) => void;
}

export function ActiveRunGroups({ runs, onOpen }: ActiveRunGroupsProps) {
  const openRepo = useGitHubStore((state) => state.openRepo);

  if (runs.length === 0) {
    return <p className="github-list__empty">진행중인 액션이 없습니다.</p>;
  }

  return (
    <div className="github-active-groups">
      {groupByRepo(runs).map((group) => (
        <section key={group.repo} className="github-active-group">
          <header className="github-active-group__header">
            <button
              type="button"
              className="github-active-group__repo"
              title="저장소 열기"
              onClick={() => openRepo(group.repo)}
            >
              <img
                className="github-active-group__avatar"
                src={`https://github.com/${group.owner}.png?size=48`}
                alt=""
                width={24}
                height={24}
              />
              <span className="github-active-group__owner">{group.owner}</span>
              <span className="github-active-group__slash">/</span>
              <strong className="github-active-group__name">{group.name}</strong>
            </button>
            <span className="github-active-group__counts">
              {group.running > 0 ? (
                <span className="github-active-group__count github-active-group__count--running">
                  실행 중 {group.running}
                </span>
              ) : null}
              {group.waiting > 0 ? (
                <span className="github-active-group__count github-active-group__count--waiting">
                  대기 {group.waiting}
                </span>
              ) : null}
            </span>
          </header>
          <RunList runs={group.runs} emptyText="" onOpen={onOpen} />
        </section>
      ))}
    </div>
  );
}
