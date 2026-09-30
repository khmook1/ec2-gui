use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use super::client::{
    repo_path, user_or_ghost, ApiUser, GitHubClient, GitHubPage, GitHubUser, ACCEPT_HTML_JSON,
};
use super::issues::validate_open_closed;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPull {
    pub number: u64,
    pub title: String,
    /// "open" | "closed"
    pub state: String,
    pub draft: bool,
    pub merged: bool,
    pub user: GitHubUser,
    pub head_ref: String,
    pub base_ref: String,
    pub body_html: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub merged_at: Option<String>,
    /// 상세 조회에서만 채워짐
    pub mergeable: Option<bool>,
    pub mergeable_state: Option<String>,
    pub comments: Option<u64>,
    pub commits: Option<u64>,
    pub additions: Option<u64>,
    pub deletions: Option<u64>,
    pub changed_files: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubMergeResult {
    pub merged: bool,
    pub message: String,
}

#[derive(Deserialize)]
struct ApiRef {
    #[serde(rename = "ref")]
    name: String,
}

#[derive(Deserialize)]
struct ApiPull {
    number: u64,
    title: String,
    state: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    merged: Option<bool>,
    user: Option<ApiUser>,
    head: ApiRef,
    base: ApiRef,
    body_html: Option<String>,
    created_at: String,
    updated_at: String,
    closed_at: Option<String>,
    merged_at: Option<String>,
    mergeable: Option<bool>,
    mergeable_state: Option<String>,
    comments: Option<u64>,
    commits: Option<u64>,
    additions: Option<u64>,
    deletions: Option<u64>,
    changed_files: Option<u64>,
}

#[derive(Deserialize)]
struct ApiMergeResult {
    merged: bool,
    message: String,
}

impl From<ApiPull> for GitHubPull {
    fn from(pull: ApiPull) -> Self {
        let merged = pull.merged.unwrap_or(pull.merged_at.is_some());
        Self {
            number: pull.number,
            title: pull.title,
            state: pull.state,
            draft: pull.draft,
            merged,
            user: user_or_ghost(pull.user),
            head_ref: pull.head.name,
            base_ref: pull.base.name,
            body_html: pull.body_html,
            created_at: pull.created_at,
            updated_at: pull.updated_at,
            closed_at: pull.closed_at,
            merged_at: pull.merged_at,
            mergeable: pull.mergeable,
            mergeable_state: pull.mergeable_state,
            comments: pull.comments,
            commits: pull.commits,
            additions: pull.additions,
            deletions: pull.deletions,
            changed_files: pull.changed_files,
        }
    }
}

pub async fn list_github_pulls(
    repo: &str,
    state: &str,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubPull>, String> {
    validate_open_closed(state)?;
    let path = format!("{}/pulls", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    client
        .get_page::<ApiPull, GitHubPull>(
            &path,
            vec![("state", state.to_string()), ("sort", "created".to_string()), ("direction", "desc".to_string())],
            page,
            per_page,
            None,
        )
        .await
}

pub async fn get_github_pull(repo: &str, number: u64) -> Result<GitHubPull, String> {
    let path = format!("{}/pulls/{number}", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let pull: ApiPull = client.get_json(&path, &[], Some(ACCEPT_HTML_JSON)).await?;
    Ok(pull.into())
}

pub async fn merge_github_pull(
    repo: &str,
    number: u64,
    method: &str,
    commit_title: Option<String>,
) -> Result<GitHubMergeResult, String> {
    if !matches!(method, "merge" | "squash" | "rebase") {
        return Err(format!("지원하지 않는 머지 방식입니다: {method}"));
    }
    let path = format!("{}/pulls/{number}/merge", repo_path(repo)?);
    let mut body = Map::new();
    body.insert("merge_method".into(), json!(method));
    if let Some(title) = commit_title.filter(|title| !title.trim().is_empty()) {
        body.insert("commit_title".into(), json!(title));
    }

    let client = GitHubClient::connect().await?;
    let result: ApiMergeResult = client
        .send_json(Method::PUT, &path, &Value::Object(body), None)
        .await?;
    Ok(GitHubMergeResult {
        merged: result.merged,
        message: result.message,
    })
}

pub async fn set_github_pull_state(
    repo: &str,
    number: u64,
    state: &str,
) -> Result<GitHubPull, String> {
    validate_open_closed(state)?;
    let path = format!("{}/pulls/{number}", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let pull: ApiPull = client
        .send_json(Method::PATCH, &path, &json!({ "state": state }), Some(ACCEPT_HTML_JSON))
        .await?;
    Ok(pull.into())
}
