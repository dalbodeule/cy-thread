import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { categories, forums, posts, threads, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  setResponseHeader(
    event,
    'Cache-Control',
    'public, max-age=15, s-maxage=30, stale-while-revalidate=120'
  );
  const query = String(getQuery(event).q ?? '')
    .trim()
    .slice(0, 100);
  if ([...query].length < 2) return [];
  const forum = String(getQuery(event).forum ?? '')
    .trim()
    .slice(0, 80);
  const category = String(getQuery(event).category ?? '')
    .trim()
    .slice(0, 80);
  const from = String(getQuery(event).from ?? '').trim();
  const sort = String(getQuery(event).sort ?? 'relevance');
  const limit = Math.min(50, Math.max(1, Number(getQuery(event).limit) || 30));
  const offset = Math.max(0, Number(getQuery(event).offset) || 0);
  const ftsPhrase = `"${query.replaceAll('"', '""')}"`;
  const filters = [
    eq(forums.visibility, 'public'),
    eq(threads.isDeleted, false),
    eq(posts.isDeleted, false),
    sql`posts_fts match ${ftsPhrase}`,
    sql`posts_fts.rowid = ${posts.id}`,
  ];
  if (forum) filters.push(eq(forums.slug, forum));
  if (category) filters.push(eq(categories.slug, category));
  if (/^\d{4}-\d{2}-\d{2}$/.test(from))
    filters.push(gte(threads.createdAt, new Date(`${from}T00:00:00Z`)));
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const matches = db
    .select({
      threadId: threads.id,
      title: threads.title,
      excerpt: sql<string>`substr(${posts.markdown}, 1, 240)`,
      createdAt: threads.createdAt,
      lastPostAt: threads.lastPostAt,
      forumSlug: forums.slug,
      forumName: forums.name,
      category: categories.name,
      categorySlug: categories.slug,
      author: users.name,
      rank: sql<number>`posts_fts.rank`,
      threadMatch: sql<number>`row_number() over (
        partition by ${threads.id}
        order by posts_fts.rank
      )`,
    })
    .from(posts)
    .innerJoin(threads, eq(posts.threadId, threads.id))
    .innerJoin(forums, eq(threads.forumId, forums.id))
    .innerJoin(categories, eq(threads.categoryId, categories.id))
    .innerJoin(users, eq(threads.authorUserId, users.id))
    .where(and(...filters))
    .as('matches');
  const results = await db
    .select({
      threadId: matches.threadId,
      title: matches.title,
      excerpt: matches.excerpt,
      createdAt: matches.createdAt,
      lastPostAt: matches.lastPostAt,
      forumSlug: matches.forumSlug,
      forumName: matches.forumName,
      category: matches.category,
      categorySlug: matches.categorySlug,
      author: matches.author,
    })
    .from(matches)
    .where(eq(matches.threadMatch, 1))
    .orderBy(sort === 'latest' ? desc(matches.createdAt) : asc(matches.rank))
    .limit(limit)
    .offset(offset);
  return results;
});
