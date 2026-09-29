export type ForumAppearance = {
  description: string;
  iconText: string;
  iconBackground: string;
  iconColor: string;
  cssCustom: string;
  allowDarkMode: boolean;
  rules: string;
  welcomeMessage: string;
  commentAccess: 'guest' | 'members' | 'forum_members';
  membershipQuestions: string[];
  moderationKeywords: string[];
  resourceLinks: Array<{ title: string; url: string }>;
};

const defaultAppearance: ForumAppearance = {
  description: '',
  iconText: 'F',
  iconBackground: '#31664d',
  iconColor: '#ffffff',
  cssCustom: '',
  allowDarkMode: true,
  rules: '',
  welcomeMessage: '',
  commentAccess: 'members',
  membershipQuestions: [],
  moderationKeywords: [],
  resourceLinks: [],
};
const color = /^#[0-9a-fA-F]{6}$/;
const allowedVariables = new Set([
  '--forum-accent',
  '--forum-canvas',
  '--forum-surface',
  '--forum-text',
  '--forum-muted',
  '--forum-border',
]);

export function normalizeForumCss(value: string): string {
  if (value.length > 1200) throw new Error('CSS is too long');
  const declarations = value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const result: string[] = [];
  for (const declaration of declarations) {
    const match = /^(--forum-[a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})$/.exec(declaration);
    if (!match || !allowedVariables.has(match[1]!)) {
      throw new Error('Only supported Forum color variables with six-digit hex values are allowed');
    }
    result.push(`${match[1]}: ${match[2]!.toLowerCase()};`);
  }
  return result.join('\n');
}

export function readForumAppearance(
  settingsJson: string | null,
  cssCustom: string | null
): ForumAppearance {
  let settings: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(settingsJson || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      settings = parsed as Record<string, unknown>;
  } catch {
    /* Existing settings can be empty or malformed. */
  }
  const description = typeof settings.description === 'string' ? settings.description : '';
  const iconText =
    typeof settings.iconText === 'string' && settings.iconText.length <= 4
      ? settings.iconText
      : defaultAppearance.iconText;
  const iconBackground =
    typeof settings.iconBackground === 'string' && color.test(settings.iconBackground)
      ? settings.iconBackground
      : defaultAppearance.iconBackground;
  const iconColor =
    typeof settings.iconColor === 'string' && color.test(settings.iconColor)
      ? settings.iconColor
      : defaultAppearance.iconColor;
  let safeCss = '';
  try {
    safeCss = normalizeForumCss(cssCustom || '');
  } catch {
    /* Ignore invalid legacy CSS. */
  }
  const allowDarkMode = typeof settings.allowDarkMode === 'boolean' ? settings.allowDarkMode : true;
  const rules = typeof settings.rules === 'string' ? settings.rules.slice(0, 5000) : '';
  const welcomeMessage =
    typeof settings.welcomeMessage === 'string' ? settings.welcomeMessage.slice(0, 1000) : '';
  const commentAccess =
    settings.commentAccess === 'guest' ||
    settings.commentAccess === 'members' ||
    settings.commentAccess === 'forum_members'
      ? settings.commentAccess
      : defaultAppearance.commentAccess;
  const membershipQuestions = Array.isArray(settings.membershipQuestions)
    ? settings.membershipQuestions
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, 240))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const moderationKeywords = Array.isArray(settings.moderationKeywords)
    ? settings.moderationKeywords
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase().slice(0, 80))
        .filter(Boolean)
        .slice(0, 50)
    : [];
  const resourceLinks = Array.isArray(settings.resourceLinks)
    ? settings.resourceLinks
        .filter((item): item is { title?: unknown; url?: unknown } =>
          Boolean(item && typeof item === 'object')
        )
        .map((item) => ({
          title: String(item.title || '')
            .trim()
            .slice(0, 80),
          url: String(item.url || '')
            .trim()
            .slice(0, 500),
        }))
        .filter((item) => item.title && /^https?:\/\//i.test(item.url))
        .slice(0, 10)
    : [];
  return {
    description,
    iconText,
    iconBackground,
    iconColor,
    cssCustom: safeCss,
    allowDarkMode,
    rules,
    welcomeMessage,
    commentAccess,
    membershipQuestions,
    moderationKeywords,
    resourceLinks,
  };
}

export function updateForumSettingsJson(
  existing: string | null,
  appearance: Pick<
    ForumAppearance,
    | 'description'
    | 'iconText'
    | 'iconBackground'
    | 'iconColor'
    | 'allowDarkMode'
    | 'rules'
    | 'welcomeMessage'
    | 'commentAccess'
    | 'membershipQuestions'
    | 'moderationKeywords'
    | 'resourceLinks'
  >
) {
  let settings: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(existing || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      settings = parsed as Record<string, unknown>;
  } catch {
    /* Replace malformed settings. */
  }
  return JSON.stringify({ ...settings, ...appearance });
}

export function findModerationKeyword(text: string, keywords: string[]): string | null {
  const normalized = text.toLocaleLowerCase();
  return keywords.find((keyword) => keyword && normalized.includes(keyword)) || null;
}
