export interface TextHighlightSegment {
  text: string;
  highlight: boolean;
}

export function normalizeListSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesListSearch(text: string, query: string): boolean {
  const normalized = normalizeListSearchQuery(query);
  if (!normalized) {
    return true;
  }
  return text.toLowerCase().includes(normalized);
}

export function matchesAnyListSearch(values: string[], query: string): boolean {
  const normalized = normalizeListSearchQuery(query);
  if (!normalized) {
    return true;
  }
  return values.some((value) => value.toLowerCase().includes(normalized));
}

export function getHighlightSegments(
  text: string,
  query: string,
): TextHighlightSegment[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [{ text, highlight: false }];
  }

  const lowerQuery = trimmed.toLowerCase();
  const segments: TextHighlightSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const slice = text.slice(cursor);
    const matchIndex = slice.toLowerCase().indexOf(lowerQuery);

    if (matchIndex === -1) {
      segments.push({ text: slice, highlight: false });
      break;
    }

    if (matchIndex > 0) {
      segments.push({ text: slice.slice(0, matchIndex), highlight: false });
    }

    segments.push({
      text: slice.slice(matchIndex, matchIndex + trimmed.length),
      highlight: true,
    });

    cursor += matchIndex + trimmed.length;
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}
