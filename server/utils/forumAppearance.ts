export type ForumAppearance = {
  description: string;
  iconText: string;
  iconBackground: string;
  iconColor: string;
  cssCustom: string;
  allowDarkMode: boolean;
};

const defaultAppearance: ForumAppearance = {
  description: '',
  iconText: 'F',
  iconBackground: '#31664d',
  iconColor: '#ffffff',
  cssCustom: '',
  allowDarkMode: true,
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
  return { description, iconText, iconBackground, iconColor, cssCustom: safeCss, allowDarkMode };
}

export function updateForumSettingsJson(
  existing: string | null,
  appearance: Pick<
    ForumAppearance,
    'description' | 'iconText' | 'iconBackground' | 'iconColor' | 'allowDarkMode'
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
