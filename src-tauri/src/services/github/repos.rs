use base64::Engine;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use super::client::{encode_path, repo_path, GitHubClient, ACCEPT_HTML, MAX_PER_PAGE};

const AFFILIATIONS: [&str; 4] = [
    "owner,collaborator,organization_member",
    "owner",
    "collaborator",
    "organization_member",
];
const VISIBILITIES: [&str; 3] = ["all", "public", "private"];
/// GitHub 검색 API는 최대 1000건까지만 페이지로 접근할 수 있다.
const MAX_SEARCH_RESULTS: u64 = 1000;
const MAX_KEYWORD_CHARS: usize = 100;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubViewer {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepo {
    pub full_name: String,
    pub name: String,
    pub owner: String,
    pub owner_type: String,
    pub private: bool,
    pub fork: bool,
    pub archived: bool,
    pub description: Option<String>,
    pub language: Option<String>,
    pub stargazers: u64,
    pub default_branch: String,
    pub html_url: String,
    pub pushed_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepoPage {
    pub repos: Vec<GitHubRepo>,
    pub page: u32,
    pub per_page: u32,
    pub total_pages: u32,
    /// 검색 모드에서만 채워진다 (GitHub 검색 결과 총 개수)
    pub total_count: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepoQuery {
    pub page: u32,
    pub per_page: u32,
    pub affiliation: String,
    pub visibility: String,
    #[serde(default)]
    pub keyword: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct GitHubPermissions {
    #[serde(default)]
    pub admin: bool,
    #[serde(default)]
    pub maintain: bool,
    #[serde(default)]
    pub push: bool,
    #[serde(default)]
    pub triage: bool,
    #[serde(default)]
    pub pull: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepoDetail {
    pub full_name: String,
    pub name: String,
    pub owner: String,
    pub owner_avatar_url: String,
    pub private: bool,
    pub visibility: String,
    pub fork: bool,
    pub archived: bool,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub topics: Vec<String>,
    pub language: Option<String>,
    pub stargazers: u64,
    pub watchers: u64,
    pub forks: u64,
    pub open_issues: u64,
    pub default_branch: String,
    pub html_url: String,
    pub license: Option<String>,
    pub has_issues: bool,
    pub created_at: Option<String>,
    pub pushed_at: Option<String>,
    pub permissions: GitHubPermissions,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubLanguage {
    pub name: String,
    pub bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubContentEntry {
    pub name: String,
    pub path: String,
    /// "file" | "dir" | "symlink" | "submodule"
    pub kind: String,
    pub size: u64,
    pub sha: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub sha: String,
    /// 텍스트 파일일 때만 존재
    pub content: Option<String>,
    pub binary: bool,
    /// GitHub contents API는 1MB 초과 파일 내용을 주지 않는다.
    pub too_large: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepoUpdate {
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub private: Option<bool>,
    pub has_issues: Option<bool>,
    pub archived: Option<bool>,
}

#[derive(Deserialize)]
struct ApiOrg {
    login: String,
}

#[derive(Deserialize)]
struct ApiSearchResult {
    total_count: u64,
    items: Vec<ApiRepo>,
}

#[derive(Deserialize)]
struct ApiViewer {
    login: String,
    name: Option<String>,
    avatar_url: String,
}

#[derive(Deserialize)]
struct ApiOwner {
    login: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    avatar_url: String,
}

#[derive(Deserialize)]
struct ApiRepo {
    full_name: String,
    name: String,
    owner: ApiOwner,
    private: bool,
    fork: bool,
    archived: bool,
    description: Option<String>,
    language: Option<String>,
    stargazers_count: u64,
    default_branch: Option<String>,
    html_url: String,
    pushed_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Deserialize)]
struct ApiLicense {
    name: Option<String>,
    spdx_id: Option<String>,
}

#[derive(Deserialize)]
struct ApiRepoDetail {
    full_name: String,
    name: String,
    owner: ApiOwner,
    private: bool,
    visibility: Option<String>,
    fork: bool,
    archived: bool,
    description: Option<String>,
    homepage: Option<String>,
    #[serde(default)]
    topics: Vec<String>,
    language: Option<String>,
    stargazers_count: u64,
    #[serde(default)]
    subscribers_count: u64,
    forks_count: u64,
    open_issues_count: u64,
    default_branch: Option<String>,
    html_url: String,
    license: Option<ApiLicense>,
    has_issues: bool,
    created_at: Option<String>,
    pushed_at: Option<String>,
    #[serde(default)]
    permissions: GitHubPermissions,
}

#[derive(Deserialize)]
struct ApiContentEntry {
    name: String,
    path: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    size: u64,
    sha: String,
}

#[derive(Deserialize)]
struct ApiFile {
    name: String,
    path: String,
    #[serde(default)]
    size: u64,
    sha: String,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    encoding: Option<String>,
}

#[derive(Deserialize)]
struct ApiTopics {
    names: Vec<String>,
}

impl From<ApiRepo> for GitHubRepo {
    fn from(repo: ApiRepo) -> Self {
        Self {
            full_name: repo.full_name,
            name: repo.name,
            owner: repo.owner.login,
            owner_type: repo.owner.kind,
            private: repo.private,
            fork: repo.fork,
            archived: repo.archived,
            description: repo.description,
            language: repo.language,
            stargazers: repo.stargazers_count,
            default_branch: repo.default_branch.unwrap_or_default(),
            html_url: repo.html_url,
            pushed_at: repo.pushed_at,
            updated_at: repo.updated_at,
        }
    }
}

impl From<ApiRepoDetail> for GitHubRepoDetail {
    fn from(repo: ApiRepoDetail) -> Self {
        let visibility = repo.visibility.unwrap_or_else(|| {
            if repo.private { "private" } else { "public" }.to_string()
        });
        Self {
            full_name: repo.full_name,
            name: repo.name,
            owner: repo.owner.login,
            owner_avatar_url: repo.owner.avatar_url,
            private: repo.private,
            visibility,
            fork: repo.fork,
            archived: repo.archived,
            description: repo.description,
            homepage: repo.homepage.filter(|value| !value.is_empty()),
            topics: repo.topics,
            language: repo.language,
            stargazers: repo.stargazers_count,
            watchers: repo.subscribers_count,
            forks: repo.forks_count,
            open_issues: repo.open_issues_count,
            default_branch: repo.default_branch.unwrap_or_default(),
            html_url: repo.html_url,
            license: repo
                .license
                .and_then(|license| license.spdx_id.filter(|id| id != "NOASSERTION").or(license.name)),
            has_issues: repo.has_issues,
            created_at: repo.created_at,
            pushed_at: repo.pushed_at,
            permissions: repo.permissions,
        }
    }
}

fn ref_params(git_ref: Option<&str>) -> Vec<(&'static str, String)> {
    git_ref
        .filter(|value| !value.is_empty())
        .map(|value| vec![("ref", value.to_string())])
        .unwrap_or_default()
}

pub async fn get_github_viewer() -> Result<GitHubViewer, String> {
    let client = GitHubClient::connect().await?;
    let viewer: ApiViewer = client.get_json("/user", &[], None).await?;
    Ok(GitHubViewer {
        login: viewer.login,
        name: viewer.name,
        avatar_url: viewer.avatar_url,
    })
}

/// 검색 API는 기본이 GitHub 전체라서 `user:`/`org:` 한정자로 내 계정·소속 조직으로 좁힌다.
async fn build_search_scope(client: &GitHubClient, affiliation: &str) -> Result<Vec<String>, String> {
    let include_user = affiliation.contains("owner");
    let include_orgs = affiliation.contains("organization_member");
    if !include_user && !include_orgs {
        return Err(
            "협업 저장소는 GitHub 검색 API 범위에 포함되지 않습니다. 소유 범위를 바꾼 뒤 검색해 주세요."
                .to_string(),
        );
    }

    let mut scope = Vec::new();
    if include_user {
        let viewer: ApiViewer = client.get_json("/user", &[], None).await?;
        scope.push(format!("user:{}", viewer.login));
    }
    if include_orgs {
        let orgs: Vec<ApiOrg> = client
            .get_json("/user/orgs", &[("per_page", MAX_PER_PAGE.to_string())], None)
            .await?;
        scope.extend(orgs.into_iter().map(|org| format!("org:{}", org.login)));
    }
    if scope.is_empty() {
        return Err("검색할 수 있는 조직이 없습니다.".to_string());
    }
    Ok(scope)
}

async fn search_repos(
    client: &GitHubClient,
    query: &GitHubRepoQuery,
    keyword: &str,
    page: u32,
    per_page: u32,
) -> Result<GitHubRepoPage, String> {
    let scope = build_search_scope(client, &query.affiliation).await?;
    let mut q = format!("{keyword} in:name,description fork:true");
    if query.visibility != "all" {
        q.push_str(&format!(" is:{}", query.visibility));
    }
    for qualifier in scope {
        q.push(' ');
        q.push_str(&qualifier);
    }

    let result: ApiSearchResult = client
        .get_json(
            "/search/repositories",
            &[
                ("q", q),
                ("per_page", per_page.to_string()),
                ("page", page.to_string()),
            ],
            None,
        )
        .await?;
    let reachable = result.total_count.min(MAX_SEARCH_RESULTS);
    let total_pages = reachable.div_ceil(u64::from(per_page)).max(1) as u32;

    Ok(GitHubRepoPage {
        repos: result.items.into_iter().map(GitHubRepo::from).collect(),
        page,
        per_page,
        total_pages: total_pages.max(page),
        total_count: Some(result.total_count),
    })
}

pub async fn list_github_repos(query: GitHubRepoQuery) -> Result<GitHubRepoPage, String> {
    if !AFFILIATIONS.contains(&query.affiliation.as_str()) {
        return Err(format!("지원하지 않는 소유 범위입니다: {}", query.affiliation));
    }
    if !VISIBILITIES.contains(&query.visibility.as_str()) {
        return Err(format!("지원하지 않는 공개 범위입니다: {}", query.visibility));
    }
    let page = query.page.max(1);
    let per_page = query.per_page.clamp(1, MAX_PER_PAGE);
    let keyword: String = query
        .keyword
        .as_deref()
        .unwrap_or_default()
        .trim()
        .chars()
        .take(MAX_KEYWORD_CHARS)
        .collect();

    let client = GitHubClient::connect().await?;
    if !keyword.is_empty() {
        return search_repos(&client, &query, &keyword, page, per_page).await;
    }

    let result = client
        .get_page::<ApiRepo, GitHubRepo>(
            "/user/repos",
            vec![
                ("sort", "pushed".to_string()),
                ("affiliation", query.affiliation.clone()),
                ("visibility", query.visibility.clone()),
            ],
            page,
            per_page,
            None,
        )
        .await?;

    Ok(GitHubRepoPage {
        repos: result.items,
        page: result.page,
        per_page: result.per_page,
        total_pages: result.total_pages,
        total_count: None,
    })
}

pub async fn get_github_repo(repo: &str) -> Result<GitHubRepoDetail, String> {
    let path = repo_path(repo)?;
    let client = GitHubClient::connect().await?;
    let detail: ApiRepoDetail = client.get_json(&path, &[], None).await?;
    Ok(detail.into())
}

pub async fn get_github_repo_languages(repo: &str) -> Result<Vec<GitHubLanguage>, String> {
    let path = format!("{}/languages", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    let map: Map<String, Value> = client.get_json(&path, &[], None).await?;
    let mut languages: Vec<GitHubLanguage> = map
        .into_iter()
        .map(|(name, bytes)| GitHubLanguage {
            name,
            bytes: bytes.as_u64().unwrap_or_default(),
        })
        .collect();
    languages.sort_by(|a, b| b.bytes.cmp(&a.bytes));
    Ok(languages)
}

/// README를 GitHub가 렌더링한 HTML로 반환. README가 없으면 `None`.
pub async fn get_github_readme(repo: &str, git_ref: Option<&str>) -> Result<Option<String>, String> {
    let path = format!("{}/readme", repo_path(repo)?);
    let client = GitHubClient::connect().await?;
    client
        .get_text_optional(&path, &ref_params(git_ref), ACCEPT_HTML)
        .await
}

pub async fn list_github_contents(
    repo: &str,
    dir: &str,
    git_ref: Option<&str>,
) -> Result<Vec<GitHubContentEntry>, String> {
    let dir = dir.trim_matches('/');
    let path = format!("{}/contents/{}", repo_path(repo)?, encode_path(dir, true));
    let client = GitHubClient::connect().await?;
    let value: Value = client.get_json(&path, &ref_params(git_ref), None).await?;
    let Value::Array(items) = value else {
        return Err("폴더가 아닌 경로입니다.".to_string());
    };

    let mut entries: Vec<GitHubContentEntry> = items
        .into_iter()
        .filter_map(|item| serde_json::from_value::<ApiContentEntry>(item).ok())
        .map(|entry| GitHubContentEntry {
            name: entry.name,
            path: entry.path,
            kind: entry.kind,
            size: entry.size,
            sha: entry.sha,
        })
        .collect();
    entries.sort_by(|a, b| {
        let a_dir = a.kind == "dir";
        let b_dir = b.kind == "dir";
        b_dir
            .cmp(&a_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

pub async fn get_github_file(
    repo: &str,
    file_path: &str,
    git_ref: Option<&str>,
) -> Result<GitHubFile, String> {
    let file_path = file_path.trim_matches('/');
    let path = format!("{}/contents/{}", repo_path(repo)?, encode_path(file_path, true));
    let client = GitHubClient::connect().await?;
    let file: ApiFile = client.get_json(&path, &ref_params(git_ref), None).await?;

    let raw = match (file.encoding.as_deref(), file.content.as_deref()) {
        (Some("base64"), Some(content)) => {
            let compact: String = content.chars().filter(|ch| !ch.is_whitespace()).collect();
            Some(
                base64::engine::general_purpose::STANDARD
                    .decode(compact)
                    .map_err(|error| format!("파일 내용을 해석하지 못했습니다: {error}"))?,
            )
        }
        _ => None,
    };

    let too_large = raw.is_none() && file.size > 0;
    let (content, binary) = match raw {
        Some(bytes) if bytes.contains(&0) => (None, true),
        Some(bytes) => match String::from_utf8(bytes) {
            Ok(text) => (Some(text), false),
            Err(_) => (None, true),
        },
        None => (None, false),
    };

    Ok(GitHubFile {
        name: file.name,
        path: file.path,
        size: file.size,
        sha: file.sha,
        content,
        binary,
        too_large,
    })
}

pub async fn update_github_repo(
    repo: &str,
    update: GitHubRepoUpdate,
) -> Result<GitHubRepoDetail, String> {
    let path = repo_path(repo)?;
    let mut body = Map::new();
    if let Some(description) = update.description {
        body.insert("description".into(), json!(description));
    }
    if let Some(homepage) = update.homepage {
        body.insert("homepage".into(), json!(homepage));
    }
    if let Some(private) = update.private {
        body.insert("private".into(), json!(private));
    }
    if let Some(has_issues) = update.has_issues {
        body.insert("has_issues".into(), json!(has_issues));
    }
    if let Some(archived) = update.archived {
        body.insert("archived".into(), json!(archived));
    }
    if body.is_empty() {
        return Err("변경할 항목이 없습니다.".to_string());
    }

    let client = GitHubClient::connect().await?;
    let detail: ApiRepoDetail = client
        .send_json(Method::PATCH, &path, &Value::Object(body), None)
        .await?;
    Ok(detail.into())
}

pub async fn replace_github_topics(repo: &str, names: Vec<String>) -> Result<Vec<String>, String> {
    let path = format!("{}/topics", repo_path(repo)?);
    let names: Vec<String> = names
        .into_iter()
        .map(|name| name.trim().to_lowercase().replace(' ', "-"))
        .filter(|name| !name.is_empty())
        .collect();
    let client = GitHubClient::connect().await?;
    let topics: ApiTopics = client
        .send_json(Method::PUT, &path, &json!({ "names": names }), None)
        .await?;
    Ok(topics.names)
}
