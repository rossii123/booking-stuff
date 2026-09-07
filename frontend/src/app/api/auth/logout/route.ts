import { clearSessionCookie } from '@/lib/server/session';

export async function POST() {
  await clearSessionCookie();
  return new Response(null, { status: 204 });
}
