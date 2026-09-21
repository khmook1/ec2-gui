use ssh2::Session;

use super::common::{
    parse_df_output, parse_large_directories, sort_filesystems, DiskFilesystem, LargeDirectory,
};
use super::super::remote_fs::exec_remote_command;

/// GNU `df -B1` 기반 파일시스템 목록.
pub fn list_filesystems(session: &Session) -> Result<Vec<DiskFilesystem>, String> {
    let output = exec_remote_command(session, "df -B1 -P -l 2>/dev/null")?;
    let mut filesystems = parse_df_output(&output, 1);
    sort_filesystems(&mut filesystems);
    Ok(filesystems)
}

/// 루트 1depth `du`. 가상 FS·권한 오류는 stderr로 버리고 상위 사용량만 수집.
/// `timeout`이 있으면 12초 상한으로 SSH 세션 점유를 제한한다.
pub fn list_large_directories(session: &Session) -> Result<Vec<LargeDirectory>, String> {
    let output = exec_remote_command(
        session,
        r#"
set +e
if command -v timeout >/dev/null 2>&1; then
  timeout 12 du -xd1 -B1 / 2>/dev/null
else
  du -xd1 -B1 / 2>/dev/null
fi | sort -nr | head -n 15
"#,
    )?;
    Ok(parse_large_directories(&output))
}
