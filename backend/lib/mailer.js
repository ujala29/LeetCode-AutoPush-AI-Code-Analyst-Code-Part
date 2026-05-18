// backend/lib/mailer.js — sends daily motivation emails via Resend
// Resend free tier: 100 emails/day, 3000/month. Sign up at resend.com.

export async function sendDailyMotivation({ to, name, streak, weakTopics }) {
  // Read at call time (not module load time) so dotenv.config() has already run
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!RESEND_API_KEY) {
    console.warn('[mailer] RESEND_API_KEY not set — skipping email for', to);
    return;
  }

  const firstName = name.split(' ')[0];

  const topicItems = weakTopics.slice(0, 3).map(topic => {
    const slug = topic.toLowerCase().replace(/ /g, '-');
    return `<li><a href="https://leetcode.com/tag/${slug}/" style="color:#7c6af7;text-decoration:none;">${topic}</a></li>`;
  }).join('');

  const streakLine = streak > 0
    ? `<p>You're on a <strong style="color:#7c6af7;">${streak}-day streak</strong> — keep it going! 🔥</p>`
    : `<p>No active streak right now — today's a great day to start one! 💪</p>`;

  const weakSection = weakTopics.length > 0 ? `
    <div style="background:#1a1a24;border-left:3px solid #7c6af7;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:600;">Focus areas this week:</p>
      <ul style="margin:0;padding-left:20px;line-height:1.8;">${topicItems}</ul>
    </div>
    <p>Pick one problem from your weak areas and solve it today. Consistency beats intensity! 🧠</p>
  ` : `<p>You're well-rounded — keep challenging yourself with new problem types! 🌟</p>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0d0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:480px;margin:32px auto;background:#151520;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
        <div style="padding:24px;background:linear-gradient(135deg,#1e1a3a,#151520);border-bottom:2px solid;border-image:linear-gradient(90deg,#7c6af7,#4dc8a0) 1;">
          <h2 style="margin:0;color:#7c6af7;font-size:20px;">🔥 Daily LeetCode Challenge</h2>
        </div>
        <div style="padding:24px;color:#e8e8f0;line-height:1.6;">
          <p>Hey ${firstName}!</p>
          ${streakLine}
          ${weakSection}
          <p style="margin-top:24px;color:#7878a0;font-size:12px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
            — LeetCode AI Journal &nbsp;·&nbsp; You're receiving this because you signed in with Google.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: streak > 0
        ? `🔥 ${streak}-day streak! Keep it going, ${firstName}`
        : `💡 Daily LeetCode reminder, ${firstName} — solve one today`,
      html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}
