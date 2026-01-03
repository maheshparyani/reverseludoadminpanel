import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

function parseBool(v, fallback = false) {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
}

function parseIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function uploadBannerIfPresent(formData) {
  const bannerFile = formData.get('banner');
  if (!bannerFile || !bannerFile.size) return null;

  if (!bannerFile.type.startsWith('image/')) {
    throw new Error('Banner must be an image');
  }
  if (bannerFile.size > 5 * 1024 * 1024) {
    throw new Error('Banner size must be <= 5MB');
  }

  const ext = bannerFile.name.split('.').pop();
  const fileName = `event_${Date.now()}.${ext}`;
  const filePath = `events/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('event-banners')
    .upload(filePath, bannerFile, { contentType: bannerFile.type, upsert: true });

  if (uploadError) {
    throw new Error(
      `Failed to upload banner. Make sure the "event-banners" bucket exists. ${uploadError.message}`,
    );
  }

  const { data: urlData } = supabase.storage.from('event-banners').getPublicUrl(filePath);
  return urlData?.publicUrl || null;
}

function parseMissionsJson(formData) {
  const missionsRaw = formData.get('missions');
  if (!missionsRaw) return [];

  let parsed;
  try {
    parsed = JSON.parse(String(missionsRaw));
  } catch (e) {
    throw new Error('Invalid missions JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('missions must be an array');
  }

  return parsed.map((m) => ({
    id: m.id || null,
    task_type: String(m.task_type || ''),
    target: parseIntOrNull(m.target),
    reward_type: String(m.reward_type || ''),
    reward_amount: parseIntOrNull(m.reward_amount),
    reward_item_id: m.reward_item_id ? String(m.reward_item_id) : null,
    reward_duration_days: parseIntOrNull(m.reward_duration_days),
  }));
}

async function deleteMissionsNotIn(eventId, keepIds) {
  let q = supabase.from('event_missions').delete().eq('event_id', eventId);

  if (keepIds.length > 0) {
    q = q.not('id', 'in', `(${keepIds.map((id) => `"${id}"`).join(',')})`);
  }

  const { error } = await q;
  if (error) throw error;
}

// GET: list events with missions
export async function GET() {
  try {
    const { data: events, error: eErr } = await supabase
      .from('events')
      .select('*')
      .order('display_order', { ascending: true })
      .order('start_at', { ascending: false });

    if (eErr) throw eErr;

    const eventIds = (events || []).map((e) => e.id);
    let missions = [];

    if (eventIds.length) {
      const { data: mData, error: mErr } = await supabase
        .from('event_missions')
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: true });

      if (mErr) throw mErr;
      missions = mData || [];
    }

    const missionsByEvent = new Map();
    for (const m of missions) {
      const list = missionsByEvent.get(m.event_id) || [];
      list.push(m);
      missionsByEvent.set(m.event_id, list);
    }

    const enriched = (events || []).map((e) => ({
      ...e,
      missions: missionsByEvent.get(e.id) || [],
    }));

    return NextResponse.json({ events: enriched });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create event + missions (multipart form)
export async function POST(request) {
  try {
    const formData = await request.formData();

    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const start_at = parseDateOrNull(formData.get('start_at'));
    const end_at = parseDateOrNull(formData.get('end_at'));
    const is_active = parseBool(formData.get('is_active'), true);
    const display_order = parseIntOrNull(formData.get('display_order')) ?? 0;

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
    if (!start_at) return NextResponse.json({ error: 'start_at is required' }, { status: 400 });
    if (!end_at) return NextResponse.json({ error: 'end_at is required' }, { status: 400 });

    const banner_url = (await uploadBannerIfPresent(formData)) || null;
    const missions = parseMissionsJson(formData);

    const { data: event, error: insertErr } = await supabase
      .from('events')
      .insert({
        title,
        description,
        banner_url,
        start_at,
        end_at,
        is_active,
        display_order,
      })
      .select('*')
      .single();

    if (insertErr) throw insertErr;

    if (missions.length) {
      const payload = missions.map((m) => ({
        event_id: event.id,
        task_type: m.task_type,
        target: m.target,
        reward_type: m.reward_type,
        reward_amount: m.reward_amount,
        reward_item_id: m.reward_item_id,
        reward_duration_days: m.reward_duration_days,
      }));

      const { error: mErr } = await supabase.from('event_missions').insert(payload);
      if (mErr) throw mErr;
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: update event + missions (multipart form)
export async function PUT(request) {
  try {
    const formData = await request.formData();

    const id = String(formData.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const start_at = parseDateOrNull(formData.get('start_at'));
    const end_at = parseDateOrNull(formData.get('end_at'));
    const is_active = parseBool(formData.get('is_active'), true);
    const display_order = parseIntOrNull(formData.get('display_order')) ?? 0;

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
    if (!start_at) return NextResponse.json({ error: 'start_at is required' }, { status: 400 });
    if (!end_at) return NextResponse.json({ error: 'end_at is required' }, { status: 400 });

    const missions = parseMissionsJson(formData);

    const updateData = {
      title,
      description,
      start_at,
      end_at,
      is_active,
      display_order,
      updated_at: new Date().toISOString(),
    };

    const bannerUrl = await uploadBannerIfPresent(formData);
    if (bannerUrl) {
      updateData.banner_url = bannerUrl;
    }

    const { data: event, error: updErr } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) throw updErr;

    // Missions upsert: update existing, insert new, delete removed
    const keepIds = missions.filter((m) => m.id).map((m) => m.id);

    for (const m of missions) {
      const row = {
        event_id: id,
        task_type: m.task_type,
        target: m.target,
        reward_type: m.reward_type,
        reward_amount: m.reward_amount,
        reward_item_id: m.reward_item_id,
        reward_duration_days: m.reward_duration_days,
        updated_at: new Date().toISOString(),
      };

      if (m.id) {
        const { error } = await supabase.from('event_missions').update(row).eq('id', m.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_missions').insert(row);
        if (error) throw error;
      }
    }

    await deleteMissionsNotIn(id, keepIds);

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: delete event (and cascades missions)
export async function DELETE(request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
