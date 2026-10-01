use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use ssh2::{FileType, Session};

use super::remote_fs::{exec_remote_command, shell_quote, RemoteEntry};

const FILE_VERSION: u32 = 1;
const LEGACY_DIR_NAME: &str = ".ec2-gui";
const LEGACY_EXPLORER_FILE_NAME: &str = "explorer-favorites.json";
const LEGACY_DOCKER_FILE_NAME: &str = "docker-favorites.json";

/// 읽기-수정-쓰기 사이에 다른 토글이 끼어들어 항목이 유실되지 않도록 직렬화한다.
static FAVORITES_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServerFavorites {
    #[serde(default)]
    explorer: Vec<String>,
    #[serde(default)]
    docker: Vec<String>,
    /// 예전 버전이 서버(`~/.ec2-gui`)에 저장한 즐겨찾기를 가져왔는지 여부
    #[serde(default)]
    imported_remote: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct FavoritesStore {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    servers: BTreeMap<String, ServerFavorites>,
}

#[derive(Clone, Copy)]
enum FavoriteKind {
    Explorer,
    Docker,
}

impl ServerFavorites {
    fn list_mut(&mut self, kind: FavoriteKind) -> &mut Vec<String> {
        match kind {
            FavoriteKind::Explorer => &mut self.explorer,
            FavoriteKind::Docker => &mut self.docker,
        }
    }
}

/// 즐겨찾기가 속한 서버. 세션은 항목 조회(stat)와 예전 서버 저장분 가져오기(읽기 전용)에만 쓴다.
pub struct FavoritesTarget<'a> {
    pub file: &'a Path,
    pub server_key: &'a str,
    pub session: &'a Session,
    pub home: &'a str,
}

fn normalize_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.len() > 1 {
        trimmed.trim_end_matches('/').to_string()
    } else {
        trimmed.to_string()
    }
}

fn is_same_or_descendant(candidate: &str, target: &str) -> bool {
    candidate == target
        || (target == "/" && candidate.starts_with('/'))
        || candidate
            .strip_prefix(target)
            .is_some_and(|rest| rest.starts_with('/'))
}

fn merge_unique(target: &mut Vec<String>, items: impl IntoIterator<Item = String>) {
    for item in items.into_iter().map(|item| normalize_path(&item)) {
        if !item.is_empty() && !target.contains(&item) {
            target.push(item);
        }
    }
}

fn parse_legacy_paths(raw: &str) -> Vec<String> {
    #[derive(Deserialize)]
    struct LegacyFile {
        #[serde(default)]
        paths: Vec<String>,
    }

    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let paths = serde_json::from_str::<LegacyFile>(trimmed)
        .map(|file| file.paths)
        .or_else(|_| serde_json::from_str::<Vec<String>>(trimmed))
        .unwrap_or_default();

    let mut result = Vec::with_capacity(paths.len());
    merge_unique(&mut result, paths);
    result
}

fn read_legacy_paths(session: &Session, home: &str, file_name: &str) -> Result<Vec<String>, String> {
    let file = shell_quote(&format!(
        "{}/{LEGACY_DIR_NAME}/{file_name}",
        home.trim_end_matches('/')
    ));
    let raw = exec_remote_command(session, &format!("cat {file} 2>/dev/null; true"))?;
    Ok(parse_legacy_paths(&raw))
}

fn read_store(file: &Path) -> Result<FavoritesStore, String> {
    let raw = match fs::read_to_string(file) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(FavoritesStore::default());
        }
        Err(error) => return Err(format!("즐겨찾기 파일을 읽지 못했습니다: {error}")),
    };
    if raw.trim().is_empty() {
        return Ok(FavoritesStore::default());
    }
    serde_json::from_str(&raw).map_err(|error| {
        format!(
            "즐겨찾기 파일 형식이 올바르지 않습니다 ({}): {error}",
            file.to_string_lossy()
        )
    })
}

