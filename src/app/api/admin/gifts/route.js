import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

async function appendMailbox(admin, userId, mailItem) {
  const { data: userData, error: fetchError } = await admin
    .from('users')
    .select('mailbox')
    .eq('uid', userId)
    .single();
  if (fetchError) throw fetchError;
  const currentMailbox = userData?.mailbox || [];
  const { error: updateError } = await admin
    .from('users')
    .update({ mailbox: [mailItem, ...currentMailbox] })
    .eq('uid', userId);
  if (updateError) throw updateError;
}

export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const [usersRes, itemsRes, historyRes] = await Promise.all([
      admin
        .from('users')
        .select('uid, username, profile_image_url, total_coins, total_diamonds, owned_items'),
      admin.from('inventory').select('*').order('created_at', { ascending: false }),
      admin.from('gift_history').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (itemsRes.error) throw itemsRes.error;

    let giftHistory = [];
    if (!historyRes.error && historyRes.data?.length) {
      const userIds = [...new Set(historyRes.data.map((g) => g.user_id))];
      const { data: historyUsers } = await admin
        .from('users')
        .select('uid, username')
        .in('uid', userIds);
      const usersMap = {};
      (historyUsers || []).forEach((u) => {
        usersMap[u.uid] = u;
      });
      giftHistory = historyRes.data.map((g) => ({
        ...g,
        users: usersMap[g.user_id] || null,
      }));
    } else if (historyRes.error) {
      console.warn('gift_history fetch:', historyRes.error.message);
    }

    return NextResponse.json({
      users: usersRes.data || [],
      items: itemsRes.data || [],
      giftHistory,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      giftType,
      userUid,
      adminId,
      selectedItem,
      amount,
      message,
    } = body;

    if (!userUid || !giftType) {
      return NextResponse.json({ error: 'userUid and giftType are required' }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const adminLabel = adminId || 'admin';

    const { data: selectedUser, error: selErr } = await admin
      .from('users')
      .select('uid, username, profile_image_url, total_coins, total_diamonds, owned_items')
      .eq('uid', userUid)
      .single();
    if (selErr || !selectedUser) {
      return NextResponse.json({ error: selErr?.message || 'User not found' }, { status: 400 });
    }

    if (giftType === 'item') {
      if (!selectedItem?.item_id) {
        return NextResponse.json({ error: 'selectedItem.item_id is required' }, { status: 400 });
      }
      const currentItems = selectedUser.owned_items || [];
      const updatedItems = [...currentItems, selectedItem.item_id];
      const { error: uErr } = await admin
        .from('users')
        .update({ owned_items: updatedItems })
        .eq('uid', userUid);
      if (uErr) throw uErr;

      try {
        await admin.from('gift_history').insert({
          admin_id: adminLabel,
          user_id: userUid,
          gift_type: 'item',
          item_id: selectedItem.item_id,
          item_name: selectedItem.item_name,
          message: message || `You received a gift: ${selectedItem.item_name}!`,
        });
      } catch (e) {
        console.warn('gift_history insert:', e);
      }

      await appendMailbox(admin, userUid, {
        mail_type: 'general',
        title: `🎁 You received a gift!`,
        content:
          message || `You've been gifted "${selectedItem.item_name}"! Check your inventory to use it.`,
        timestamp: new Date().toISOString(),
        seen: false,
      });
    } else if (giftType === 'coins') {
      const n = parseInt(amount, 10);
      if (!n || n <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      const newCoins = (selectedUser.total_coins || 0) + n;
      const { error: uErr } = await admin
        .from('users')
        .update({ total_coins: newCoins })
        .eq('uid', userUid);
      if (uErr) throw uErr;

      try {
        await admin.from('gift_history').insert({
          admin_id: adminLabel,
          user_id: userUid,
          gift_type: 'coins',
          amount: n,
          message: message || `You received ${n} coins!`,
        });
      } catch (e) {
        console.warn('gift_history insert:', e);
      }

      await appendMailbox(admin, userUid, {
        mail_type: 'reward',
        title: `🪙 You received ${n} coins!`,
        content: message || `${n} coins have been added to your account. Enjoy!`,
        timestamp: new Date().toISOString(),
        seen: false,
      });
    } else if (giftType === 'diamonds') {
      const n = parseInt(amount, 10);
      if (!n || n <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      const newDiamonds = (selectedUser.total_diamonds || 0) + n;
      const { error: uErr } = await admin
        .from('users')
        .update({ total_diamonds: newDiamonds })
        .eq('uid', userUid);
      if (uErr) throw uErr;

      try {
        await admin.from('gift_history').insert({
          admin_id: adminLabel,
          user_id: userUid,
          gift_type: 'diamonds',
          amount: n,
          message: message || `You received ${n} diamonds!`,
        });
      } catch (e) {
        console.warn('gift_history insert:', e);
      }

      await appendMailbox(admin, userUid, {
        mail_type: 'reward',
        title: `💎 You received ${n} diamonds!`,
        content: message || `${n} diamonds have been added to your account. Enjoy!`,
        timestamp: new Date().toISOString(),
        seen: false,
      });
    } else {
      return NextResponse.json({ error: 'Invalid giftType' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
