import { useMemo } from "react";
import {
  isHighlightLanguageSupported,
  PrismSyntaxHighlighter,
} from "@/lib/codeBlockLanguages";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { getHighlightLanguage } from "@/utils/highlightLanguage";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";

interface CodeBlockProps {
  code: string;
  filename: string;
  className?: string;
}

export function CodeBlock({ code, filename, className }: CodeBlockProps) {
  const resolvedTheme = useResolvedTheme();
  const language = useMemo(() => getHighlightLanguage(filename), [filename]);
  const style = resolvedTheme === "dark" ? oneDark : oneLight;
  const classes = ["code-block", className].filter(Boolean).join(" ");

  if (!language || !isHighlightLanguageSupported(language)) {
    return (
      <pre className={["file-dialog__content", className].filter(Boolean).join(" ")}>
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
          fontSize: "12.5px",
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
