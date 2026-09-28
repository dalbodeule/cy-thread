type MailEnv = {
  DB: D1Database;
  EMAIL?: {
    send(message: {
      to: string;
      from: string;
      subject: string;
      text: string;
      headers?: Record<string, string>;
    }): Promise<{ messageId: string }>;
  };
  MAIL_FROM_ADDRESS?: string;
};

type Campaign = {
  id: number;
  forum_id: number | null;
  audience: string;
  selected_ids_json: string | null;
  subject: string;
  body: string;
  cursor_user_id: number;
};
type Recipient = { id: number; email: string; mail_unsubscribe_token: string | null };
type PendingMail = {
  id: number;
  recipient_email: string;
  subject: string;
  body: string;
  kind: string;
  user_id: number | null;
  attempts: number;
};

async function expandCampaign(db: D1Database) {
  const campaign = await db
    .prepare(
      "SELECT * FROM mail_campaigns WHERE status IN ('queued', 'expanding') ORDER BY id LIMIT 1"
    )
    .first<Campaign>();
  if (!campaign) return;
  const selected =
    campaign.audience === 'selected'
      ? (JSON.parse(campaign.selected_ids_json || '[]') as number[])
      : [];
  const ids = selected.filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 500);
  const conditions = [
    'u.id > ?',
    'u.mail_notifications_enabled = 1',
    "coalesce(nullif(u.email, ''), case when u.contact_email_verified_at is not null then nullif(u.contact_email, '') end) is not null",
  ];
  const bindings: (string | number)[] = [campaign.cursor_user_id];
  if (campaign.audience === 'forum') {
    conditions.push(`(exists(select 1 from forum_followers ff where ff.forum_id = ? and ff.user_id = u.id)
      or exists(select 1 from forum_admins fa where fa.forum_id = ? and fa.user_id = u.id)
      or exists(select 1 from forums f where f.id = ? and f.owner_user_id = u.id)
      or exists(select 1 from threads t where t.forum_id = ? and t.author_user_id = u.id and t.is_deleted = 0)
      or exists(select 1 from posts p join threads t on t.id = p.thread_id where t.forum_id = ? and p.author_user_id = u.id and p.is_deleted = 0 and t.is_deleted = 0))`);
    bindings.push(...Array(5).fill(campaign.forum_id));
  } else if (campaign.audience === 'selected') {
    if (!ids.length) {
      await db
        .prepare("UPDATE mail_campaigns SET status = 'sending' WHERE id = ?")
        .bind(campaign.id)
        .run();
      return;
    }
    conditions.push(`u.id in (${ids.map(() => '?').join(',')})`);
    bindings.push(...ids);
  }
  const rows = await db
    .prepare(
      `SELECT u.id, coalesce(nullif(u.email, ''), case when u.contact_email_verified_at is not null then nullif(u.contact_email, '') end) AS email, u.mail_unsubscribe_token FROM users u WHERE ${conditions.join(' AND ')} ORDER BY u.id LIMIT 100`
    )
    .bind(...bindings)
    .all<Recipient>();
  const recipients = rows.results || [];
  if (!recipients.length) {
    await db
      .prepare("UPDATE mail_campaigns SET status = 'sending' WHERE id = ?")
      .bind(campaign.id)
      .run();
    return;
  }
  const statements = recipients.map((user) =>
    db
      .prepare(
        "INSERT OR IGNORE INTO mail_outbox (campaign_id, user_id, recipient_email, kind, subject, body) VALUES (?, ?, ?, 'campaign', ?, ?)"
      )
      .bind(campaign.id, user.id, user.email, campaign.subject, campaign.body)
  );
  const lastId = recipients.at(-1)!.id;
  statements.push(
    db
      .prepare(
        "UPDATE mail_campaigns SET status = 'expanding', cursor_user_id = ?, queued_count = (SELECT count(*) FROM mail_outbox WHERE campaign_id = ?) WHERE id = ?"
      )
      .bind(lastId, campaign.id, campaign.id)
  );
  await db.batch(statements);
  if (recipients.length < 100)
    await db
      .prepare("UPDATE mail_campaigns SET status = 'sending' WHERE id = ?")
      .bind(campaign.id)
      .run();
}