fn write_store(file: &Path, store: &mut FavoritesStore) -> Result<(), String> {
    store.version = FILE_VERSION;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("즐겨찾기 폴더 생성 실패: {error}"))?;
    }
    let body = serde_json::to_string_pretty(store)
        .map_err(|error| format!("즐겨찾기 직렬화 실패: {error}"))?;
    let tmp = file.with_extension("json.tmp");
    fs::write(&tmp, body).map_err(|error| format!("즐겨찾기 저장에 실패했습니다: {error}"))?;
    fs::rename(&tmp, file).map_err(|error| format!("즐겨찾기 저장에 실패했습니다: {error}"))
}

fn lock() -> Result<std::sync::MutexGuard<'static, ()>, String> {
    FAVORITES_LOCK
        .lock()
        .map_err(|_| "즐겨찾기 잠금에 실패했습니다.".to_string())
}

/// 서버 항목을 불러오고, 처음이면 예전 서버 저장분을 합친다. 서버 파일은 수정하지 않는다.
fn load_store(target: &FavoritesTarget) -> Result<FavoritesStore, String> {
    let mut store = read_store(target.file)?;
    let server = store.servers.entry(target.server_key.to_string()).or_default();
    if server.imported_remote {
        return Ok(store);
    }

    let legacy = read_legacy_paths(target.session, target.home, LEGACY_EXPLORER_FILE_NAME)
        .and_then(|explorer| {
            read_legacy_paths(target.session, target.home, LEGACY_DOCKER_FILE_NAME)
                .map(|docker| (explorer, docker))
        });
    if let Ok((explorer, docker)) = legacy {
        merge_unique(&mut server.explorer, explorer);
        merge_unique(&mut server.docker, docker);
        server.imported_remote = true;
        write_store(target.file, &mut store)?;
    }
    Ok(store)
}

fn read_list(target: &FavoritesTarget, kind: FavoriteKind) -> Result<Vec<String>, String> {
    let _guard = lock()?;
    let mut store = load_store(target)?;
    Ok(store
        .servers
        .get_mut(target.server_key)
        .map(|server| server.list_mut(kind).clone())
        .unwrap_or_default())
}

/// `favorite`에 맞춰 추가/제거한다. 목록이 바뀌었으면 true.
fn toggle(list: &mut Vec<String>, key: String, favorite: bool) -> bool {
    let exists = list.contains(&key);
    if favorite == exists {
        return false;
    }
    if favorite {
        list.push(key);
    } else {
        list.retain(|item| item != &key);
    }
    true
}

fn update_list(
    target: &FavoritesTarget,
    kind: FavoriteKind,
    key: &str,
    favorite: bool,
) -> Result<Vec<String>, String> {
    let key = normalize_path(key);
    if key.is_empty() {
        return Err("올바르지 않은 즐겨찾기 대상입니다.".to_string());
    }

    let _guard = lock()?;
    let mut store = load_store(target)?;
    let list = store
        .servers
        .entry(target.server_key.to_string())
        .or_default()
        .list_mut(kind);
    let changed = toggle(list, key, favorite);
    let result = list.clone();
    if changed {
        write_store(target.file, &mut store)?;
    }
    Ok(result)
}

/// 저장된 경로를 stat해 탐색기 항목으로 만든다. 지금 접근할 수 없는 경로는 목록에서만 빼고 파일에는 유지한다.
fn resolve_entries(session: &Session, paths: &[String]) -> Result<Vec<RemoteEntry>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    let sftp = session
        .sftp()
        .map_err(|error| format!("SFTP 채널을 열 수 없습니다: {error}"))?;

    Ok(paths
        .iter()
        .filter_map(|path| {
            let stat = sftp.stat(Path::new(path)).ok()?;
            let is_directory = stat.file_type() == FileType::Directory;
            let name = path
                .rsplit('/')
                .find(|segment| !segment.is_empty())
                .unwrap_or("/")
                .to_string();
            Some(RemoteEntry {
                name,
                path: path.clone(),
                is_directory,
                size: if is_directory { 0 } else { stat.size.unwrap_or(0) },
                modified_at: stat.mtime.map(|value| value as u64),
            })
        })
        .collect())
}

