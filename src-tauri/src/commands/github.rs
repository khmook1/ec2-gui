use serde_json::{Map, Value};

use crate::services::github::{
    self, GitHubActiveRuns, GitHubBranch, GitHubComment, GitHubCommitDetail, GitHubContentEntry, GitHubFile, GitHubIssue, GitHubJob,
    GitHubLanguage, GitHubMergeResult, GitHubPage, GitHubPull, GitHubRepoDetail, GitHubRepoPage,
    GitHubRepoQuery, GitHubRepoUpdate, GitHubViewer, GitHubWorkflow, GitHubWorkflowDispatch,
    GitHubWorkflowRun,
};

/// README·댓글 링크를 웹뷰가 아닌 기본 브라우저로 연다 (http/https만 허용).
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("http(s) 주소만 열 수 있습니다.".to_string());
    }

    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = std::process::Command::new("rundll32");
        command.arg("url.dll,FileProtocolHandler");
        command
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = std::process::Command::new("xdg-open");

    command
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("브라우저를 열지 못했습니다: {e}"))
}

#[tauri::command]
pub async fn get_github_viewer() -> Result<GitHubViewer, String> {
    github::get_github_viewer().await
}

#[tauri::command]
pub async fn list_github_repos(query: GitHubRepoQuery) -> Result<GitHubRepoPage, String> {
    github::list_github_repos(query).await
}

#[tauri::command]
pub async fn get_github_repo(repo: String) -> Result<GitHubRepoDetail, String> {
    github::get_github_repo(&repo).await
}

#[tauri::command]
pub async fn get_github_repo_languages(repo: String) -> Result<Vec<GitHubLanguage>, String> {
    github::get_github_repo_languages(&repo).await
}

#[tauri::command]
pub async fn get_github_readme(repo: String, git_ref: Option<String>) -> Result<Option<String>, String> {
    github::get_github_readme(&repo, git_ref.as_deref()).await
}

#[tauri::command]
pub async fn list_github_contents(
    repo: String,
    path: String,
    git_ref: Option<String>,
) -> Result<Vec<GitHubContentEntry>, String> {
    github::list_github_contents(&repo, &path, git_ref.as_deref()).await
}

#[tauri::command]
pub async fn get_github_file(
    repo: String,
    path: String,
    git_ref: Option<String>,
) -> Result<GitHubFile, String> {
    github::get_github_file(&repo, &path, git_ref.as_deref()).await
}

#[tauri::command]
pub async fn update_github_repo(
    repo: String,
    update: GitHubRepoUpdate,
) -> Result<GitHubRepoDetail, String> {
    github::update_github_repo(&repo, update).await
}

#[tauri::command]
pub async fn replace_github_topics(repo: String, names: Vec<String>) -> Result<Vec<String>, String> {
    github::replace_github_topics(&repo, names).await
}

