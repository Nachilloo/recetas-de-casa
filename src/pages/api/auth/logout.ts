import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, redirect }) => {
  const supabase = createServerSupabaseClient(request);
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return redirect('/admin/login');
};

