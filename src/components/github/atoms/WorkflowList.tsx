import type { GitHubWorkflow } from "@/types/github";

interface WorkflowListProps {
  workflows: GitHubWorkflow[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export function WorkflowList({ workflows, selectedId, onSelect }: WorkflowListProps) {
  return (
    <nav className="github-workflows" aria-label="워크플로">
      <button
        type="button"
        className={`github-workflows__item${selectedId == null ? " is-active" : ""}`}
        aria-current={selectedId == null ? "true" : undefined}
        onClick={() => onSelect(null)}
      >
        All workflows
      </button>
      {workflows.map((workflow) => (
        <button
          key={workflow.id}
          type="button"
          className={`github-workflows__item${selectedId === workflow.id ? " is-active" : ""}`}
          aria-current={selectedId === workflow.id ? "true" : undefined}
          title={workflow.path}
          onClick={() => onSelect(workflow.id)}
        >
          <span className="github-workflows__name">{workflow.name}</span>
          {workflow.state !== "active" ? (
            <span className="github-workflows__tag">disabled</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