#[tauri::command]
pub async fn list_github_branches(
    repo: String,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubBranch>, String> {
    github::list_github_branches(&repo, page, per_page).await
}

#[tauri::command]
pub async fn create_github_branch(
    repo: String,
    name: String,
    from: String,
) -> Result<GitHubBranch, String> {
    github::create_github_branch(&repo, &name, &from).await
}

#[tauri::command]
pub async fn delete_github_branch(repo: String, name: String) -> Result<(), String> {
    github::delete_github_branch(&repo, &name).await
}

#[tauri::command]
pub async fn list_github_issues(
    repo: String,
    state: String,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubIssue>, String> {
    github::list_github_issues(&repo, &state, page, per_page).await
}

#[tauri::command]
pub async fn get_github_issue(repo: String, number: u64) -> Result<GitHubIssue, String> {
    github::get_github_issue(&repo, number).await
}

#[tauri::command]
pub async fn list_github_issue_comments(
    repo: String,
    number: u64,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubComment>, String> {
    github::list_github_issue_comments(&repo, number, page, per_page).await
}

#[tauri::command]
pub async fn create_github_issue(
    repo: String,
    title: String,
    body: String,
) -> Result<GitHubIssue, String> {
    github::create_github_issue(&repo, &title, &body).await
}

#[tauri::command]
pub async fn set_github_issue_state(
    repo: String,
    number: u64,
    state: String,
) -> Result<GitHubIssue, String> {
    github::set_github_issue_state(&repo, number, &state).await
}

#[tauri::command]
pub async fn create_github_issue_comment(
    repo: String,
    number: u64,
    body: String,
) -> Result<GitHubComment, String> {
    github::create_github_issue_comment(&repo, number, &body).await
}

#[tauri::command]
pub async fn list_github_pulls(
    repo: String,
    state: String,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubPull>, String> {
    github::list_github_pulls(&repo, &state, page, per_page).await
}

#[tauri::command]
pub async fn get_github_pull(repo: String, number: u64) -> Result<GitHubPull, String> {
    github::get_github_pull(&repo, number).await
}

#[tauri::command]
pub async fn get_github_commit(repo: String, sha: String) -> Result<GitHubCommitDetail, String> {
    github::get_github_commit(&repo, &sha).await
}

#[tauri::command]
pub async fn merge_github_pull(
    repo: String,
    number: u64,
    method: String,
    commit_title: Option<String>,
) -> Result<GitHubMergeResult, String> {
    github::merge_github_pull(&repo, number, &method, commit_title).await
}

#[tauri::command]
pub async fn set_github_pull_state(
    repo: String,
    number: u64,
    state: String,
) -> Result<GitHubPull, String> {
    github::set_github_pull_state(&repo, number, &state).await
}

#[tauri::command]
pub async fn list_github_workflows(repo: String) -> Result<Vec<GitHubWorkflow>, String> {
    github::list_github_workflows(&repo).await
}

#[tauri::command]
pub async fn list_github_workflow_runs(
    repo: String,
    workflow_id: Option<u64>,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubWorkflowRun>, String> {
    github::list_github_workflow_runs(&repo, workflow_id, page, per_page).await
}

#[tauri::command]
pub async fn list_github_active_runs() -> Result<GitHubActiveRuns, String> {
    github::list_github_active_runs().await
}

#[tauri::command]
pub async fn get_github_workflow_run(
    repo: String,
    run_id: u64,
) -> Result<GitHubWorkflowRun, String> {
    github::get_github_workflow_run(&repo, run_id).await
}

#[tauri::command]
pub async fn list_github_run_jobs(repo: String, run_id: u64) -> Result<Vec<GitHubJob>, String> {
    github::list_github_run_jobs(&repo, run_id).await
}

#[tauri::command]
pub async fn get_github_job_logs(repo: String, job_id: u64) -> Result<String, String> {
    github::get_github_job_logs(&repo, job_id).await
}

#[tauri::command]
pub async fn get_github_workflow_dispatch(
    repo: String,
    path: String,
    git_ref: Option<String>,
) -> Result<GitHubWorkflowDispatch, String> {
    github::get_github_workflow_dispatch(&repo, &path, git_ref.as_deref()).await
}

#[tauri::command]
pub async fn dispatch_github_workflow(
    repo: String,
    workflow_id: u64,
    git_ref: String,
    inputs: Map<String, Value>,
) -> Result<(), String> {
    github::dispatch_github_workflow(&repo, workflow_id, &git_ref, inputs).await
}

#[tauri::command]
pub async fn rerun_github_workflow_run(
    repo: String,
    run_id: u64,
    failed_only: bool,
) -> Result<(), String> {
    github::rerun_github_workflow_run(&repo, run_id, failed_only).await
}

#[tauri::command]
pub async fn cancel_github_workflow_run(repo: String, run_id: u64) -> Result<(), String> {
    github::cancel_github_workflow_run(&repo, run_id).await
}
