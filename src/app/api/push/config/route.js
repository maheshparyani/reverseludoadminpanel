import { NextResponse } from 'next/server';

/** Whether admin can proxy push + probe that URL is actually reverseludobackend */
export async function GET() {
  const base = (
    process.env.LUDO_BACKEND_URL ||
    process.env.NEXT_PUBLIC_LUDO_BACKEND_URL ||
    ''
  ).replace(/\/$/, '');
  const sec =
    process.env.LUDO_NOTIFICATION_SECRET ||
    process.env.NOTIFICATION_SEND_SECRET ||
    '';
  const pushBackendConfigured = Boolean(base && sec);

  /** @type {{ status?: number, ok?: boolean, service?: string, error?: string }} */
  let backendHealth = null;
  if (base) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const h = await fetch(`${base}/api/notifications/health`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const json = await h.json().catch(() => ({}));
      backendHealth = {
        status: h.status,
        ok: h.ok,
        service: json?.service,
      };
      if (!h.ok) {
        backendHealth.error = `Health returned HTTP ${h.status}`;
      }
    } catch (e) {
      backendHealth = {
        error: String(e?.name === 'AbortError' ? 'Timeout — nothing responded' : e?.message || e),
      };
    }
  }

  const looksLikeLudoBackend =
    backendHealth?.ok &&
    backendHealth?.service === 'reverseludobackend';

  return NextResponse.json({
    pushBackendConfigured,
    backendHealth,
    looksLikeLudoBackend: Boolean(looksLikeLudoBackend),
    backendUrl: base || null,
  });
}
