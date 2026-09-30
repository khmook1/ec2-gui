use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::client::{
    repo_path, user_or_ghost, ApiUser, GitHubClient, GitHubPage, GitHubUser, ACCEPT_HTML_JSON,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubLabel {
    pub name: String,
    pub color: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubIssue {
    pub number: u64,
    pub title: String,
    /// "open" | "closed"
    pub state: String,
    pub user: GitHubUser,
    pub comments: u64,
    pub labels: Vec<GitHubLabel>,
    pub body_html: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub is_pull_request: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubComment {
    pub id: u64,
    pub user: GitHubUser,
    pub body_html: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
struct ApiLabel {
    name: String,
    #[serde(default)]
    color: String,
}

#[derive(Deserialize)]
pub(super) struct ApiIssue {
    number: u64,
    title: String,
    state: String,
    user: Option<ApiUser>,
    #[serde(default)]
    comments: u64,
    #[serde(default)]
    labels: Vec<ApiLabel>,
    body_html: Option<String>,
    created_at: String,
    updated_at: String,
    closed_at: Option<String>,
    pull_request: Option<Value>,
}

#[derive(Deserialize)]
struct ApiComment {
    id: u64,
    user: Option<ApiUser>,
    body_html: Option<String>,
    created_at: String,
}

impl From<ApiIssue> for GitHubIssue {
    fn from(issue: ApiIssue) -> Self {
        Self {
            number: issue.number,
            title: issue.title,
            state: issue.state,
            user: user_or_ghost(issue.user),
            comments: issue.comments,
            labels: issue
                .labels
                .into_iter()
                .map(|label| GitHubLabel {
                    name: label.name,
                    color: label.color,
                })
                .collect(),
            body_html: issue.body_html,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
            is_pull_request: issue.pull_request.is_some(),
        }
    }
}

impl From<ApiComment> for GitHubComment {
    fn from(comment: ApiComment) -> Self {
        Self {
            id: comment.id,
            user: user_or_ghost(comment.user),
            body_html: comment.body_html,
            created_at: comment.created_at,
        }
    }
}

pub(super) fn validate_open_closed(state: &str) -> Result<(), String> {
    match state {
        "open" | "closed" => Ok(()),
        _ => Err(format!("지원하지 않는 상태입니다: {state}")),
    }
}

/// `/issues`는 PR도 함께 돌려주므로 PR은 걸러낸다 (페이지당 개수가 줄어들 수 있음).
pub async fn list_github_issues(
    repo: &str,
    state: &str,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubIssue>, String> {
    validate_open_closed(state)?;
    let path = format!("{}/issues", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let mut result = client
        .get_page::<ApiIssue, GitHubIssue>(
            &path,
            vec![("state", state.to_string()), ("sort", "created".to_string())],
            page,
            per_page,
            None,
        )
        .await?;
    result.items.retain(|issue| !issue.is_pull_request);
    Ok(result)
}

pub async fn get_github_issue(repo: &str, number: u64) -> Result<GitHubIssue, String> {
    let path = format!("{}/issues/{number}", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let issue: ApiIssue = client.get_json(&path, &[], Some(ACCEPT_HTML_JSON)).await?;
    Ok(issue.into())
}

/// 이슈와 PR 댓글은 같은 엔드포인트를 쓴다.
pub async fn list_github_issue_comments(
    repo: &str,
    number: u64,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubComment>, String> {
    let path = format!("{}/issues/{number}/comments", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    client
        .get_page::<ApiComment, GitHubComment>(&path, Vec::new(), page, per_page, Some(ACCEPT_HTML_JSON))
        .await
}

pub async fn create_github_issue(repo: &str, title: &str, body: &str) -> Result<GitHubIssue, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("이슈 제목을 입력해 주세요.".to_string());
    }
    let path = format!("{}/issues", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let issue: ApiIssue = client
        .send_json(
            Method::POST,
            &path,
            &json!({ "title": title, "body": body }),
            Some(ACCEPT_HTML_JSON),
        )
        .await?;
    Ok(issue.into())
}

pub async fn set_github_issue_state(
    repo: &str,
    number: u64,
    state: &str,
) -> Result<GitHubIssue, String> {
    validate_open_closed(state)?;
    let path = format!("{}/issues/{number}", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let issue: ApiIssue = client
        .send_json(Method::PATCH, &path, &json!({ "state": state }), Some(ACCEPT_HTML_JSON))
        .await?;
    Ok(issue.into())
}

pub async fn create_github_issue_comment(
    repo: &str,
    number: u64,
    body: &str,
) -> Result<GitHubComment, String> {
    if body.trim().is_empty() {
        return Err("댓글 내용을 입력해 주세요.".to_string());
    }
    let path = format!("{}/issues/{number}/comments", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let comment: ApiComment = client
        .send_json(Method::POST, &path, &json!({ "body": body }), Some(ACCEPT_HTML_JSON))
        .await?;
    Ok(comment.into())
}
