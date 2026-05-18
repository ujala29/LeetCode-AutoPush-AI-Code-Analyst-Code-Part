// backend/lib/userStore.js — simple JSON file user registry

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '../../data');
const STORE_PATH = join(DATA_DIR, 'users.json');

function ensureFile() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_PATH)) writeFileSync(STORE_PATH, '{}', 'utf8');
}

export function readUsers() {
  ensureFile();
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function upsertUser(email, data) {
  const users = readUsers();
  users[email] = { ...users[email], ...data, updatedAt: new Date().toISOString() };
  writeFileSync(STORE_PATH, JSON.stringify(users, null, 2), 'utf8');
}
