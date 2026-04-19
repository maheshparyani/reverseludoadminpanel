import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/** GET — users with FCM token (admin: service role), paginated */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSizeRaw = parseInt(searchParams.get('pageSize') || '20', 10) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('users')
      .select('uid, username, fcm_token, fcm_platform, fcm_token_updated_at', {
        count: 'exact',
      })
      .not('fcm_token', 'is', null)
      .order('fcm_token_updated_at', { ascending: false })
      .range(from, to);

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

    const total = typeof count === 'number' ? count : rows.length;

    return NextResponse.json({ tokens: rows, total, page, pageSize });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load device tokens' },
      { status: 500 }
    );
  }
}
