import { NextResponse } from 'next/server';
import { forwardBackendFetch } from '../_forward.js';

function backendUrl() {
  return (
    process.env.LUDO_BACKEND_URL ||
    process.env.NEXT_PUBLIC_LUDO_BACKEND_URL ||
    ''
  ).replace(/\/$/, '');
}

function secret() {
  return (
    process.env.LUDO_NOTIFICATION_SECRET ||
    process.env.NOTIFICATION_SEND_SECRET ||
    ''
  );
}

export async function POST(request) {
  try {
    const base = backendUrl();
    const sec = secret();
    if (!base || !sec) {
      return NextResponse.json(
        {
          error:
            'Missing env: set LUDO_BACKEND_URL and LUDO_NOTIFICATION_SECRET in .env.local (must match backend NOTIFICATION_SEND_SECRET). Restart the dev server after saving.',
        },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { userIds, title, body: textBody, type, userType, imageUrl } = body;

    if (!title || !textBody) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 },
      );
    }

    const raw = userIds ?? body.userUids;
    const userUids = Array.isArray(raw)
      ? raw
      : String(raw || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    if (userUids.length === 0) {
      return NextResponse.json(
        { error: 'At least one user ID is required' },
        { status: 400 },
      );
    }

    const dataPayload = {
      type: type || 'promotion',
      userType: userType || 'all',
      ...(imageUrl ? { imageUrl: String(imageUrl) } : {}),
    };

    return forwardBackendFetch(`${base}/api/notifications/send-targeted`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-notification-secret': sec,
      },
      body: JSON.stringify({
        userUids,
        title,
        body: textBody,
        data: dataPayload,
        imageUrl: imageUrl || undefined,
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Targeted send failed' },
      { status: 500 },
    );
  }
}
