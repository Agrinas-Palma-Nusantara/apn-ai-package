function listKind(line: string | undefined): "ordered" | "unordered" | null {
  if (!line) return null;
  if (/^\s*\d+[.)]\s+/.test(line)) return "ordered";
  if (/^\s*[-•]\s+/.test(line)) return "unordered";
  return null;
}

export function normalizeListSpacing(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return lines
    .filter((line, index) => {
      if (line.trim()) return true;
      let previous = index - 1;
      let next = index + 1;
      while (previous >= 0 && !lines[previous]?.trim()) previous -= 1;
      while (next < lines.length && !lines[next]?.trim()) next += 1;
      const previousKind = listKind(lines[previous]);
      return previousKind === null || previousKind !== listKind(lines[next]);
    })
    .join("\n");
}

export function parseSourceNumbers(token: string): number[] {
  const body = token.match(/^\[sumber:\s*([\d,\s]+)\]$/i)?.[1];
  if (!body) return [];
  return [
    ...new Set(
      body
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}
