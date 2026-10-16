use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::Path;

use crate::services::github::{GitHubCommitDetail, WeeklyCommit};

use super::{resolve_binary, run_cli_round, ActiveRequest, AiProvider, AiStreamEvent};

const MAX_PROMPT_COMMITS: usize = 300;
const MAX_BODY_CHARS: usize = 600;
const MAX_FILES_PER_COMMIT: usize = 12;
const MAX_PATCH_CHARS_PER_FILE: usize = 2_000;
/// 프롬프트 전체에 넣을 diff 분량 상한. 넘으면 이후 커밋은 변경 파일 목록만 넣는다.
const MAX_DIFF_CHARS_TOTAL: usize = 150_000;

/// diff를 넣어도 업무 파악에 도움이 안 되는 파일
const NOISE_FILE_SUFFIXES: &[&str] = &[
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.lock",
    "poetry.lock",
    "go.sum",
    ".min.js",
    ".min.css",
    ".map",
    ".snap",
    ".svg",
];

const REPORT_SYSTEM_PROMPT: &str = r#"당신은 개발자의 한 주 업무를 팀 주간 회의에서 보고할 수 있도록 정리하는 기술 리포트 작성자입니다.
입력으로 주어지는 것은 지난 7일간 이 개발자가 작성한 GitHub 커밋 목록과, 각 커밋의 변경 파일·코드 diff입니다.
파일을 읽거나 명령을 실행하지 말고, 주어진 입력만으로 리포트를 작성하세요.

[작성 원칙]
- 커밋 제목만 보고 쓰지 말고, 반드시 diff(실제 코드 변경)를 읽고 무엇이 어떻게 바뀌었는지 파악해서 씁니다.
  커밋 제목이 모호하거나(예: "fix", "수정", "wip") 실제 변경과 다르면 diff 내용을 기준으로 설명합니다.
- 리포트는 반드시 "저장소(레포지토리) 단위"로 정리합니다. 한 항목에 여러 저장소의 작업을 섞지 않습니다.
  같은 기능이 여러 저장소에 걸쳐 있으면 각 저장소에 따로 쓰고 끝에 "(연관: owner/repo)"를 붙입니다.
- [저장소 목록]에 있는 모든 저장소를 빠짐없이, 목록 순서(커밋 수가 많은 순)대로 다룹니다. 커밋 수는 입력 숫자를 그대로 씁니다.
- 저장소 안에서는 커밋 단위가 아니라 "작업 단위"로 묶습니다. 같은 기능의 feat/fix/refactor는 하나로 합칩니다.
- 각 작업은 아래 내용을 담아 상세하게 씁니다.
  - 무엇을 했는지 (사용자·운영 관점의 결과)
  - 어떻게 구현했는지 (추가/변경된 주요 모듈·컴포넌트·함수·API·설정, 로직 변화)
  - 영향 범위와 효과 (어떤 화면·기능·성능·안정성에 영향을 주는지)
- 주요 파일·모듈·함수 이름은 `백틱`으로 감싸 필요한 만큼만 언급합니다. 커밋 해시는 쓰지 않습니다.
- diff에 근거한 사실만 씁니다. 추측이 필요하면 "(추정)"을 붙이고, 없는 성과를 만들지 않습니다.
- diff가 생략된 커밋은 커밋 메시지와 변경 파일 목록으로 판단합니다.
- 한국어로, 아래 마크다운 구조를 그대로 지켜 출력합니다. 서론이나 맺음말 없이 리포트 본문만 출력합니다.

[출력 형식]
## 주간 업무 보고 (기간: {시작일} ~ {종료일})

### 한 줄 요약
- 이번 주 핵심 성과를 저장소 기준으로 1~2문장으로

### 저장소별 요약
| 저장소 | 커밋 수 | 핵심 작업 |
| --- | --- | --- |
| owner/repo | N | 이 저장소에서 가장 중요한 작업 한 줄 |

### 저장소별 상세

#### owner/repo (커밋 N개)
**기능 추가**
- **작업 이름**: 무엇을 했는지 한두 문장
  - 구현: 주요 변경 내용 (모듈·컴포넌트·로직)
  - 영향: 사용자·운영 관점의 효과
**버그 수정**
- **작업 이름**: 어떤 문제였고 원인이 무엇이었는지
  - 수정: 어떻게 고쳤는지
  - 영향: 해결된 증상
**개선 / 리팩터링**
- 같은 형식으로 성능·구조·UI 개선
**기타**
- 문서, 설정, 테스트, 빌드 등
(해당 분류에 작업이 없으면 그 분류는 생략합니다. 저장소마다 이 블록을 반복합니다.)

### 다음 주 계획 (제안)
- **owner/repo**: 코드상 미완료로 보이는 작업(TODO, 임시 처리, 반쯤 연결된 기능)이나 후속 작업을 근거와 함께 (추정) 표기

### 이슈 / 공유 사항
- **owner/repo**: 반복 수정, 되돌림(revert), 핫픽스, 위험한 변경(스키마·인증·배포 설정 등) 등 회의에서 공유할 사항. 없으면 "특이 사항 없음"
"#;

pub struct ReportPeriod<'a> {
    pub start: &'a str,
    pub end: &'a str,
}

fn truncate(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let head: String = text.chars().take(max_chars).collect();
    format!("{head}…")
}

fn is_noise_file(filename: &str) -> bool {
    NOISE_FILE_SUFFIXES
        .iter()
        .any(|suffix| filename.ends_with(suffix))
        || filename.starts_with("dist/")
        || filename.contains("/dist/")
}

