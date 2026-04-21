import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

/** PostgREST: table missing in project — empty list, no partial_errors banner */
function isMissingTableError(message) {
  if (!message || typeof message !== 'string') return false;
  const m = message.toLowerCase();
  return (
    m.includes('could not find the table') ||
    (m.includes('relation') && m.includes('does not exist'))
  );
}

async function selectOrdered(admin, table) {
  const q = admin.from(table).select('*').order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) {
    if (isMissingTableError(error.message)) {
      return { data: [], error: null };
    }
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const [gr, tr] = await Promise.all([
      selectOrdered(admin, 'game_rooms'),
      selectOrdered(admin, 'tournament_rooms'),
    ]);

    const errors = {};
    if (gr.error) errors.game_rooms = gr.error;
    if (tr.error) errors.tournament_rooms = tr.error;

    if (gr.error && tr.error) {
      return NextResponse.json(
        {
          error: 'Could not load room tables',
          details: errors,
          game_rooms: [],
          tournament_rooms: [],
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      game_rooms: gr.data,
      tournament_rooms: tr.data,
      ...(Object.keys(errors).length ? { partial_errors: errors } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const kind = searchParams.get('kind'); // 'game' | 'tournament'
    if (!id || !kind) {
      return NextResponse.json(
        { error: 'id and kind (game|tournament) are required' },
        { status: 400 },
      );
    }
    const table = kind === 'tournament' ? 'tournament_rooms' : 'game_rooms';
    const admin = createSupabaseAdmin();
    const { error } = await admin.from(table).delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
