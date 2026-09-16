import { getHighlightSegments } from "@/utils/listSearch";

interface SearchHighlightProps {
  text: string;
  query: string;
}

export function SearchHighlight({ text, query }: SearchHighlightProps) {
  const segments = getHighlightSegments(text, query);

  return (
    <>
      {segments.map((segment, index) =>
        segment.highlight ? (
          <mark key={index} className="search-highlight">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
