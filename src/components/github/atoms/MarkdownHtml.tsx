import DOMPurify from "dompurify";
import { useMemo, type MouseEvent } from "react";
import { openExternalUrl } from "@/services/tauri";

interface MarkdownHtmlProps {
  /** GitHub가 렌더링한 HTML (README, body_html) */
  html: string | null | undefined;
  emptyText?: string;
  className?: string;
}

/** GitHub 렌더링 HTML을 정제해 보여 주고, 링크는 기본 브라우저로 연다. */
export function MarkdownHtml({
  html,
  emptyText = "내용이 없습니다.",
  className,
}: MarkdownHtmlProps) {
  const sanitized = useMemo(
    () =>
      html
        ? DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ["style", "form", "input", "button"],
          })
        : "",
    [html],
  );

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) {
      return;
    }
    event.preventDefault();
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("#")) {
      const target = event.currentTarget.querySelector(
        `[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"], [id="user-content-${CSS.escape(decodeURIComponent(href.slice(1)))}"]`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (/^https?:\/\//.test(anchor.href)) {
      void openExternalUrl(anchor.href);
    }
  }

  if (!sanitized.trim()) {
    return <p className="github-markdown__empty">{emptyText}</p>;
  }

  return (
    <div
      className={["github-markdown", className].filter(Boolean).join(" ")}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