async function sendPending(env: MailEnv) {
  if (!env.EMAIL) return;
  const from = env.MAIL_FROM_ADDRESS || 'webmaster@mori.space';
  const now = Date.now();
  await env.DB.prepare(
    "UPDATE mail_outbox SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'queued' END, next_attempt_at = ? WHERE status = 'sending' AND claimed_at < ?"
  )
    .bind(now, now - 10 * 60_000)
    .run();
  const rows = await env.DB.prepare(
    "SELECT id, recipient_email, subject, body, kind, user_id, attempts FROM mail_outbox WHERE status = 'queued' AND next_attempt_at <= ? ORDER BY id LIMIT 10"
  )
    .bind(Date.now())
    .all<PendingMail>();
  for (const item of rows.results || []) {
    const claimed = await env.DB.prepare(
      "UPDATE mail_outbox SET status = 'sending', claimed_at = ?, attempts = attempts + 1 WHERE id = ? AND status = 'queued'"
    )
      .bind(Date.now(), item.id)
      .run();
    if (!claimed.meta.changes) continue;
    try {
      let content = item.body;
      const headers: Record<string, string> = {};
      if (item.kind === 'campaign' && item.user_id) {
        await env.DB.prepare(
          'UPDATE users SET mail_unsubscribe_token = lower(hex(randomblob(24))) WHERE id = ? AND mail_unsubscribe_token IS NULL'
        )
          .bind(item.user_id)
          .run();
        const user = await env.DB.prepare(
          'SELECT mail_notifications_enabled, mail_unsubscribe_token FROM users WHERE id = ?'
        )
          .bind(item.user_id)
          .first<{ mail_notifications_enabled: number; mail_unsubscribe_token: string | null }>();
        if (!user?.mail_notifications_enabled) {
          await env.DB.prepare(
            "UPDATE mail_outbox SET status = 'skipped', last_error = 'unsubscribed' WHERE id = ?"
          )
            .bind(item.id)
            .run();
          continue;
        }
        if (user.mail_unsubscribe_token) {
          const url = `https://community.mori.space/mail/unsubscribe?token=${user.mail_unsubscribe_token}`;
          content += `\n\n이메일 수신 거부: ${url}`;
          headers['List-Unsubscribe'] = `<${url}>`;
          headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
        }
      }
      const response = await env.EMAIL.send({
        to: item.recipient_email,
        from,
        subject: item.subject,
        text: content,
        headers,
      });
      await env.DB.prepare(
        "UPDATE mail_outbox SET status = 'sent', sent_at = ?, message_id = ?, last_error = NULL WHERE id = ?"
      )
        .bind(Date.now(), response.messageId, item.id)
        .run();
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 300) : 'Unknown send error';
      const failed = item.attempts + 1 >= 5;
      const next = Date.now() + Math.min(60, 2 ** item.attempts) * 60_000;
      await env.DB.prepare(
        'UPDATE mail_outbox SET status = ?, next_attempt_at = ?, last_error = ? WHERE id = ?'
      )
        .bind(failed ? 'failed' : 'queued', next, detail, item.id)
        .run();
      console.error('Mail send failed', { id: item.id, error: detail });
    }
  }
  await env.DB.prepare(
    `UPDATE mail_campaigns SET status = CASE WHEN EXISTS (SELECT 1 FROM mail_outbox o WHERE o.campaign_id = mail_campaigns.id AND o.status = 'failed') THEN 'completed_with_errors' ELSE 'completed' END, finished_at = ? WHERE status = 'sending' AND NOT EXISTS (SELECT 1 FROM mail_outbox o WHERE o.campaign_id = mail_campaigns.id AND o.status IN ('queued', 'sending'))`
  )
    .bind(Date.now())
    .run();
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    if (controller.cron !== '* * * * *') return;
    const mailEnv = env as MailEnv;
    await expandCampaign(mailEnv.DB);
    await sendPending(mailEnv);
  });
});
