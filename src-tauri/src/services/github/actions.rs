use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use serde_yaml::Value as Yaml;

use super::client::{
    encode_path, repo_path, user_or_ghost, ApiUser, GitHubClient, GitHubPage, GitHubUser,
    MAX_PER_PAGE,
};

/// 로그는 끝부분만 보여 준다 (실패 원인은 보통 마지막에 있다).
const MAX_LOG_BYTES: usize = 512 * 1024;
const ACCEPT_RAW: &str = "application/vnd.github.raw";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubWorkflow {
    pub id: u64,
    pub name: String,
    pub path: String,
    /// "active" | "disabled_manually" | ...
    pub state: String,
    pub html_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubWorkflowRun {
    pub id: u64,
    pub workflow_id: u64,
    pub name: String,
    pub display_title: String,
    pub run_number: u64,
    pub run_attempt: u64,
    pub event: String,
    /// "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending"
    pub status: String,
    /// completed일 때만: "success" | "failure" | "cancelled" | "skipped" | ...
    pub conclusion: Option<String>,
    pub head_branch: Option<String>,
    pub head_sha: String,
    pub actor: GitHubUser,
    pub created_at: String,
    pub updated_at: String,
    pub run_started_at: Option<String>,
    pub html_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubJobStep {
    pub number: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubJob {
    pub id: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub html_url: Option<String>,
    pub steps: Vec<GitHubJobStep>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubWorkflowInput {
    pub name: String,
    pub description: Option<String>,
    pub required: bool,
    pub default: Option<String>,
    /// "string" | "boolean" | "choice" | "number" | "environment"
    pub kind: String,
    pub options: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubWorkflowDispatch {
    /// `on: workflow_dispatch` 트리거가 있어야 수동 실행할 수 있다
    pub dispatchable: bool,
    pub inputs: Vec<GitHubWorkflowInput>,
}

#[derive(Deserialize)]
struct ApiWorkflow {
    id: u64,
    name: String,
    path: String,
    state: String,
    html_url: String,
}

#[derive(Deserialize)]
struct ApiWorkflows {
    workflows: Vec<ApiWorkflow>,
}

#[derive(Deserialize)]
struct ApiRun {
    id: u64,
    workflow_id: u64,
    name: Option<String>,
    display_title: Option<String>,
    run_number: u64,
    #[serde(default)]
    run_attempt: Option<u64>,
    event: String,
    status: Option<String>,
    conclusion: Option<String>,
    head_branch: Option<String>,
    head_sha: String,
    actor: Option<ApiUser>,
    created_at: String,
    updated_at: String,
    run_started_at: Option<String>,
    html_url: String,
}

#[derive(Deserialize)]
struct ApiRuns {
    total_count: u64,
    workflow_runs: Vec<ApiRun>,
}

#[derive(Deserialize)]
struct ApiStep {
    number: u64,
    name: String,
    status: String,
    conclusion: Option<String>,
    started_at: Option<String>,
    completed_at: Option<String>,
}

#[derive(Deserialize)]
struct ApiJob {
    id: u64,
    name: String,
    status: String,
    conclusion: Option<String>,
    started_at: Option<String>,
    completed_at: Option<String>,
    html_url: Option<String>,
    #[serde(default)]
    steps: Vec<ApiStep>,
}

#[derive(Deserialize)]
struct ApiJobs {
    jobs: Vec<ApiJob>,
}

impl From<ApiWorkflow> for GitHubWorkflow {
    fn from(workflow: ApiWorkflow) -> Self {
        Self {
            id: workflow.id,
            name: workflow.name,
            path: workflow.path,
            state: workflow.state,
            html_url: workflow.html_url,
        }
    }
}

impl From<ApiRun> for GitHubWorkflowRun {
    fn from(run: ApiRun) -> Self {
        let name = run.name.unwrap_or_default();
        Self {
            id: run.id,
            workflow_id: run.workflow_id,
            display_title: run.display_title.unwrap_or_else(|| name.clone()),
            name,
            run_number: run.run_number,
            run_attempt: run.run_attempt.unwrap_or(1),
            event: run.event,
            status: run.status.unwrap_or_else(|| "queued".to_string()),
            conclusion: run.conclusion,
            head_branch: run.head_branch,
            head_sha: run.head_sha,
            actor: user_or_ghost(run.actor),
            created_at: run.created_at,
            updated_at: run.updated_at,
            run_started_at: run.run_started_at,
            html_url: run.html_url,
        }
    }
}

impl From<ApiJob> for GitHubJob {
    fn from(job: ApiJob) -> Self {
        Self {
            id: job.id,
            name: job.name,
            status: job.status,
            conclusion: job.conclusion,
            started_at: job.started_at,
            completed_at: job.completed_at,
            html_url: job.html_url,
            steps: job
                .steps
                .into_iter()
                .map(|step| GitHubJobStep {
                    number: step.number,
                    name: step.name,
                    status: step.status,
                    conclusion: step.conclusion,
                    started_at: step.started_at,
                    completed_at: step.completed_at,
                })
                .collect(),
        }
    }
}

pub async fn list_github_workflows(repo: &str) -> Result<Vec<GitHubWorkflow>, String> {
    let path = format!("{}/actions/workflows", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let result: ApiWorkflows = client
        .get_json(&path, &[("per_page", MAX_PER_PAGE.to_string())], None)
        .await?;
    Ok(result.workflows.into_iter().map(GitHubWorkflow::from).collect())
}

/// `workflow_id`가 있으면 해당 워크플로의 실행만 조회한다.
pub async fn list_github_workflow_runs(
    repo: &str,
    workflow_id: Option<u64>,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubWorkflowRun>, String> {
    let base = repo_path(repo)?;
    let path = match workflow_id {
        Some(id) => format!("{base}/actions/workflows/{id}/runs"),
        None => format!("{base}/actions/runs"),
    };
    let page = page.max(1);
    let per_page = per_page.clamp(1, MAX_PER_PAGE);

    let client = GitHubClient::connect().await?;
    let result: ApiRuns = client
        .get_json(
            &path,
            &[("page", page.to_string()), ("per_page", per_page.to_string())],
            None,
        )
        .await?;
    let total_pages = (result.total_count.div_ceil(u64::from(per_page)) as u32).max(1);
    Ok(GitHubPage {
        items: result
            .workflow_runs
            .into_iter()
            .map(GitHubWorkflowRun::from)
            .collect(),
        page,
        per_page,
        total_pages,
    })
}

pub async fn get_github_workflow_run(repo: &str, run_id: u64) -> Result<GitHubWorkflowRun, String> {
    let path = format!("{}/actions/runs/{run_id}", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let run: ApiRun = client.get_json(&path, &[], None).await?;
    Ok(run.into())
}

/// 최근 시도(attempt)의 job 목록
pub async fn list_github_run_jobs(repo: &str, run_id: u64) -> Result<Vec<GitHubJob>, String> {
    let path = format!("{}/actions/runs/{run_id}/jobs", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let result: ApiJobs = client
        .get_json(&path, &[("per_page", MAX_PER_PAGE.to_string())], None)
        .await?;
    Ok(result.jobs.into_iter().map(GitHubJob::from).collect())
}

/// 줄 앞 ISO 타임스탬프와 ANSI 색상 코드를 걷어낸다.
fn clean_log_line(line: &str) -> String {
    let line = match line.split_once(' ') {
        Some((stamp, rest))
            if stamp.len() >= 20
                && stamp.as_bytes()[4] == b'-'
                && stamp.contains('T')
                && stamp.ends_with('Z') =>
        {
            rest
        }
        _ => line,
    };

    let mut cleaned = String::with_capacity(line.len());
    let mut chars = line.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' && chars.peek() == Some(&'[') {
            chars.next();
            for next in chars.by_ref() {
                if next.is_ascii_alphabetic() {
                    break;
                }
            }
            continue;
        }
        cleaned.push(ch);
    }
    cleaned
}

/// job 로그 원문. 완료되지 않은 job은 GitHub가 로그를 주지 않을 수 있다.
pub async fn get_github_job_logs(repo: &str, job_id: u64) -> Result<String, String> {
    let path = format!("{}/actions/jobs/{job_id}/logs", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let response = client.request(Method::GET, &path, &[], None, None).await?;
    let text = response
        .text()
        .await
        .map_err(|error| format!("로그를 읽지 못했습니다: {error}"))?;
    let text = text.trim_start_matches('\u{feff}');

    let tail = if text.len() > MAX_LOG_BYTES {
        let mut start = text.len() - MAX_LOG_BYTES;
        while !text.is_char_boundary(start) {
            start += 1;
        }
        let start = text[start..].find('\n').map_or(start, |offset| start + offset + 1);
        &text[start..]
    } else {
        text
    };

    let mut cleaned: String = tail.lines().map(clean_log_line).collect::<Vec<_>>().join("\n");
    if tail.len() < text.len() {
        cleaned.insert_str(0, "… (앞부분 생략, 마지막 512KB만 표시)\n");
    }
    Ok(cleaned)
}

fn yaml_string(value: &Yaml) -> Option<String> {
    match value {
        Yaml::String(text) => Some(text.clone()),
        Yaml::Bool(flag) => Some(flag.to_string()),
        Yaml::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn parse_dispatch(source: &str) -> Result<GitHubWorkflowDispatch, String> {
    let doc: Yaml =
        serde_yaml::from_str(source).map_err(|error| format!("워크플로 YAML을 해석하지 못했습니다: {error}"))?;
    // YAML 1.1 파서는 `on`을 true로 읽을 수 있다
    let on = doc
        .get("on")
        .or_else(|| doc.as_mapping().and_then(|map| map.get(Yaml::Bool(true))));

    let dispatch = match on {
        Some(Yaml::String(event)) => {
            return Ok(GitHubWorkflowDispatch {
                dispatchable: event == "workflow_dispatch",
                inputs: Vec::new(),
            });
        }
        Some(Yaml::Sequence(events)) => {
            let dispatchable = events
                .iter()
                .any(|event| event.as_str() == Some("workflow_dispatch"));
            return Ok(GitHubWorkflowDispatch {
                dispatchable,
                inputs: Vec::new(),
            });
        }
        Some(Yaml::Mapping(events)) => match events.get("workflow_dispatch") {
            Some(dispatch) => dispatch,
            None => {
                return Ok(GitHubWorkflowDispatch {
                    dispatchable: false,
                    inputs: Vec::new(),
                })
            }
        },
        _ => {
            return Ok(GitHubWorkflowDispatch {
                dispatchable: false,
                inputs: Vec::new(),
            })
        }
    };

    let inputs = dispatch
        .get("inputs")
        .and_then(Yaml::as_mapping)
        .map(|inputs| {
            inputs
                .iter()
                .filter_map(|(name, spec)| {
                    let name = yaml_string(name)?;
                    Some(GitHubWorkflowInput {
                        name,
                        description: spec.get("description").and_then(yaml_string),
                        required: spec.get("required").and_then(Yaml::as_bool).unwrap_or(false),
                        default: spec.get("default").and_then(yaml_string),
                        kind: spec
                            .get("type")
                            .and_then(yaml_string)
                            .unwrap_or_else(|| "string".to_string()),
                        options: spec
                            .get("options")
                            .and_then(Yaml::as_sequence)
                            .map(|options| options.iter().filter_map(yaml_string).collect())
                            .unwrap_or_default(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(GitHubWorkflowDispatch {
        dispatchable: true,
        inputs,
    })
}

/// 워크플로 파일을 읽어 수동 실행 가능 여부와 입력값 정의를 돌려준다.
pub async fn get_github_workflow_dispatch(
    repo: &str,
    workflow_path: &str,
    git_ref: Option<&str>,
) -> Result<GitHubWorkflowDispatch, String> {
    if !workflow_path.starts_with(".github/workflows/") {
        return Err("워크플로 파일 경로가 올바르지 않습니다.".to_string());
    }
    let path = format!(
        "{}/contents/{}",
        repo_path(repo)?,
        encode_path(workflow_path, true)
    );
    let mut params = Vec::new();
    if let Some(git_ref) = git_ref.filter(|value| !value.is_empty()) {
        params.push(("ref", git_ref.to_string()));
    }
    let client = GitHubClient::connect().await?;
    match client.get_text_optional(&path, &params, ACCEPT_RAW).await? {
        Some(source) => parse_dispatch(&source),
        None => Ok(GitHubWorkflowDispatch {
            dispatchable: false,
            inputs: Vec::new(),
        }),
    }
}

pub async fn dispatch_github_workflow(
    repo: &str,
    workflow_id: u64,
    git_ref: &str,
    inputs: Map<String, Value>,
) -> Result<(), String> {
    if git_ref.trim().is_empty() {
        return Err("실행할 브랜치를 선택해 주세요.".to_string());
    }
    let path = format!("{}/actions/workflows/{workflow_id}/dispatches", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    client
        .send_empty(
            Method::POST,
            &path,
            Some(&json!({ "ref": git_ref, "inputs": inputs })),
        )
        .await
}

pub async fn rerun_github_workflow_run(
    repo: &str,
    run_id: u64,
    failed_only: bool,
) -> Result<(), String> {
    let action = if failed_only { "rerun-failed-jobs" } else { "rerun" };
    let path = format!("{}/actions/runs/{run_id}/{action}", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    client.send_empty(Method::POST, &path, None).await
}

pub async fn cancel_github_workflow_run(repo: &str, run_id: u64) -> Result<(), String> {
    let path = format!("{}/actions/runs/{run_id}/cancel", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    client.send_empty(Method::POST, &path, None).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_dispatch_inputs() {
        let source = r#"
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      env:
        description: 대상 환경
        required: true
        type: choice
        options: [dev, prod]
      dry:
        type: boolean
        default: false
"#;
        let dispatch = parse_dispatch(source).unwrap();
        assert!(dispatch.dispatchable);
        assert_eq!(dispatch.inputs.len(), 2);
        assert_eq!(dispatch.inputs[0].name, "env");
        assert_eq!(dispatch.inputs[0].options, vec!["dev", "prod"]);
        assert_eq!(dispatch.inputs[1].default.as_deref(), Some("false"));
    }

    #[test]
    fn detects_non_dispatchable() {
        assert!(!parse_dispatch("on: push\njobs: {}").unwrap().dispatchable);
        assert!(parse_dispatch("on: [push, workflow_dispatch]").unwrap().dispatchable);
    }

    #[test]
    fn cleans_log_lines() {
        assert_eq!(
            clean_log_line("2024-05-01T10:00:00.1234567Z \u{1b}[36;1mhello\u{1b}[0m"),
            "hello"
        );
        assert_eq!(clean_log_line("plain line"), "plain line");
    }
}
