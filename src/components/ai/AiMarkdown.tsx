import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import {
  isHighlightLanguageSupported,
  PrismSyntaxHighlighter,
} from "@/lib/codeBlockLanguages";
import "./css/ai-markdown.css";

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

function resolveLanguage(className: string | undefined): string | null {
  const raw = /language-([\w-]+)/.exec(className ?? "")?.[1]?.toLowerCase();
  if (!raw) return null;
  const language = LANGUAGE_ALIASES[raw] ?? raw;
  return isHighlightLanguageSupported(language) ? language : null;
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
      return <code className="ai-markdown__inline-code">{children}</code>;
    }

    const language = resolveLanguage(className);
    const source = code.replace(/\n$/, "");

    if (!language) {
      return (
        <pre className="ai-markdown__pre">
          <code>{source}</code>
        </pre>
      );
    }

    return (
      <PrismSyntaxHighlighter
        language={language}
        style={oneLight}
        className="ai-markdown__pre"
        customStyle={{ margin: 0, background: "transparent" }}
        wrapLongLines
      >
        {source}
      </PrismSyntaxHighlighter>
    );
  },
};

interface AiMarkdownProps {
  content: string;
  typing?: boolean;
}

export const AiMarkdown = memo(function AiMarkdown({ content, typing }: AiMarkdownProps) {
  return (
    <div className={["ai-markdown", typing ? "ai-markdown--typing" : ""].filter(Boolean).join(" ")}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
});
