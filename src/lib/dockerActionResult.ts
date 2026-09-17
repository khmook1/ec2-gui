const TOAST_OUTPUT_LIMIT = 4000;

export function truncateDockerOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length <= TOAST_OUTPUT_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, TOAST_OUTPUT_LIMIT)}\n…(출력이 잘렸습니다)`;
}

export function getDockerActionErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
