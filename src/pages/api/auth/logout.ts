import type { APIRoute } from 'astro';
import { createServerClient, clearAuthCookies } from '../../../lib/supabase';

export const prerender = false;

async function handle(cookies: Parameters<typeof clearAuthCookies>[0], redirectFn: (path: string) => Response) {
  try {
    const client = await createServerClient(cookies);
    await client.auth.signOut();
  } catch (err) {
    console.error('[logout]', err);
  }
  clearAuthCookies(cookies);
  return redirectFn('/');
}

export const POST: APIRoute = async ({ cookies, redirect }) => handle(cookies, redirect);
export const GET: APIRoute = async ({ cookies, redirect }) => handle(cookies, redirect);
