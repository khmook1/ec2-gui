use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{Datelike, Duration, Local, NaiveDate};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::AppHandle;

use crate::services::ai_cli::{self, AiProvider, AiStreamEvent, ReportPeriod};
use crate::services::github::{self, GitHubClient, GitHubCommitDetail, WeeklyCommit};
use crate::services::storage_service;

const REPORT_DAYS: i64 = 7;
const MAX_DETAIL_COMMITS: usize = 80;
const DETAIL_CONCURRENCY: usize = 8;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyReport {
    pub week_key: String,
    pub period_start: String,
    pub period_end: String,
    pub commit_count: usize,
    pub repos: Vec<String>,
    pub content: String,
    pub created_at: String,
    pub provider: AiProvider,
    /// 커밋 목록 저장 이전에 만든 리포트는 비어 있다.
    #[serde(default)]
    pub commits: Vec<WeeklyCommit>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentCommits {
    pub period_start: String,
    pub period_end: String,
    pub commits: Vec<WeeklyCommit>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyReportStatus {
    pub week_key: String,
    pub generated: bool,
}

/// ISO 주차 키 (`2026-W42`)
fn current_week_key(today: NaiveDate) -> String {
    let week = today.iso_week();
    format!("{}-W{:02}", week.year(), week.week())
}

/// 커밋 상세는 커밋마다 API를 한 번씩 호출하므로 개수와 동시 요청 수를 제한한다.
async fn fetch_commit_details(
    client: &GitHubClient,
    commits: &[WeeklyCommit],
    emit: &(dyn Fn(AiStreamEvent) + Sync),
) -> HashMap<String, GitHubCommitDetail> {
    let targets: Vec<&WeeklyCommit> = commits.iter().take(MAX_DETAIL_COMMITS).collect();
    let mut details = HashMap::new();
    for (index, chunk) in targets.chunks(DETAIL_CONCURRENCY).enumerate() {
        emit(AiStreamEvent::Status {
            text: format!(
                "코드 변경 내용 수집 중… ({}/{})",
                (index * DETAIL_CONCURRENCY + chunk.len()).min(targets.len()),
                targets.len()
            ),
        });
        let handles: Vec<_> = chunk
            .iter()
            .map(|commit| {
                let client = client.clone();
                let repo = commit.repo.clone();
                let sha = commit.sha.clone();
                tauri::async_runtime::spawn(async move {
                    let detail = github::fetch_commit_detail(&client, &repo, &sha).await;
                    (sha, detail)
                })
            })
            .collect();
        for handle in handles {
            if let Ok((sha, Ok(detail))) = handle.await {
                details.insert(sha, detail);
            }
        }
    }
    details
}

/// 오늘을 포함한 최근 7일 (`YYYY-MM-DD`, 양 끝 포함)
fn report_period(today: NaiveDate) -> (String, String) {
    (
        (today - Duration::days(REPORT_DAYS - 1)).format("%Y-%m-%d").to_string(),
        today.format("%Y-%m-%d").to_string(),
    )
}

async fn fetch_recent_commits(
    client: &GitHubClient,
    today: NaiveDate,
) -> Result<RecentCommits, String> {
    let (period_start, period_end) = report_period(today);
    let login = github::get_viewer_login(client).await?;
    let commits = github::search_my_commits(client, &login, &period_start, &period_end).await?;
    Ok(RecentCommits {
        period_start,
        period_end,
        commits,
    })
}

#[tauri::command]
pub async fn list_recent_commits() -> Result<RecentCommits, String> {
    let client = GitHubClient::connect().await?;
    fetch_recent_commits(&client, Local::now().date_naive()).await
}

fn reports_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let paths = storage_service::resolve_and_ensure(app)?;
    let dir = PathBuf::from(paths.app_data).join("weekly-reports");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("리포트 폴더를 만들지 못했습니다: {error}"))?;
    Ok(dir)
}

fn report_file(dir: &Path, week_key: &str) -> PathBuf {
    dir.join(format!("{week_key}.json"))
}

#[tauri::command]
pub fn get_weekly_report_status(app: AppHandle) -> Result<WeeklyReportStatus, String> {
    let week_key = current_week_key(Local::now().date_naive());
    let dir = reports_dir(&app)?;
    Ok(WeeklyReportStatus {
        generated: report_file(&dir, &week_key).is_file(),
        week_key,
    })
}

#[tauri::command]
pub fn list_weekly_reports(app: AppHandle) -> Result<Vec<WeeklyReport>, String> {
    let dir = reports_dir(&app)?;
    let entries =
        fs::read_dir(&dir).map_err(|error| format!("리포트 목록을 읽지 못했습니다: {error}"))?;
    let mut reports: Vec<WeeklyReport> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .filter_map(|path| fs::read_to_string(path).ok())
        .filter_map(|raw| serde_json::from_str(&raw).ok())
        .collect();
    reports.sort_by(|a, b| b.week_key.cmp(&a.week_key));
    Ok(reports)
}

#[tauri::command]
pub async fn generate_weekly_report(
    app: AppHandle,
    provider: AiProvider,
    binary_path: Option<String>,
    on_event: Channel<AiStreamEvent>,
) -> Result<WeeklyReport, String> {
    let emit = move |event: AiStreamEvent| {
        let _ = on_event.send(event);
    };
    let today = Local::now().date_naive();
    let week_key = current_week_key(today);
    let dir = reports_dir(&app)?;
    let file = report_file(&dir, &week_key);

    emit(AiStreamEvent::Status {
        text: "커밋 수집 중…".to_string(),
    });
    let client = GitHubClient::connect().await?;
    let RecentCommits {
        period_start,
        period_end,
        commits,
    } = fetch_recent_commits(&client, today).await?;
    if commits.is_empty() {
        return Err("최근 7일간 작성한 커밋이 없어 리포트를 만들 수 없습니다.".to_string());
    }
    let details = fetch_commit_details(&client, &commits, &emit).await;

    let paths = storage_service::resolve_and_ensure(&app)?;
    let workdir = PathBuf::from(paths.cache).join("ai-workspace");
    let (start, end) = (period_start.clone(), period_end.clone());
    let commits_for_ai = commits.clone();
    let content = tauri::async_runtime::spawn_blocking(move || {
        let period = ReportPeriod {
            start: &start,
            end: &end,
        };
        ai_cli::generate_weekly_report(
            provider,
            binary_path.as_deref(),
            &workdir,
            &period,
            &commits_for_ai,
            &details,
            &emit,
        )
    })
    .await
    .map_err(|error| format!("리포트 생성 작업 실패: {error}"))??;

    let repos: BTreeSet<String> = commits.iter().map(|commit| commit.repo.clone()).collect();
    let report = WeeklyReport {
        week_key,
        period_start,
        period_end,
        commit_count: commits.len(),
        repos: repos.into_iter().collect(),
        content,
        created_at: Local::now().to_rfc3339(),
        provider,
        commits,
    };
    let raw = serde_json::to_string_pretty(&report)
        .map_err(|error| format!("리포트를 직렬화하지 못했습니다: {error}"))?;
    fs::write(&file, raw).map_err(|error| format!("리포트를 저장하지 못했습니다: {error}"))?;
    Ok(report)
}
