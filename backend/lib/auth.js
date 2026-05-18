// backend/lib/auth.js — verify Google OAuth access token

export async function verifyGoogleToken(token) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
  );

  if (!res.ok) {
    throw new Error('Invalid or expired Google token');
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_description || 'Token invalid');
  }

  // If GOOGLE_CLIENT_ID is set, enforce it — prevents tokens from other apps being used
  if (GOOGLE_CLIENT_ID && data.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Token audience mismatch');
  }

  if (!data.email) {
    throw new Error('Token is missing email scope');
  }

  return {
    email: data.email,
    sub: data.sub,
    name: data.name || data.email.split('@')[0]
  };
}
