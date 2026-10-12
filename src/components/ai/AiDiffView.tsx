function lineKind(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "header";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "remove";
  return "context";
}

export function AiDiffView({ diff }: { diff: string }) {
  const lines = diff.replace(/\n$/, "").split("\n");
  return (
    <pre className="ai-diff" aria-label="변경 내용">
      {lines.map((line, index) => (
        <span key={index} className={`ai-diff__line ai-diff__line--${lineKind(line)}`}>
          {line || " "}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}
