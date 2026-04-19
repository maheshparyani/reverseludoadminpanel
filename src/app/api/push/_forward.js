import { NextResponse } from 'next/server';

/**
 * Proxies to reverseludobackend. Maps confusing upstream 404 to a clear 502 message.
 */
export async function forwardBackendFetch(url, init) {
  let res;
  try {
    res = await fetch(url, { ...init, cache: 'no-store' });
  } catch (e) {
    const origin = String(url).split('/api')[0] || url;
    const reason = e?.cause?.code || e?.code || e?.message || 'network error';
    return NextResponse.json(
      {
        error: `Cannot reach backend at ${origin} (${reason}). Start reverseludobackend (npm run dev) and set LUDO_BACKEND_URL in .env.local to that server (not the admin port 3001).`,
      },
      { status: 503 },
    );
  }

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text?.slice(0, 300) || `HTTP ${res.status}` };
  }

  if (res.status === 404) {
    return NextResponse.json(
      {
        error: `Backend returned 404 for ${url}. Your LUDO_BACKEND_URL must point to the Node reverseludobackend server (Express), not this Next admin app. Run backend on a free port (e.g. PORT=3000 npm run dev) and match LUDO_BACKEND_URL.`,
        upstreamStatus: 404,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(json, { status: res.status });
}
