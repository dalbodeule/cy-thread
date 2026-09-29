export const MAX_THREAD_TAGS = 5;

export function normalizeThreadTags(value: unknown): string[] {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const tags: string[] = [];
  for (const item of source) {
    const tag = String(item ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!tag || tag.length > 24 || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length >= MAX_THREAD_TAGS) break;
  }
  return tags;
}

export function parseThreadTags(value: string | null | undefined): string[] {
  try {
    return normalizeThreadTags(JSON.parse(value || '[]'));
  } catch {
    return [];
  }
}
