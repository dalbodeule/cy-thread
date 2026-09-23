import { eq } from 'drizzle-orm';
import { categories, forumAdmins, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

const starterCategories = [
  { name: '소개와 공지', slug: 'announcements', sortOrder: 0 },
  { name: '질문과 답변', slug: 'questions', sortOrder: 1 },
  { name: '자유 이야기', slug: 'lounge', sortOrder: 2 },
];

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const ownerUserId = Number(session.user.id);
  if (!Number.isInteger(ownerUserId) || ownerUserId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }

  const body = await readBody<{ name?: unknown; slug?: unknown }>(event);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  if (name.length < 2 || name.length > 60 || /[\u0000-\u001f<>]/.test(name)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Community name must be 2 to 60 characters',
    });
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 50) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Use a 1 to 50 character lowercase URL slug with letters, numbers, and hyphens',
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const existing = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (existing)
    throw createError({
      statusCode: 409,
      statusMessage: 'That community address is already taken',
    });

  const [forum] = await db
    .insert(forums)
    .values({ slug, name, ownerUserId, visibility: 'public' })
    .returning({ id: forums.id, slug: forums.slug, name: forums.name });
  if (!forum) throw createError({ statusCode: 500, statusMessage: 'Unable to create community' });

  try {
    await db.insert(forumAdmins).values({ forumId: forum.id, userId: ownerUserId, role: 'owner' });
    await db
      .insert(categories)
      .values(starterCategories.map((category) => ({ ...category, forumId: forum.id })));
  } catch (error) {
    await db.delete(forums).where(eq(forums.id, forum.id));
    throw error;
  }

  setResponseStatus(event, 201);
  return forum;
});
