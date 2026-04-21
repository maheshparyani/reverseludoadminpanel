import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from('promotion_apps')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ promotions: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from('promotion_apps').insert([body]).select().single();
    if (error) throw error;
    return NextResponse.json({ promotion: data });
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
    const { data, error } = await admin.from('promotion_apps').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ promotion: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const admin = createSupabaseAdmin();
    const { error } = await admin.from('promotion_apps').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
