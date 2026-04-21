import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const admin = createSupabaseAdmin();

    let query = admin
      .from('admin_chats')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (filter === 'unread') query = query.eq('unread_by_admin', true);
    else if (filter === 'open') query = query.eq('status', 'open');
    else if (filter === 'closed') query = query.eq('status', 'closed');

    const { data: chatsData, error: queryError } = await query;
    if (queryError) throw queryError;

    if (!chatsData?.length) {
      return NextResponse.json({ chats: [] });
    }

    const userIds = [...new Set(chatsData.map((c) => c.user_id))];
    const { data: usersData } = await admin
      .from('users')
      .select('uid, username, profile_image_url')
      .in('uid', userIds);

    const usersMap = {};
    (usersData || []).forEach((u) => {
      usersMap[u.uid] = u;
    });

    const chatsWithUsers = chatsData.map((chat) => ({
      ...chat,
      users: usersMap[chat.user_id] || null,
    }));

    return NextResponse.json({ chats: chatsWithUsers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from('admin_chats').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ chat: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
