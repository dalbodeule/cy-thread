import { asc, eq } from 'drizzle-orm';
import { forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { readForumAppearance } from '~~/server/utils/forumAppearance';
import { setResponseHeader } from 'h3';

export default defineEventHandler(async (event) => {
  setResponseHeader(
    event,
    'Cache-Control',
    'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
  );
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const rows = await db
    .select({
      id: forums.id,
      slug: forums.slug,
      name: forums.name,
      settingsJson: forums.settingsJson,
      cssCustom: forums.cssCustom,
    })
    .from(forums)
    .where(eq(forums.visibility, 'public'))
    .orderBy(asc(forums.name))
    .limit(100);
  return rows.map(({ settingsJson, cssCustom, ...forum }) => ({
    ...forum,
    ...readForumAppearance(settingsJson, cssCustom),
  }));
});
