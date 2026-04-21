import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function isMissingTableError(message) {
  if (!message || typeof message !== 'string') return false;
  const m = message.toLowerCase();
  return (
    m.includes('could not find the table') ||
    (m.includes('relation') && m.includes('does not exist'))
  );
}

/** Solo-score `tournament` rows → same shape as bracket `tournaments` for the stats UI */
function mapSingularTournamentForStats(row) {
  const label = deriveSingularTournamentPhase(row);
  const status =
    label === 'Draft' || label === 'Upcoming'
      ? 'upcoming'
      : label === 'Active'
        ? 'in_progress'
        : label === 'Ended'
          ? 'finals'
          : 'completed';

  return {
    tournament_id: row.id,
    tournament_name: row.tournament_title ?? 'Tournament',
    status,
    entry_fee: Number(row.entry_fee) || 0,
    reward_amount: Number(row.reward_amount) || 0,
    current_players: Number(row.tournament_entries) || 0,
    tournament_starting_time: row.tournament_start_time,
  };
}

function deriveSingularTournamentPhase(row) {
  if (
    !row?.tournament_start_time ||
    !row?.tournament_end_time ||
    !row?.tournament_result_time
  ) {
    return 'Draft';
  }
  const clean = (s) =>
    String(s).replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '');
  const now = new Date();
  const startTime = new Date(clean(row.tournament_start_time));
  const endTime = new Date(clean(row.tournament_end_time));
  const resultTime = new Date(clean(row.tournament_result_time));
  if (now < startTime) return 'Upcoming';
  if (now >= startTime && now < endTime) return 'Active';
  if (now >= endTime && now < resultTime) return 'Ended';
  return 'Results Out';
}

async function fetchTournamentRowsForStats() {
  const { data, error } = await supabase.from('tournaments').select('*');
  if (!error) return data || [];

  if (!isMissingTableError(error.message)) throw error;

  const { data: rows, error: err2 } = await supabase.from('tournament').select('*');
  if (err2) {
    if (isMissingTableError(err2.message)) return [];
    throw err2;
  }
  return (rows || []).map(mapSingularTournamentForStats);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get user stats
    const { data: users, error: usersError } = await supabase.from('users').select('*');
    if (usersError) throw usersError;

    // Bracket `tournaments` table OR solo-score `tournament` table
    const tournaments = await fetchTournamentRowsForStats();

    // Get game rooms stats
    const { data: gameRooms, error: gameRoomsError } = await supabase.from('game_rooms').select('*');
    if (gameRoomsError) throw gameRoomsError;

    if (searchParams.get('raw') === '1') {
      return NextResponse.json({
        users: users || [],
        tournaments: tournaments || [],
        game_rooms: gameRooms || [],
      });
    }

    // Calculate stats
    const userStats = {
      total: users?.length || 0,
      totalCoins: users?.reduce((sum, u) => sum + (u.total_coins || 0), 0) || 0,
      totalDiamonds: users?.reduce((sum, u) => sum + (u.total_diamonds || 0), 0) || 0,
      activeToday: users?.filter(u => {
        const lastSeen = new Date(u.updated_at || u.created_at);
        const today = new Date();
        return lastSeen.toDateString() === today.toDateString();
      }).length || 0
    };

    const tournamentStats = {
      total: tournaments?.length || 0,
      upcoming: tournaments?.filter(t => t.status === 'upcoming' || t.status === 'registration').length || 0,
      running: tournaments?.filter(t => t.status === 'in_progress' || t.status === 'finals').length || 0,
      completed: tournaments?.filter(t => t.status === 'completed').length || 0,
      totalPrizePool: tournaments?.reduce((sum, t) => sum + (t.reward_amount || 0), 0) || 0,
      totalParticipants: tournaments?.reduce((sum, t) => sum + (t.current_players || 0), 0) || 0
    };

    const gameStats = {
      totalRooms: gameRooms?.length || 0,
      activeGames: gameRooms?.filter(r => r.game_state === 'playing').length || 0,
      completedGames: gameRooms?.filter(r => r.game_state === 'finished').length || 0
    };

    return NextResponse.json({
      users: userStats,
      tournaments: tournamentStats,
      games: gameStats
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
