use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, LINK, USER_AGENT};
use reqwest::{Client, Method, Response, StatusCode, Url};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const API_BASE: &str = "https://api.github.com";
const GIT_CANDIDATES: [&str; 3] = ["git", "/usr/bin/git", "/opt/homebrew/bin/git"];
pub const MAX_PER_PAGE: u32 = 100;
/// 이슈·PR 본문과 댓글을 GitHub가 렌더링한 HTML(`body_html`)로 받는다.
pub const ACCEPT_HTML_JSON: &str = "application/vnd.github.html+json";
/// README 등 파일을 렌더링된 HTML 원문으로 받는다.
pub const ACCEPT_HTML: &str = "application/vnd.github.html";

const MISSING_CREDENTIAL: &str =
    "로컬 git에 저장된 GitHub 인증 정보가 없습니다. 터미널에서 github.com에 한 번 push/pull 해 로그인해 주세요.";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPage<T> {
    pub items: Vec<T>,
    pub page: u32,
    pub per_page: u32,
    pub total_pages: u32,
}

#[derive(Deserialize)]
struct ApiError {
    message: Option<String>,
}

/// `None`: 해당 경로에 git 실행 파일이 없음
fn run_credential_fill(git: &str) -> Option<Result<String, String>> {
    let mut child = match Command::new(git)
        .args(["credential", "fill"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return None,
        Err(error) => return Some(Err(format!("git 실행 실패: {error}"))),
    };

    if let Some(mut stdin) = child.stdin.take() {
        if let Err(error) = stdin.write_all(b"protocol=https\nhost=github.com\n\n") {
            return Some(Err(format!("git credential 입력 실패: {error}")));
        }
    }

    let output = match child.wait_with_output() {
        Ok(output) => output,
        Err(error) => return Some(Err(format!("git credential 실행 실패: {error}"))),
    };
    if !output.status.success() {
        return Some(Err(MISSING_CREDENTIAL.to_string()));
    }
    Some(Ok(String::from_utf8_lossy(&output.stdout).into_owned()))
}

fn resolve_token() -> Result<String, String> {
    let stdout = GIT_CANDIDATES
        .iter()
        .find_map(|git| run_credential_fill(git))
        .unwrap_or_else(|| Err("git 실행 파일을 찾지 못했습니다.".to_string()))?;

    stdout
        .lines()
        .find_map(|line| line.strip_prefix("password="))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| MISSING_CREDENTIAL.to_string())
}

fn build_client(token: &str) -> Result<Client, String> {
    let mut headers = HeaderMap::new();
    let auth = HeaderValue::from_str(&format!("Bearer {token}"))
        .map_err(|_| "GitHub 토큰 형식이 올바르지 않습니다.".to_string())?;
    headers.insert(AUTHORIZATION, auth);
    headers.insert(USER_AGENT, HeaderValue::from_static("opsdeck"));
    headers.insert(
        "X-GitHub-Api-Version",
        HeaderValue::from_static("2022-11-28"),
    );

    Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("HTTP 클라이언트를 만들지 못했습니다: {error}"))
}

