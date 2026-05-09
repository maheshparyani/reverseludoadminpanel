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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** DELETE — clear FCM fields for one user (admin / service role). Body: { userId: uuid } */
export async function DELETE(request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY)' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const userId =
      typeof body.userId === 'string' ? body.userId.trim() : '';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        fcm_token: null,
        fcm_platform: null,
        fcm_token_updated_at: null,
      })
      .eq('uid', userId)
      .select('uid');

    if (error) {
      console.error('[device-tokens DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data?.length) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to clear device token' },
      { status: 500 }
    );
  }
}