/// 변경 파일 목록과 diff를 붙인다. 붙인 diff 글자 수를 돌려준다.
fn push_commit_detail(prompt: &mut String, detail: &GitHubCommitDetail, diff_budget: usize) -> usize {
    prompt.push_str(&format!(
        "변경 파일 {}개 (+{} -{})\n",
        detail.files.len(),
        detail.additions,
        detail.deletions
    ));
    let mut used = 0;
    for (index, file) in detail.files.iter().enumerate() {
        prompt.push_str(&format!(
            "- [{}] {} (+{} -{})\n",
            file.status, file.filename, file.additions, file.deletions
        ));
        if index >= MAX_FILES_PER_COMMIT || is_noise_file(&file.filename) {
            continue;
        }
        let Some(patch) = file.patch.as_deref() else {
            continue;
        };
        if used >= diff_budget {
            continue;
        }
        let patch = truncate(patch, MAX_PATCH_CHARS_PER_FILE.min(diff_budget - used));
        used += patch.chars().count();
        prompt.push_str("```diff\n");
        prompt.push_str(&patch);
        prompt.push_str("\n```\n");
    }
    used
}

fn build_prompt(
    period: &ReportPeriod,
    commits: &[WeeklyCommit],
    details: &HashMap<String, GitHubCommitDetail>,
) -> String {
    let mut totals: BTreeMap<&str, usize> = BTreeMap::new();
    for commit in commits {
        *totals.entry(commit.repo.as_str()).or_default() += 1;
    }
    let mut included: BTreeMap<&str, Vec<&WeeklyCommit>> = BTreeMap::new();
    for commit in commits.iter().take(MAX_PROMPT_COMMITS) {
        included.entry(commit.repo.as_str()).or_default().push(commit);
    }
    // 커밋 수가 많은 저장소부터, 같으면 이름순
    let mut repos: Vec<(&str, usize)> = totals.into_iter().collect();
    repos.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));

    let mut prompt = String::from(REPORT_SYSTEM_PROMPT);
    prompt.push_str(&format!(
        "\n[기간]\n{} ~ {}\n\n[요약]\n총 커밋 {}개, 저장소 {}개\n",
        period.start,
        period.end,
        commits.len(),
        repos.len()
    ));

    prompt.push_str("\n[저장소 목록] 리포트에 이 순서대로 모두 포함하세요.\n");
    for (index, (repo, total)) in repos.iter().enumerate() {
        prompt.push_str(&format!("{}. {repo} — 커밋 {total}개\n", index + 1));
    }
    if commits.len() > MAX_PROMPT_COMMITS {
        prompt.push_str(&format!(
            "(커밋이 많아 아래 목록에는 최신 {MAX_PROMPT_COMMITS}개만 포함했습니다. 커밋 수는 위 목록의 숫자를 쓰세요.)\n"
        ));
    }

    prompt.push_str(
        "\n[저장소별 커밋 상세] 각 커밋: 날짜 | sha | 제목, 본문, 변경 파일 목록과 diff \
(diff는 분량 제한으로 일부 잘리거나 생략될 수 있음)\n",
    );
    let mut diff_budget = MAX_DIFF_CHARS_TOTAL;
    for (repo, total) in &repos {
        let Some(repo_commits) = included.get(repo) else {
            prompt.push_str(&format!("\n### {repo} (커밋 {total}개, 목록 생략됨)\n"));
            continue;
        };
        prompt.push_str(&format!("\n### {repo} (커밋 {total}개)\n"));
        for commit in repo_commits {
            let (title, body) = commit
                .message
                .split_once('\n')
                .map(|(title, body)| (title.trim(), body.trim()))
                .unwrap_or((commit.message.trim(), ""));
            let date = commit.date.get(..10).unwrap_or(&commit.date);
            let sha = commit.sha.get(..7).unwrap_or(&commit.sha);
            prompt.push_str(&format!("\n#### {date} | {sha} | {title}\n"));
            if !body.is_empty() {
                prompt.push_str(&format!("본문: {}\n", truncate(body, MAX_BODY_CHARS)));
            }
            match details.get(&commit.sha) {
                Some(detail) => {
                    let used = push_commit_detail(&mut prompt, detail, diff_budget);
                    diff_budget = diff_budget.saturating_sub(used);
                }
                None => prompt.push_str("(변경 내용을 가져오지 못함)\n"),
            }
        }
    }
    prompt.push_str(
        "\n위 커밋과 코드 변경 내용으로 [출력 형식]에 맞춘 주간 업무 보고를 작성하세요. \
[저장소 목록]의 모든 저장소가 \"저장소별 요약\" 표와 \"저장소별 상세\"에 각각 한 번씩 나와야 합니다.\n",
    );
    prompt
}

pub fn generate(
    provider: AiProvider,
    custom_path: Option<&str>,
    workdir: &Path,
    period: &ReportPeriod,
    commits: &[WeeklyCommit],
    details: &HashMap<String, GitHubCommitDetail>,
    emit: &dyn Fn(AiStreamEvent),
) -> Result<String, String> {
    let request = ActiveRequest::register();
    let binary = resolve_binary(provider, custom_path)?;
    fs::create_dir_all(workdir)
        .map_err(|error| format!("AI 작업 폴더를 만들지 못했습니다: {error}"))?;
    let prompt = build_prompt(period, commits, details);
    run_cli_round(provider, &binary, workdir, &prompt, &request, false, emit)
}
