import { and, desc, eq } from 'drizzle-orm';
import { forumMembers, forums, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = slug ? await db.query.forums.findFirst({ where: eq(forums.slug, slug) }) : null;
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  const actor = await requireForumModerator(event, forum.id);
  if (!['global', 'owner', 'admin'].includes(actor.role))
    throw createError({ statusCode: 403, statusMessage: 'Forum admin access is required' });
  const rows = await db
    .select({
      userId: forumMembers.userId,
      name: users.name,
      status: forumMembers.status,
      answersJson: forumMembers.answersJson,
      createdAt: forumMembers.createdAt,
    })
    .from(forumMembers)
    .innerJoin(users, eq(users.id, forumMembers.userId))
    .where(and(eq(forumMembers.forumId, forum.id), eq(forumMembers.status, 'pending')))
    .orderBy(desc(forumMembers.createdAt));
  return rows.map((row) => ({
    ...row,
    answers: row.answersJson ? JSON.parse(row.answersJson) : [],
  }));
});
