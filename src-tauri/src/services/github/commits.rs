use serde::{Deserialize, Serialize};

use super::client::{encode_path, repo_path, ApiUser, GitHubClient, MAX_PER_PAGE};

/// GitHub 검색 API는 최대 1000건(100건 × 10페이지)까지만 접근할 수 있다.
const MAX_SEARCH_PAGES: u32 = 10;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyCommit {
    pub repo: String,
    pub sha: String,
    pub message: String,
    pub date: String,
    pub url: String,
    #[serde(default)]
    pub author_login: Option<String>,
    #[serde(default)]
    pub author_avatar_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubCommitFile {
    pub filename: String,
    pub previous_filename: Option<String>,
    /// added | removed | modified | renamed | copied | changed | unchanged
    pub status: String,
    pub additions: u64,
    pub deletions: u64,
    /// 바이너리이거나 diff가 너무 크면 GitHub가 생략한다.
    pub patch: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubCommitDetail {
    pub sha: String,
    pub additions: u64,
    pub deletions: u64,
    pub files: Vec<GitHubCommitFile>,
}

#[derive(Deserialize)]
struct ApiCommitStats {
    additions: u64,
    deletions: u64,
}

#[derive(Deserialize)]
struct ApiCommitFile {
    filename: String,
    previous_filename: Option<String>,
    status: String,
    additions: u64,
    deletions: u64,
    patch: Option<String>,
}

#[derive(Deserialize)]
struct ApiCommit {
    sha: String,
    stats: Option<ApiCommitStats>,
    #[serde(default)]
    files: Vec<ApiCommitFile>,
}

#[derive(Deserialize)]
struct ApiSearchCommits {
    total_count: u64,
    items: Vec<ApiSearchCommit>,
}

#[derive(Deserialize)]
struct ApiSearchCommit {
    sha: String,
    html_url: String,
    commit: ApiCommitDetail,
    repository: ApiCommitRepo,
    /// 커밋 이메일이 GitHub 계정과 연결되지 않으면 null
    author: Option<ApiUser>,
}

#[derive(Deserialize)]
struct ApiCommitDetail {
    message: String,
    author: Option<ApiCommitAuthor>,
}

#[derive(Deserialize)]
struct ApiCommitAuthor {
    date: Option<String>,
}

#[derive(Deserialize)]
struct ApiCommitRepo {
    full_name: String,
}

#[derive(Deserialize)]
struct ApiLogin {
    login: String,
}

/// 변경 파일은 GitHub 기본값대로 최대 300개까지 온다.
pub async fn get_github_commit(repo: &str, sha: &str) -> Result<GitHubCommitDetail, String> {
    let client = GitHubClient::connect().await?;
    fetch_commit_detail(&client, repo, sha).await
}

pub async fn fetch_commit_detail(
    client: &GitHubClient,
    repo: &str,
    sha: &str,
) -> Result<GitHubCommitDetail, String> {
    let path = format!("{}/commits/{}", repo_path(repo)?, encode_path(sha, false));
    let commit: ApiCommit = client.get_json(&path, &[], None).await?;
    let (additions, deletions) = commit
        .stats
        .map(|stats| (stats.additions, stats.deletions))
        .unwrap_or_default();
    Ok(GitHubCommitDetail {
        sha: commit.sha,
        additions,
        deletions,
        files: commit
            .files
            .into_iter()
            .map(|file| GitHubCommitFile {
                filename: file.filename,
                previous_filename: file.previous_filename,
                status: file.status,
                additions: file.additions,
                deletions: file.deletions,
                patch: file.patch,
            })
            .collect(),
    })
}

pub async fn get_viewer_login(client: &GitHubClient) -> Result<String, String> {
    let viewer: ApiLogin = client.get_json("/user", &[], None).await?;
    Ok(viewer.login)
}

/// `since`·`until`은 `YYYY-MM-DD` (양 끝 포함). 머지 커밋은 제외하고 최신순으로 돌려준다.
pub async fn search_my_commits(
    client: &GitHubClient,
    login: &str,
    since: &str,
    until: &str,
) -> Result<Vec<WeeklyCommit>, String> {
    let query = format!("author:{login} author-date:{since}..{until}");
    let mut commits = Vec::new();

    for page in 1..=MAX_SEARCH_PAGES {
        let params = [
            ("q", query.clone()),
            ("sort", "author-date".to_string()),
            ("order", "desc".to_string()),
            ("per_page", MAX_PER_PAGE.to_string()),
            ("page", page.to_string()),
        ];
        let result: ApiSearchCommits = client.get_json("/search/commits", &params, None).await?;
        let fetched = result.items.len();
        commits.extend(
            result
                .items
                .into_iter()
                .filter(|item| !item.commit.message.starts_with("Merge "))
                .map(|item| WeeklyCommit {
                    repo: item.repository.full_name,
                    sha: item.sha,
                    message: item.commit.message.trim().to_string(),
                    date: item.commit.author.and_then(|author| author.date).unwrap_or_default(),
                    url: item.html_url,
                    author_login: item.author.as_ref().map(|user| user.login.clone()),
                    author_avatar_url: item.author.map(|user| user.avatar_url),
                }),
        );
        let seen = u64::from(page) * u64::from(MAX_PER_PAGE);
        if fetched < MAX_PER_PAGE as usize || seen >= result.total_count {
            break;
        }
    }
    Ok(commits)
}
