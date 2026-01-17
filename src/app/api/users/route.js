import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use service key for admin operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET - Fetch all users
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const authEmailById = new Map();
    try {
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: authData, error: authError } =
          await supabase.auth.admin.listUsers({ page, perPage });
        if (authError) break;
        const authUsers = authData?.users || [];
        for (const u of authUsers) {
          if (u?.id) {
            authEmailById.set(u.id, u.email || null);
          }
        }
        if (authUsers.length < perPage) break;
        page += 1;
      }
    } catch (_) {}

    // Map the data to normalize field names and include all fields
    const users = (data || []).map(user => {
      const id = user.uid || user.id;
      const email = user.email || authEmailById.get(id) || null;
      return {
        id,
        uid: user.uid,
        username: user.username,
        email,
        coins: user.total_coins || 0,
        diamonds: user.total_diamonds || 0,
        profile_image_url: user.profile_image_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
        // Game stats
        games_won: user.games_won || 0,
        games_lost: user.games_lost || 0,
        win_streak: user.win_streak || 0,
        tournaments_won: user.tournaments_won || 0,
        // Profile info
        selected_dice_style: user.selected_dice_style,
        selected_board_style: user.selected_board_style,
        selected_token_style: user.selected_token_style,
        owned_items: user.owned_items,
        // Other fields
        talk_time_end_date: user.talk_time_end_date,
        active_game: user.active_game,
        friends: user.friends,
        friend_requests: user.friend_requests,
        recent_played: user.recent_played,
        status: user.status,
        is_bot: user.is_bot,
        mailbox: user.mailbox,
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// PATCH - Update user coins/diamonds
export async function PATCH(request) {
  try {
    const { userId, coins, diamonds } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updateData = {};
    if (coins !== undefined) updateData.total_coins = coins;
    if (diamonds !== undefined) updateData.total_diamonds = diamonds;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('uid', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let email = data.email;
    if (!email) {
      try {
        const { data: authUserData } =
          await supabase.auth.admin.getUserById(userId);
        email = authUserData?.user?.email || null;
      } catch (_) {
        email = null;
      }
    }

    // Return normalized user
    const user = {
      id: data.uid || data.id,
      username: data.username,
      email,
      coins: data.total_coins || 0,
      diamonds: data.total_diamonds || 0,
      profile_image_url: data.profile_image_url,
      created_at: data.created_at,
    };

    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
