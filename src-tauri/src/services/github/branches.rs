use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::client::{encode_path, repo_path, GitHubClient, GitHubPage};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubBranch {
    pub name: String,
    pub sha: String,
    pub protected: bool,
}

#[derive(Deserialize)]
struct ApiCommitRef {
    sha: String,
}

#[derive(Deserialize)]
struct ApiBranch {
    name: String,
    commit: ApiCommitRef,
    #[serde(default)]
    protected: bool,
}

#[derive(Deserialize)]
struct ApiGitObject {
    sha: String,
}

#[derive(Deserialize)]
struct ApiGitRef {
    object: ApiGitObject,
}

impl From<ApiBranch> for GitHubBranch {
    fn from(branch: ApiBranch) -> Self {
        Self {
            name: branch.name,
            sha: branch.commit.sha,
            protected: branch.protected,
        }
    }
}

fn validate_branch_name(name: &str) -> Result<&str, String> {
    let name = name.trim();
    let invalid = name.is_empty()
        || name.starts_with('/')
        || name.ends_with('/')
        || name.ends_with(".lock")
        || name.contains("..")
        || name.contains("//")
        || name
            .chars()
            .any(|ch| ch.is_whitespace() || matches!(ch, '~' | '^' | ':' | '?' | '*' | '[' | '\\'));
    if invalid {
        Err(format!("브랜치 이름이 올바르지 않습니다: {name}"))
    } else {
        Ok(name)
    }
}

pub async fn list_github_branches(
    repo: &str,
    page: u32,
    per_page: u32,
) -> Result<GitHubPage<GitHubBranch>, String> {
    let path = format!("{}/branches", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    client
        .get_page::<ApiBranch, GitHubBranch>(&path, Vec::new(), page, per_page, None)
        .await
}

pub async fn create_github_branch(repo: &str, name: &str, from: &str) -> Result<GitHubBranch, String> {
    let name = validate_branch_name(name)?;
    let from = validate_branch_name(from)?;
    let base = repo_path(repo)?;
    let client = GitHubClient::connect().await?;

    let source: ApiGitRef = client
        .get_json(
            &format!("{base}/git/ref/heads/{}", encode_path(from, true)),
            &[],
            None,
        )
        .await?;
    let created: ApiGitRef = client
        .send_json(
            Method::POST,
            &format!("{base}/git/refs"),
            &json!({ "ref": format!("refs/heads/{name}"), "sha": source.object.sha }),
            None,
        )
        .await?;

    Ok(GitHubBranch {
        name: name.to_string(),
        sha: created.object.sha,
        protected: false,
    })
}

pub async fn delete_github_branch(repo: &str, name: &str) -> Result<(), String> {
    let name = validate_branch_name(name)?;
    let path = format!("{}/git/refs/heads/{}", repo_path(repo)?, encode_path(name, true));
    let client = GitHubClient::connect().await?;
    client.send_empty(Method::DELETE, &path, None).await
}
