import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from('admin_chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ messages: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { chat_id, sender_type, message } = body;
    if (!chat_id || !message?.trim()) {
      return NextResponse.json({ error: 'chat_id and message are required' }, { status: 400 });
    }
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from('admin_chat_messages')
      .insert({
        chat_id,
        sender_type: sender_type || 'admin',
        message: message.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ message: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