/// URL 경로 조각 인코딩. `keep_slash`면 `/`는 구분자로 유지 (파일 경로·브랜치명).
pub fn encode_path(value: &str, keep_slash: bool) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        let keep = byte.is_ascii_alphanumeric()
            || matches!(byte, b'-' | b'_' | b'.' | b'~')
            || (keep_slash && byte == b'/');
        if keep {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

/// `owner/name`을 검증해 `/repos/{owner}/{name}` 경로로 만든다.
pub fn repo_path(full_name: &str) -> Result<String, String> {
    let valid = |part: &str| {
        !part.is_empty()
            && part
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    };
    match full_name.split_once('/') {
        Some((owner, name)) if valid(owner) && valid(name) => Ok(format!("/repos/{owner}/{name}")),
        _ => Err(format!("저장소 이름이 올바르지 않습니다: {full_name}")),
    }
}

/// `Link` 헤더의 `rel="last"` 페이지 번호. 마지막 페이지에서는 `last`가 없다.
fn parse_last_page(response: &Response) -> Option<u32> {
    let link = response.headers().get(LINK)?.to_str().ok()?;
    link.split(',').find_map(|part| {
        let (url, rel) = part.split_once(';')?;
        if !rel.contains("rel=\"last\"") {
            return None;
        }
        let url = url.trim().trim_start_matches('<').trim_end_matches('>');
        let query = url.split_once('?')?.1;
        query
            .split('&')
            .find_map(|pair| pair.strip_prefix("page=").and_then(|value| value.parse().ok()))
    })
}

async fn error_message(response: Response) -> String {
    let status = response.status();
    let detail = response
        .json::<ApiError>()
        .await
        .ok()
        .and_then(|error| error.message)
        .unwrap_or_default();

    match status {
        StatusCode::UNAUTHORIZED => {
            "로컬 git 인증이 만료되었습니다. 터미널에서 github.com에 다시 로그인해 주세요.".to_string()
        }
        StatusCode::FORBIDDEN | StatusCode::TOO_MANY_REQUESTS => format!(
            "GitHub API 접근이 거부되었습니다. 권한 부족 또는 호출 한도 초과일 수 있습니다. {detail}"
        ),
        StatusCode::NOT_FOUND => "대상을 찾을 수 없거나 접근 권한이 없습니다.".to_string(),
        StatusCode::UNPROCESSABLE_ENTITY => format!("GitHub가 요청을 처리하지 못했습니다: {detail}"),
        _ => format!("GitHub API 응답 오류 ({status}): {detail}"),
    }
}

#[derive(Clone)]
pub struct GitHubClient {
    client: Client,
}

impl GitHubClient {
    pub async fn connect() -> Result<Self, String> {
        let token = tauri::async_runtime::spawn_blocking(resolve_token)
            .await
            .map_err(|error| format!("git 인증 조회 작업 실패: {error}"))??;
        Ok(Self {
            client: build_client(&token)?,
        })
    }

    pub async fn request(
        &self,
        method: Method,
        path: &str,
        params: &[(&str, String)],
        body: Option<&Value>,
        accept: Option<&str>,
    ) -> Result<Response, String> {
        let url = Url::parse_with_params(&format!("{API_BASE}{path}"), params)
            .map_err(|error| format!("GitHub 요청 URL을 만들지 못했습니다: {error}"))?;
        let mut builder = self
            .client
            .request(method, url)
            .header(ACCEPT, accept.unwrap_or("application/vnd.github+json"));
        if let Some(body) = body {
            builder = builder.json(body);
        }
        let response = builder
            .send()
            .await
            .map_err(|error| format!("GitHub API 요청 실패: {error}"))?;

        if response.status().is_success() {
            Ok(response)
        } else {
            Err(error_message(response).await)
        }
    }

    pub async fn get_json<T: DeserializeOwned>(
        &self,
        path: &str,
        params: &[(&str, String)],
        accept: Option<&str>,
    ) -> Result<T, String> {
        let response = self.request(Method::GET, path, params, None, accept).await?;
        parse_json(response).await
    }

    /// 404면 `None`
    pub async fn get_text_optional(
        &self,
        path: &str,
        params: &[(&str, String)],
        accept: &str,
    ) -> Result<Option<String>, String> {
        let url = Url::parse_with_params(&format!("{API_BASE}{path}"), params)
            .map_err(|error| format!("GitHub 요청 URL을 만들지 못했습니다: {error}"))?;
        let response = self
            .client
            .get(url)
            .header(ACCEPT, accept)
            .send()
            .await
            .map_err(|error| format!("GitHub API 요청 실패: {error}"))?;
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(error_message(response).await);
        }
        response
            .text()
            .await
            .map(Some)
            .map_err(|error| format!("GitHub 응답을 읽지 못했습니다: {error}"))
    }

    pub async fn send_json<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: &Value,
        accept: Option<&str>,
    ) -> Result<T, String> {
        let response = self.request(method, path, &[], Some(body), accept).await?;
        parse_json(response).await
    }

    pub async fn send_empty(
        &self,
        method: Method,
        path: &str,
        body: Option<&Value>,
    ) -> Result<(), String> {
        self.request(method, path, &[], body, None).await.map(|_| ())
    }

    pub async fn get_page<A, T>(
        &self,
        path: &str,
        mut params: Vec<(&str, String)>,
        page: u32,
        per_page: u32,
        accept: Option<&str>,
    ) -> Result<GitHubPage<T>, String>
    where
        A: DeserializeOwned,
        T: From<A>,
    {
        let page = page.max(1);
        let per_page = per_page.clamp(1, MAX_PER_PAGE);
        params.push(("page", page.to_string()));
        params.push(("per_page", per_page.to_string()));

        let response = self.request(Method::GET, path, &params, None, accept).await?;
        let total_pages = parse_last_page(&response).unwrap_or(page).max(page);
        let items: Vec<A> = parse_json(response).await?;
        Ok(GitHubPage {
            items: items.into_iter().map(T::from).collect(),
            page,
            per_page,
            total_pages,
        })
    }
}

pub async fn parse_json<T: DeserializeOwned>(response: Response) -> Result<T, String> {
    response
        .json::<T>()
        .await
        .map_err(|error| format!("GitHub 응답을 해석하지 못했습니다: {error}"))
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubUser {
    pub login: String,
    pub avatar_url: String,
}

#[derive(Deserialize)]
pub struct ApiUser {
    pub login: String,
    pub avatar_url: String,
}

impl From<ApiUser> for GitHubUser {
    fn from(user: ApiUser) -> Self {
        Self {
            login: user.login,
            avatar_url: user.avatar_url,
        }
    }
}

pub fn user_or_ghost(user: Option<ApiUser>) -> GitHubUser {
    user.map(GitHubUser::from).unwrap_or_else(|| GitHubUser {
        login: "ghost".to_string(),
        avatar_url: String::new(),
    })
}