pub fn list_favorites(target: &FavoritesTarget) -> Result<Vec<RemoteEntry>, String> {
    let paths = read_list(target, FavoriteKind::Explorer)?;
    resolve_entries(target.session, &paths)
}

/// `favorite`에 맞춰 경로를 추가/제거하고 저장된 최종 목록을 반환한다.
pub fn set_favorite(
    target: &FavoritesTarget,
    path: &str,
    favorite: bool,
) -> Result<Vec<RemoteEntry>, String> {
    let paths = update_list(target, FavoriteKind::Explorer, path, favorite)?;
    resolve_entries(target.session, &paths)
}

/// 컨테이너는 재생성 시 ID가 바뀌므로 이름 기준으로 저장한다.
pub fn list_docker_favorites(target: &FavoritesTarget) -> Result<Vec<String>, String> {
    read_list(target, FavoriteKind::Docker)
}

pub fn set_docker_favorite(
    target: &FavoritesTarget,
    container_name: &str,
    favorite: bool,
) -> Result<Vec<String>, String> {
    update_list(target, FavoriteKind::Docker, container_name, favorite)
}

/// 삭제된 경로와 그 하위 경로를 즐겨찾기에서 제거한다.
pub fn remove_favorites_under(target: &FavoritesTarget, path: &str) -> Result<(), String> {
    let removed = normalize_path(path);
    if removed.is_empty() {
        return Ok(());
    }

    let _guard = lock()?;
    let mut store = load_store(target)?;
    let Some(server) = store.servers.get_mut(target.server_key) else {
        return Ok(());
    };
    let before = server.explorer.len();
    server
        .explorer
        .retain(|item| !is_same_or_descendant(item, &removed));
    if server.explorer.len() != before {
        write_store(target.file, &mut store)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_legacy_object_and_array_with_dedup() {
        assert_eq!(
            parse_legacy_paths(r#"{"version":1,"paths":["/a/","/b","/a"]}"#),
            vec!["/a".to_string(), "/b".to_string()]
        );
        assert_eq!(parse_legacy_paths(r#"["/x"]"#), vec!["/x".to_string()]);
        assert!(parse_legacy_paths("").is_empty());
        assert!(parse_legacy_paths("not-json").is_empty());
    }

    #[test]
    fn matches_descendants_only_on_segment_boundary() {
        assert!(is_same_or_descendant("/home/a", "/home/a"));
        assert!(is_same_or_descendant("/home/a/b.txt", "/home/a"));
        assert!(!is_same_or_descendant("/home/ab", "/home/a"));
    }

    #[test]
    fn toggles_without_duplicates() {
        let mut list = vec!["/a".to_string()];
        assert!(!toggle(&mut list, "/a".to_string(), true));
        assert!(toggle(&mut list, "/b".to_string(), true));
        assert!(toggle(&mut list, "/a".to_string(), false));
        assert_eq!(list, vec!["/b".to_string()]);
    }

    #[test]
    fn stores_favorites_per_server() {
        let dir = std::env::temp_dir().join(format!(
            "ec2-gui-favorites-test-{}",
            std::process::id()
        ));
        let file = dir.join("favorites.json");
        let _ = fs::remove_dir_all(&dir);

        let mut store = read_store(&file).expect("missing file reads as empty");
        store.servers.entry("a@h1:22".into()).or_default().explorer = vec!["/srv".into()];
        store.servers.entry("b@h2:22".into()).or_default().docker = vec!["web".into()];
        write_store(&file, &mut store).expect("write");

        let reloaded = read_store(&file).expect("reload");
        assert_eq!(reloaded.version, FILE_VERSION);
        assert_eq!(reloaded.servers["a@h1:22"].explorer, vec!["/srv".to_string()]);
        assert!(reloaded.servers["a@h1:22"].docker.is_empty());
        assert_eq!(reloaded.servers["b@h2:22"].docker, vec!["web".to_string()]);
        assert!(!reloaded.servers["b@h2:22"].imported_remote);

        let _ = fs::remove_dir_all(&dir);
    }
}
