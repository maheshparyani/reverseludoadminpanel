import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    // Support: /api/tournaments?tournamentId=123&players=1
    // Returns players (uids + names) from leaderboard for that tournament.
    // Used by Notifications UI.
    // Default: returns tournaments list.
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const playersFlag = searchParams.get('players');

    if (playersFlag === '1') {
      if (!tournamentId) {
        return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('leaderboard')
        .select('player_uid, player_name, player_profile_url, rank, score')
        .eq('tournament_id', Number(tournamentId))
        .order('rank', { ascending: true });

      if (error) throw error;

      const seen = new Set();
      const players = (data || []).filter((p) => {
        if (!p?.player_uid) return false;
        if (seen.has(p.player_uid)) return false;
        seen.add(p.player_uid);
        return true;
      });

      return NextResponse.json({ players });
    }

    const { data, error } = await supabase
      .from('tournament')
      .select('id, tournament_title, tournament_start_time, tournament_end_time, tournament_result_time, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ tournaments: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('tournament')
      .insert([body])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ tournament: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    const { data, error } = await supabase
      .from('tournament')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ tournament: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tournament')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
