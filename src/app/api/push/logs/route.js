import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/** Anon key cannot read tables protected by RLS — logs will look empty. */
function isServiceKeySameAsAnonKey() {
  const svc = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return Boolean(svc && anon && svc === anon);
}

function isLogsTableMissing(error) {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('could not find') ||
    msg.includes('schema cache') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('push_notification_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (isLogsTableMissing(error)) {
        return NextResponse.json({
          logs: [],
          pushLogsTableAvailable: false,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const logs = data || [];
    const misconfiguredKey = isServiceKeySameAsAnonKey();

    return NextResponse.json({
      logs,
      pushLogsTableAvailable: true,
      /** True when SUPABASE_SERVICE_KEY equals anon — fix to service_role to read rows */
      supabaseKeyMisconfigured: misconfiguredKey,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to load push history' },
      { status: 500 }
    );
  }
}
