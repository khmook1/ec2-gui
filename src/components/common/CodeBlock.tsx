import { useMemo, type ChangeEvent } from "react";
import {
  isHighlightLanguageSupported,
  PrismSyntaxHighlighter,
} from "@/lib/codeBlockLanguages";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { getHighlightLanguage } from "@/utils/highlightLanguage";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import "./css/code-block.css";

interface CodeBlockProps {
  code: string;
  filename: string;
  className?: string;
  /** true면 하이라이트 대신 편집 가능한 에디터로 표시 */
  editable?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  onChange?: (value: string) => void;
}

export function CodeBlock({
  code,
  filename,
  className,
  editable = false,
  disabled = false,
  "aria-label": ariaLabel,
  onChange,
}: CodeBlockProps) {
  const resolvedTheme = useResolvedTheme();
  const language = useMemo(() => getHighlightLanguage(filename), [filename]);
  const style = resolvedTheme === "dark" ? oneDark : oneLight;
  const classes = [
    "code-block",
    editable ? "code-block--editable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange?.(event.target.value);
  }

  if (editable) {
    return (
      <div className={classes} data-language={language ?? undefined}>
        <textarea
          className="code-block__editor"
          value={code}
          disabled={disabled}
          spellCheck={false}
          aria-label={ariaLabel ?? "코드 편집"}
          onChange={handleChange}
        />
      </div>
    );
  }

  if (!language || !isHighlightLanguageSupported(language)) {
    return (
      <pre
        className={["file-dialog__content", className].filter(Boolean).join(" ")}
      >
        {code || " "}
      </pre>
    );
  }

  return (
    <div className={classes} data-language={language}>
      <PrismSyntaxHighlighter
        language={language}
        style={style}
        customStyle={{
          margin: 0,
          padding: "16px 18px 20px",
          background: "transparent",
          fontSize: "0.78125rem",
          lineHeight: 1.55,
        }}
        codeTagProps={{
          className: "code-block__code",
        }}
        PreTag="div"
        wrapLongLines
      >
        {code || " "}
      </PrismSyntaxHighlighter>
    </div>
  );
}
