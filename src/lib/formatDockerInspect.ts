/** inspect 출력을 읽기 쉽게 포맷합니다. JSON이 아니면 원문을 반환합니다. */
export function formatDockerInspectJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "(inspect 결과 없음)";
  }

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
}
