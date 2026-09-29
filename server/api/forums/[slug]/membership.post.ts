import { eq } from 'drizzle-orm';
import { forumMembers, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import verifyHuman from '~~/server/utils/verifyHuman';
import { readForumAppearance } from '~~/server/utils/forumAppearance';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const slug = getRouterParam(event, 'slug');
  const body = await readBody<{ answers?: unknown; turnstileToken?: unknown }>(event);
  await verifyHuman(event, body?.turnstileToken);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = slug ? await db.query.forums.findFirst({ where: eq(forums.slug, slug) }) : null;
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  if (forum.visibility !== 'private')
    throw createError({
      statusCode: 400,
      statusMessage: 'This Forum does not require membership approval',
    });
  const questions = readForumAppearance(forum.settingsJson, forum.cssCustom).membershipQuestions;
  const answers = Array.isArray(body?.answers)
    ? body.answers.map((answer) => String(answer || '').trim())
    : [];
  if (
    answers.length !== questions.length ||
    answers.some((answer) => !answer || answer.length > 1000)
  )
    throw createError({ statusCode: 400, statusMessage: 'Answer every membership question' });
  await db
    .insert(forumMembers)
    .values({
      forumId: forum.id,
      userId,
      status: 'pending',
      answersJson: JSON.stringify(answers),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [forumMembers.forumId, forumMembers.userId],
      set: {
        status: 'pending',
        answersJson: JSON.stringify(answers),
        reviewedByUserId: null,
        reviewedAt: null,
        updatedAt: new Date(),
      },
    });
  return { status: 'pending' };
});
