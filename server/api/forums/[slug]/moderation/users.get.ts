import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import {
  forumAdmins,
  forumBans,
  forumFollowers,
  forums,
  posts,
  threads,
  users,
} from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);

  const query = String(getQuery(event).q ?? '')
    .trim()
    .slice(0, 80);
  const limit = Math.min(100, Math.max(1, Number(getQuery(event).limit) || 50));
  const offset = Math.max(0, Number(getQuery(event).offset) || 0);
  const participation = or(
    eq(users.id, forum.ownerUserId),
    sql`exists (select 1 from ${forumAdmins} where ${forumAdmins.forumId} = ${forum.id} and ${forumAdmins.userId} = ${users.id})`,
    sql`exists (select 1 from ${forumFollowers} where ${forumFollowers.forumId} = ${forum.id} and ${forumFollowers.userId} = ${users.id})`,
    sql`exists (select 1 from ${forumBans} where ${forumBans.forumId} = ${forum.id} and ${forumBans.userId} = ${users.id})`,
    sql`exists (select 1 from ${threads} where ${threads.forumId} = ${forum.id} and ${threads.authorUserId} = ${users.id} and ${threads.isDeleted} = 0)`,
    sql`exists (select 1 from ${posts} inner join ${threads} on ${posts.threadId} = ${threads.id} where ${threads.forumId} = ${forum.id} and ${posts.authorUserId} = ${users.id} and ${posts.isDeleted} = 0 and ${threads.isDeleted} = 0)`
  )!;
  const filters = [participation];
  if (query) filters.push(or(like(users.name, `%${query}%`), like(users.email, `%${query}%`))!);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      isOwner: sql<boolean>`${users.id} = ${forum.ownerUserId}`,
      isAdmin: sql<boolean>`exists (select 1 from ${forumAdmins} where ${forumAdmins.forumId} = ${forum.id} and ${forumAdmins.userId} = ${users.id} and ${forumAdmins.role} in ('owner', 'admin'))`,
      isModerator: sql<boolean>`exists (select 1 from ${forumAdmins} where ${forumAdmins.forumId} = ${forum.id} and ${forumAdmins.userId} = ${users.id} and ${forumAdmins.role} in ('owner', 'admin', 'mod'))`,
      isBanned: sql<boolean>`exists (select 1 from ${forumBans} where ${forumBans.forumId} = ${forum.id} and ${forumBans.userId} = ${users.id})`,
    })
    .from(users)
    .where(and(...filters))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => ({
    ...row,
    isOwner: Boolean(row.isOwner),
    isAdmin: Boolean(row.isAdmin),
    isModerator: Boolean(row.isModerator),
    isBanned: Boolean(row.isBanned),
  }));
});
