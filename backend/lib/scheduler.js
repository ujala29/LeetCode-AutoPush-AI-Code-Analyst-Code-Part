// backend/lib/scheduler.js — daily motivation email cron
// Runs at 9:00 AM IST (03:30 UTC) every day

import cron from 'node-cron';
import { readUsers } from './userStore.js';
import { sendDailyMotivation } from './mailer.js';

export function startScheduler() {
  // TEST: 1:20 AM local time. Change to '30 3 * * *' for production (9:00 AM IST)
  cron.schedule('46 1 * * *', async () => {
    const users = readUsers();
    const emails = Object.entries(users);
    console.log(`[scheduler] Sending daily motivation to ${emails.length} users…`);

    for (const [email, data] of emails) {
      try {
        await sendDailyMotivation({
          to: email,
          name: data.name || email.split('@')[0],
          streak: data.streak || 0,
          weakTopics: data.weakTopics || []
        });
        console.log(`[scheduler] ✓ ${email}`);
      } catch (err) {
        console.error(`[scheduler] ✗ ${email}:`, err.message);
      }
      // 500ms between sends to stay under Resend rate limits
      await new Promise(r => setTimeout(r, 500));
    }

    console.log('[scheduler] Daily emails done.');
  });

  console.log('[scheduler] Daily emails scheduled at 01:20 AM local (TEST mode)');
}
