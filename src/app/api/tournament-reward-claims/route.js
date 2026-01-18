import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'tournamentId is required' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('tournament_reward_claims')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ rewardClaims: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { claimId, status, admin_note } = body || {};

    if (!claimId) {
      return NextResponse.json({ error: 'claimId is required' }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const patch = {
      status,
      processed_at: nowIso,
      updated_at: nowIso,
    };

    if (Object.prototype.hasOwnProperty.call(body, 'admin_note')) {
      patch.admin_note =
        typeof admin_note === 'string' && admin_note.trim().length > 0
          ? admin_note.trim()
          : null;
    }

    const { data, error } = await supabase
      .from('tournament_reward_claims')
      .update(patch)
      .eq('id', claimId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ rewardClaim: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
