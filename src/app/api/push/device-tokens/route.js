import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/** GET — users with FCM token (admin: service role) */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('uid, username, fcm_token, fcm_platform, fcm_token_updated_at')
      .not('fcm_token', 'is', null)
      .order('fcm_token_updated_at', { ascending: false });

    if (error) {
      console.error('[device-tokens]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((r) => ({
      userId: r.uid,
      username: r.username ?? null,
      deviceToken: (r.fcm_token || '').trim(),
      platform: r.fcm_platform ?? null,
      tokenUpdatedAt: r.fcm_token_updated_at ?? null,
    }));

    return NextResponse.json({ tokens: rows, count: rows.length });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load device tokens' },
      { status: 500 }
    );
  }
}
