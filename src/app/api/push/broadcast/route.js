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
    const {
      title,
      body: textBody,
      type,
      userType,
      imageUrl,
      platform,
    } = body;

    if (!title || !textBody) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 },
      );
    }

    const plat =
      platform ||
      (userType === 'android'
        ? 'android'
        : userType === 'ios'
          ? 'ios'
          : 'all');

    const dataPayload = {
      type: type || 'announcement',
      userType: userType || 'all',
      ...(imageUrl ? { imageUrl: String(imageUrl) } : {}),
    };

    return forwardBackendFetch(`${base}/api/notifications/send-bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-notification-secret': sec,
      },
      body: JSON.stringify({
        title,
        body: textBody,
        data: dataPayload,
        platform: plat,
        imageUrl: imageUrl || undefined,
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Broadcast failed' },
      { status: 500 },
    );
  }
}
