import { memo, useEffect, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import "github-markdown-css/github-markdown-light.css";
import {
  isHighlightLanguageSupported,
  PrismSyntaxHighlighter,
} from "@/lib/codeBlockLanguages";
import "./css/ai-markdown.css";

const COPIED_FEEDBACK_MS = 1500;

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  py: "python",
  rb: "ruby",
  rs: "rust",
  yml: "yaml",
  dockerfile: "docker",
  html: "markup",
  xml: "markup",
  md: "markdown",
  tf: "hcl",
  kt: "kotlin",
  cs: "csharp",
};

function rawLanguage(className: string | undefined): string | null {
  return /language-([\w-]+)/.exec(className ?? "")?.[1]?.toLowerCase() ?? null;
}

function resolveLanguage(raw: string | null): string | null {
  if (!raw) return null;
  const language = LANGUAGE_ALIASES[raw] ?? raw;
  return isHighlightLanguageSupported(language) ? language : null;
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="ai-markdown__copy" onClick={() => void handleCopy()}>
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

const components: Components = {
  a({ href, title, children }) {
    return (
      <a href={href} title={title} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const code = String(children ?? "");
    const isBlock = /language-/.test(className ?? "") || code.includes("\n");

    if (!isBlock) {
      return <code>{children}</code>;
    }

    const raw = rawLanguage(className);
    const language = resolveLanguage(raw);
    const source = code.replace(/\n$/, "");

    return (
      <div className="ai-markdown__code">
        <div className="ai-markdown__code-header">
          <span className="ai-markdown__code-lang">{raw ?? "text"}</span>
          <CopyCodeButton code={source} />
        </div>
        {language ? (
          <PrismSyntaxHighlighter
            language={language}
            style={oneLight}
            className="ai-markdown__pre"
            customStyle={{ margin: 0, background: "transparent" }}
            wrapLongLines
          >
            {source}
          </PrismSyntaxHighlighter>
        ) : (
          <pre className="ai-markdown__pre">
            <code>{source}</code>
          </pre>
        )}
      </div>
    );
  },
};

interface AiMarkdownProps {
  content: string;
  typing?: boolean;
}

export const AiMarkdown = memo(function AiMarkdown({ content, typing }: AiMarkdownProps) {
  return (
    <div
      className={["markdown-body", "ai-markdown", typing ? "ai-markdown--typing" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
});
