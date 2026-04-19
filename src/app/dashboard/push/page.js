'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PUSH_NOTIFICATION_DESTINATIONS,
  DEFAULT_PUSH_DESTINATION,
} from '@/lib/pushDestinations';

const tabs = [
  { id: 'send', label: 'Send' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'tokens', label: 'Device tokens' },
];

const IMAGE_BUCKET =
  process.env.NEXT_PUBLIC_PROMOTION_IMAGES_BUCKET || 'promotion-images';

const inputClass =
  'w-full bg-gray-900/60 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500';

export default function PushNotificationsPage() {
  const [tab, setTab] = useState('send');

  const [bcLoading, setBcLoading] = useState(false);
  const [bcUploading, setBcUploading] = useState(false);
  const [bc, setBc] = useState({
    type: DEFAULT_PUSH_DESTINATION,
    title: '',
    body: '',
    imageUrl: '',
  });
  const bcFileRef = useRef(null);

  const [tgLoading, setTgLoading] = useState(false);
  const [tgUploading, setTgUploading] = useState(false);
  const [tg, setTg] = useState({
    userIds: '',
    type: DEFAULT_PUSH_DESTINATION,
    title: '',
    body: '',
    imageUrl: '',
  });
  const tgFileRef = useRef(null);

  const [pushHistoryRows, setPushHistoryRows] = useState([]);
  const [pushLogsTableAvailable, setPushLogsTableAvailable] = useState(true);
  const [supabaseKeyMisconfigured, setSupabaseKeyMisconfigured] = useState(false);
  const [pushHistoryLoading, setPushHistoryLoading] = useState(false);
  const [pushHistoryError, setPushHistoryError] = useState(null);

  const [tokenRows, setTokenRows] = useState([]);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState(null);

  /** null = loading — from GET /api/push/config (includes backend health probe) */
  const [pushConfig, setPushConfig] = useState(null);

  const uploadPushImage = useCallback(async (file, subfolder) => {
    if (!file?.type?.startsWith('image/')) {
      alert('Please choose an image file');
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return null;
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `push/${subfolder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) {
      console.error(error);
      alert(
        `Upload failed (${IMAGE_BUCKET}). ${error.message || 'Unknown error'}`
      );
      return null;
    }
    const { data: urlData } = supabase.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(path);
    return urlData?.publicUrl || null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/push/config')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setPushConfig(d || {});
      })
      .catch(() => {
        if (!cancelled) setPushConfig({ pushBackendConfigured: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function parseJsonResponse(res) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { error: text.slice(0, 200) || `HTTP ${res.status}` };
    }
  }

  const handleBcFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBcUploading(true);
    try {
      const url = await uploadPushImage(file, 'broadcast');
      if (url) setBc((s) => ({ ...s, imageUrl: url }));
    } finally {
      setBcUploading(false);
      e.target.value = '';
    }
  };

  const handleTgFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTgUploading(true);
    try {
      const url = await uploadPushImage(file, 'targeted');
      if (url) setTg((s) => ({ ...s, imageUrl: url }));
    } finally {
      setTgUploading(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (tab !== 'notifications') return;
    let cancelled = false;
    (async () => {
      setPushHistoryLoading(true);
      setPushHistoryError(null);
      setSupabaseKeyMisconfigured(false);
      try {
        const res = await fetch('/api/push/logs');
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load');
        if (!cancelled) {
          setPushHistoryRows(json?.logs || []);
          setPushLogsTableAvailable(json?.pushLogsTableAvailable !== false);
          setSupabaseKeyMisconfigured(!!json?.supabaseKeyMisconfigured);
        }
      } catch (e) {
        if (!cancelled) setPushHistoryError(e.message);
      } finally {
        if (!cancelled) setPushHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'tokens') return;
    let cancelled = false;
    (async () => {
      setTokenLoading(true);
      setTokenError(null);
      try {
        const res = await fetch('/api/push/device-tokens');
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load');
        if (!cancelled) setTokenRows(json?.tokens || []);
      } catch (e) {
        if (!cancelled) setTokenError(e.message);
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const sendBroadcast = async () => {
    if (!bc.title?.trim() || !bc.body?.trim() || !bc.type?.trim()) {
      alert('Type, title and body are required');
      return;
    }
    setBcLoading(true);
    try {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bc.title.trim(),
          body: bc.body.trim(),
          type: bc.type.trim(),
          platform: 'all',
          userType: 'all',
          imageUrl: bc.imageUrl.trim() || undefined,
        }),
      });
      const json = await parseJsonResponse(res);
      if (!res.ok) throw new Error(json?.error || 'Send failed');
      alert(
        `Broadcast queued. Recipients (tokens): ${json.recipientsUniqueTokens ?? '—'}, success: ${json.successCount ?? '—'}`
      );
    } catch (e) {
      alert(e.message || 'Error');
    } finally {
      setBcLoading(false);
    }
  };

  const sendTargeted = async () => {
    if (
      !tg.userIds?.trim() ||
      !tg.title?.trim() ||
      !tg.body?.trim() ||
      !tg.type?.trim()
    ) {
      alert('User IDs, type, title and body are required');
      return;
    }
    setTgLoading(true);
    try {
      const res = await fetch('/api/push/targeted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: tg.userIds.trim(),
          title: tg.title.trim(),
          body: tg.body.trim(),
          type: tg.type.trim(),
          userType: 'all',
          imageUrl: tg.imageUrl.trim() || undefined,
        }),
      });
      const json = await parseJsonResponse(res);
      if (!res.ok) throw new Error(json?.error || 'Send failed');
      alert(
        `Targeted done. OK: ${json.okCount ?? 0}, failed: ${json.failCount ?? 0}`
      );
    } catch (e) {
      alert(e.message || 'Error');
    } finally {
      setTgLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {pushConfig && !pushConfig.pushBackendConfigured && (
        <div className="mb-4 p-4 rounded-xl border border-red-500/40 bg-red-950/40 text-red-100 text-sm">
          <p className="font-semibold text-white mb-1">Push server not configured</p>
          <p className="text-red-200/90 mb-2">
            Set <code className="text-purple-300">LUDO_BACKEND_URL</code> (e.g.{' '}
            <code className="text-gray-300">http://127.0.0.1:3000</code>) and{' '}
            <code className="text-purple-300">LUDO_NOTIFICATION_SECRET</code> in{' '}
            <code className="text-gray-300">.env.local</code> — same as{' '}
            <code className="text-purple-300">NOTIFICATION_SEND_SECRET</code> in the backend{' '}
            <code className="text-gray-300">.env</code>.
          </p>
          <p className="text-xs text-gray-400">Restart <code>next dev</code> after editing env.</p>
        </div>
      )}

      {pushConfig?.pushBackendConfigured && pushConfig.looksLikeLudoBackend === false && (
        <div className="mb-4 p-4 rounded-xl border border-amber-500/50 bg-amber-950/35 text-amber-100 text-sm">
          <p className="font-semibold text-white mb-1">Wrong app on your backend URL</p>
          <p className="text-amber-100/95 mb-2">
            <code className="text-gray-200">{pushConfig.backendUrl}</code> did not respond with
            reverseludobackend health (
            <span className="font-mono text-xs">
              {pushConfig.backendHealth?.error ||
                (pushConfig.backendHealth?.status != null
                  ? `HTTP ${pushConfig.backendHealth.status}`
                  : 'unknown')}
            </span>
            ). Something else may be on that port, or the Node server is an old build.
          </p>
          <p className="text-xs text-gray-300">
            From <code className="text-purple-300">reverseludobackend</code> run{' '}
            <code className="text-gray-200">npm run dev</code> (or restart nodemon) so{' '}
            <code className="text-gray-200">POST /api/notifications/send-targeted</code> exists. Test:{' '}
            <code className="text-gray-200">
              curl http://127.0.0.1:3000/api/notifications/health
            </code>
          </p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">Push Notification</h1>
        <div className="flex flex-wrap gap-1 border-b border-gray-700">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t.id
                  ? 'bg-purple-600 text-white border border-b-0 border-gray-700 -mb-px'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'send' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-gray-200 min-w-0">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h2 className="text-lg font-semibold text-white">Broadcast</h2>
              <button
                type="button"
                onClick={sendBroadcast}
                disabled={bcLoading || bcUploading}
                className="shrink-0 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {bcLoading ? 'Sending…' : 'Send'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              All registered devices (single flow — no platform filter).
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Open on tap <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Screen or destination opened when the user taps the notification.
                </p>
                <select
                  className={inputClass}
                  value={bc.type}
                  onChange={(e) => setBc({ ...bc, type: e.target.value })}
                >
                  {PUSH_NOTIFICATION_DESTINATIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputClass}
                  placeholder="Important announcement"
                  value={bc.title}
                  onChange={(e) => setBc({ ...bc, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Body <span className="text-red-400">*</span>
                </label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  placeholder="We have exciting news…"
                  value={bc.body}
                  onChange={(e) => setBc({ ...bc, body: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Image (optional)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={bcFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBcFile}
                  />
                  <button
                    type="button"
                    onClick={() => bcFileRef.current?.click()}
                    disabled={bcUploading}
                    className="px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 disabled:opacity-50"
                  >
                    {bcUploading ? 'Uploading…' : 'Upload image'}
                  </button>
                  {bc.imageUrl ? (
                    <>
                      <span className="text-xs text-green-400 truncate max-w-[200px]">
                        Saved
                      </span>
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => setBc({ ...bc, imageUrl: '' })}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">No image</span>
                  )}
                </div>
                {bc.imageUrl ? (
                  <img
                    src={bc.imageUrl}
                    alt=""
                    className="mt-2 max-h-32 rounded-lg border border-gray-600 object-contain"
                  />
                ) : null}
              </div>
            </div>
          </section>

          <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-gray-200 min-w-0">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h2 className="text-lg font-semibold text-white">Targeted</h2>
              <button
                type="button"
                onClick={sendTargeted}
                disabled={tgLoading || tgUploading}
                className="shrink-0 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {tgLoading ? 'Sending…' : 'Send'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Comma-separated user IDs; same flow for all platforms.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  User IDs <span className="text-red-400">*</span>
                </label>
                <input
                  className={`${inputClass} font-mono text-xs`}
                  placeholder="uuid-1, uuid-2, uuid-3"
                  value={tg.userIds}
                  onChange={(e) => setTg({ ...tg, userIds: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Open on tap <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Screen opened on tap; matches FCM{' '}
                  <code className="text-purple-300">data.type</code>.
                </p>
                <select
                  className={inputClass}
                  value={tg.type}
                  onChange={(e) => setTg({ ...tg, type: e.target.value })}
                >
                  {PUSH_NOTIFICATION_DESTINATIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputClass}
                  placeholder="Special offer"
                  value={tg.title}
                  onChange={(e) => setTg({ ...tg, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Body <span className="text-red-400">*</span>
                </label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  placeholder="Limited time…"
                  value={tg.body}
                  onChange={(e) => setTg({ ...tg, body: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Image (optional)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={tgFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleTgFile}
                  />
                  <button
                    type="button"
                    onClick={() => tgFileRef.current?.click()}
                    disabled={tgUploading}
                    className="px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 disabled:opacity-50"
                  >
                    {tgUploading ? 'Uploading…' : 'Upload image'}
                  </button>
                  {tg.imageUrl ? (
                    <>
                      <span className="text-xs text-green-400 truncate max-w-[200px]">
                        Saved
                      </span>
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => setTg({ ...tg, imageUrl: '' })}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">No image</span>
                  )}
                </div>
                {tg.imageUrl ? (
                  <img
                    src={tg.imageUrl}
                    alt=""
                    className="mt-2 max-h-32 rounded-lg border border-gray-600 object-contain"
                  />
                ) : null}
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-white">Push history (FCM)</h2>
            <span className="text-xs text-gray-500">
              Table:{' '}
              <code className="text-purple-300">push_notification_logs</code>
            </span>
          </div>
          {!pushLogsTableAvailable && (
            <div className="px-4 py-3 text-sm text-amber-200/90 bg-amber-950/40 border-b border-amber-900/50">
              <p className="mb-2">
                The <code className="text-purple-300">push_notification_logs</code> table is not in
                Supabase yet. Run the SQL file{' '}
                <code className="text-gray-300">
                  reverseludobackend/sql/push_notification_logs.sql
                </code>{' '}
                in Supabase → SQL Editor, then reload this page.
              </p>
              <p className="text-xs text-gray-400">
                The in-app mailbox still uses <code className="text-purple-300">users.mailbox</code>;
                this list only shows pushes sent through the backend (FCM).
              </p>
            </div>
          )}
          {pushLogsTableAvailable && supabaseKeyMisconfigured && (
            <div className="px-4 py-3 text-sm text-amber-100/95 bg-red-950/35 border-b border-red-900/40">
              <p className="font-semibold text-white mb-1">Supabase server key misconfigured</p>
              <p className="mb-2">
                <code className="text-purple-300">SUPABASE_SERVICE_KEY</code> in{' '}
                <code className="text-gray-300">.env.local</code> must be the{' '}
                <strong>service_role</strong> secret (Supabase → Project Settings → API), not the
                anon key. With the anon key, Row Level Security hides rows, so this list stays empty
                even when the table has data.
              </p>
              <p className="text-xs text-gray-400">
                Copy <code className="text-gray-300">SUPABASE_SERVICE_KEY</code> from{' '}
                <code className="text-gray-300">reverseludobackend/.env</code> if it is already
                correct there, restart <code className="text-gray-300">next dev</code>, then refresh.
              </p>
            </div>
          )}
          {pushHistoryLoading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : pushHistoryError ? (
            <div className="p-8 text-center text-red-400">{pushHistoryError}</div>
          ) : pushHistoryRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {!pushLogsTableAvailable
                ? 'After you create the table and send pushes, history will appear here.'
                : supabaseKeyMisconfigured
                  ? 'No rows could be loaded. Fix the Supabase key warning above, restart the dev server, then refresh this tab.'
                  : 'No FCM send history yet. Use the Send tab to send a broadcast or targeted push; entries appear here after the backend logs them.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-900/50 text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Mode</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Body</th>
                    <th className="px-4 py-3 font-medium">Reach</th>
                    <th className="px-4 py-3 font-medium">OK / Fail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {pushHistoryRows.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {n.created_at
                          ? new Date(n.created_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-white capitalize">{n.mode ?? '—'}</td>
                      <td className="px-4 py-3 text-purple-300">
                        {n.payload_type
                          ? PUSH_NOTIFICATION_DESTINATIONS.find(
                              (d) => d.value === n.payload_type,
                            )?.label ?? n.payload_type
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-white max-w-[160px] truncate">
                        {n.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                        {n.body ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {n.mode === 'broadcast' && n.recipients_unique_tokens != null
                          ? `${n.recipients_unique_tokens} tokens`
                          : n.mode === 'targeted' && Array.isArray(n.target_user_ids)
                            ? `${n.target_user_ids.length} user(s)`
                            : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                        {n.ok_count ?? '—'} / {n.fail_count ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'tokens' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Device tokens</h2>
            <p className="text-xs text-gray-500 mt-1">
              Users with a stored FCM token (name, token, user id).
            </p>
          </div>
          {tokenLoading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : tokenError ? (
            <div className="p-8 text-center text-red-400">{tokenError}</div>
          ) : tokenRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No device tokens registered
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-900/50 text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium min-w-[200px]">
                      Device token
                    </th>
                    <th className="px-4 py-3 font-medium">User ID</th>
                    <th className="px-4 py-3 font-medium">Platform</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {tokenRows.map((row) => (
                    <tr key={row.userId} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-white">
                        {row.username || (
                          <span className="text-gray-500 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-300 break-all max-w-xl">
                        {row.deviceToken}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-purple-300">
                        {row.userId}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {row.platform || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
