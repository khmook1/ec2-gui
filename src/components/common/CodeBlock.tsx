import { useMemo, type ChangeEvent, type CSSProperties } from "react";
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
  /** true면 하이라이트된 코드 위에 편집 가능한 에디터를 겹쳐 표시 */
  editable?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  onChange?: (value: string) => void;
}

// 편집 모드에서는 textarea 와 하이라이트 레이어의 글자 위치가 정확히 일치해야 한다.
const editorTextStyle: CSSProperties = {
  fontSize: "0.78125rem",
  lineHeight: 1.55,
  tabSize: 4,
  whiteSpace: "pre",
};

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
  const highlightable =
    language != null && isHighlightLanguageSupported(language);
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
    // 마지막 줄바꿈 뒤의 빈 줄도 하이라이트 레이어 높이에 반영되어야 한다.
    const layerCode = `${code}\n`;
    return (
      <div className={classes} data-language={language ?? undefined}>
        <div className="code-block__stack">
          {highlightable ? (
            <PrismSyntaxHighlighter
              language={language}
              style={style}
              customStyle={{
                margin: 0,
                padding: "16px 18px 20px",
                background: "transparent",
                overflow: "visible",
                ...editorTextStyle,
              }}
              codeTagProps={{
                className: "code-block__code",
                style: editorTextStyle,
              }}
              PreTag="div"
              className="code-block__layer"
              aria-hidden
            >
              {layerCode}
            </PrismSyntaxHighlighter>
          ) : (
            <pre
              className="code-block__layer code-block__plain"
              style={editorTextStyle}
              aria-hidden
            >
              {layerCode}
            </pre>
          )}
          <textarea
            className="code-block__editor"
            style={editorTextStyle}
            value={code}
            disabled={disabled}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            aria-label={ariaLabel ?? "코드 편집"}
            onChange={handleChange}
          />
        </div>
      </div>
    );
  }

  if (!highlightable) {
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
