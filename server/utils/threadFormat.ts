export type ThreadFormat = 'discussion' | 'question' | 'poll' | 'announcement';

export function normalizeThreadFormat(value: unknown): ThreadFormat {
  return value === 'question' || value === 'poll' || value === 'announcement'
    ? value
    : 'discussion';
}

export function normalizePollOptions(value: unknown): string[] {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  return source
    .map((item) =>
      String(item ?? '')
        .trim()
        .slice(0, 120)
    )
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 8);
}

export function parsePollOptions(value: string | null | undefined): string[] {
  try {
    return normalizePollOptions(JSON.parse(value || '[]'));
  } catch {
    return [];
  }
}
