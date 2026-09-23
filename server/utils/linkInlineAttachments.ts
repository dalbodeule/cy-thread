import { and, eq, inArray, isNull } from 'drizzle-orm';
import { attachments } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default async function linkInlineAttachments(
  db: ReturnType<typeof useDrizzle>,
  markdown: string,
  { forumId, authorUserId, postId }: { forumId: number; authorUserId: number; postId: number }
) {
  const ids = [
    ...new Set(
      [...markdown.matchAll(/\/api\/forums\/[a-zA-Z0-9-]+\/attachments\/(\d+)/g)]
        .map((match) => Number(match[1]))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
  if (!ids.length) return;

  await db
    .update(attachments)
    .set({ postId })
    .where(
      and(
        inArray(attachments.id, ids),
        eq(attachments.forumId, forumId),
        eq(attachments.authorUserId, authorUserId),
        isNull(attachments.postId),
        isNull(attachments.deletedAt)
      )
    );
}
