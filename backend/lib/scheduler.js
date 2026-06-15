// backend/lib/scheduler.js — daily motivation email cron
// Runs at 9:00 AM IST (03:30 UTC) every day

import cron from 'node-cron';
import { readUsers } from './userStore.js';
import { sendDailyMotivation } from './mailer.js';

export async function sendAllEmails() {
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
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('[scheduler] Daily emails done.');
  return emails.length;
}

export function startScheduler() {
  // 9:00 AM IST = 03:30 UTC — kept as fallback if server stays warm
  cron.schedule('30 3 * * *', sendAllEmails);
  console.log('[scheduler] Daily emails scheduled at 09:00 AM IST (03:30 UTC)');
}
