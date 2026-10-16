import { useMemo, useState } from "react";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { ChevronRightIcon } from "@/components/icons/GitHubIcons";
import { useGitHubCommitQuery } from "@/hooks/query";
import { githubErrorMessage } from "@/lib/github";
import type { GitHubCommitFile, GitHubCommitFileStatus } from "@/types/github";

/** 처음부터 펼쳐 둘 파일 수 (큰 커밋에서 diff 렌더링 부담을 줄인다) */
const OPEN_BY_DEFAULT = 5;

const STATUS_LABEL: Record<GitHubCommitFileStatus, string> = {
  added: "추가",
  removed: "삭제",
  modified: "수정",
  renamed: "이름 변경",
  copied: "복사",
  changed: "변경",
  unchanged: "변경 없음",
};

type DiffLineKind = "add" | "del" | "context" | "hunk";

interface DiffLine {
  kind: DiffLineKind;
  oldNumber: number | null;
  newNumber: number | null;
  marker: string;
  text: string;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** unified diff patch를 줄 번호가 붙은 행으로 변환한다. */
function parsePatch(patch: string): DiffLine[] {
  let oldLine = 0;
  let newLine = 0;
  const rows: DiffLine[] = [];
  for (const line of patch.split("\n")) {
    const hunk = HUNK_HEADER.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      rows.push({
        kind: "hunk",
        oldNumber: null,
        newNumber: null,
        marker: "",
        text: line,
      });
    } else if (line.startsWith("+")) {
      rows.push({
        kind: "add",
        oldNumber: null,
        newNumber: newLine++,
        marker: "+",
        text: line.slice(1),
      });
    } else if (line.startsWith("-")) {
      rows.push({
        kind: "del",
        oldNumber: oldLine++,
        newNumber: null,
        marker: "-",
        text: line.slice(1),
      });
    } else if (line.startsWith("\\")) {
      rows.push({
        kind: "context",
        oldNumber: null,
        newNumber: null,
        marker: "",
        text: line,
      });
    } else {
      rows.push({
        kind: "context",
        oldNumber: oldLine++,
        newNumber: newLine++,
        marker: " ",
        text: line.slice(1),
      });
    }
  }
  return rows;
}

function DiffBlock({ patch }: { patch: string }) {
  const rows = useMemo(() => parsePatch(patch), [patch]);

  return (
    <div className="gh-diff">
      <table className="gh-diff__table">
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className={`gh-diff__row gh-diff__row--${row.kind}`}
            >
              {row.kind === "hunk" ? (
                <>
                  <td className="gh-diff__num" colSpan={2} />
                  <td className="gh-diff__text">{row.text}</td>
                </>
              ) : (
                <>
                  <td className="gh-diff__num">{row.oldNumber ?? ""}</td>
                  <td className="gh-diff__num">{row.newNumber ?? ""}</td>
                  <td className="gh-diff__text">
                    <span className="gh-diff__marker">{row.marker}</span>
                    {row.text}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileDiff({
  file,
  defaultOpen,
}: {
  file: GitHubCommitFile;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <li className="gh-file">
      <button
        type="button"
        className="gh-file__header"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRightIcon
          className={["gh-file__chevron", open ? "gh-file__chevron--open" : ""]
            .filter(Boolean)
            .join(" ")}
        />
        <span className={`gh-file__status gh-file__status--${file.status}`}>
          {STATUS_LABEL[file.status] ?? file.status}
        </span>
        <span className="gh-file__name" title={file.filename}>
          {file.previousFilename ? `${file.previousFilename} → ` : ""}
          {file.filename}
        </span>
        <span className="gh-file__stat">
          <span className="gh-stat--add">+{file.additions}</span>
          <span className="gh-stat--del">−{file.deletions}</span>
        </span>
      </button>
      {open ? (
        file.patch ? (
          <DiffBlock patch={file.patch} />
        ) : (
          <p className="gh-file__empty">
            바이너리 파일이거나 변경량이 커서 diff를 표시할 수 없습니다.
          </p>
        )
      ) : null}
    </li>
  );
}

interface CommitDetailProps {
  repo: string;
  sha: string;
  /** 커밋 메시지 본문 (제목 제외) */
  body: string;
}

export function CommitDetail({ repo, sha, body }: CommitDetailProps) {
  const query = useGitHubCommitQuery(repo, sha, true);
  const detail = query.data;

  return (
    <div className="gh-commit-detail">
      {body ? <pre className="gh-commit-detail__body">{body}</pre> : null}

      {query.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(query.error, "커밋 상세를 불러오지 못했습니다.")}
        </p>
      ) : !detail ? (
        <LoadingIndicator message="변경 내용을 가져옵니다" />
      ) : (
        <>
          <p className="gh-commit-detail__summary">
            파일 {detail.files.length}개 변경 ·{" "}
            <span className="gh-stat--add">+{detail.additions}</span>{" "}
            <span className="gh-stat--del">−{detail.deletions}</span>
          </p>
          <ul className="gh-files">
            {detail.files.map((file, index) => (
              <FileDiff
                key={file.filename}
                file={file}
                defaultOpen={index < OPEN_BY_DEFAULT}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
