import type { VercelRequest, VercelResponse } from '@vercel/node';
import { corsHeaders } from './_auth';

const PAYPAL_CLIENT_ID = process.env.VITE_PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET_KEY || '';
const PAYPAL_API = 'https://api-m.paypal.com';

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('PayPal auth failed');
  }
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orderID } = req.body;

    if (!orderID || typeof orderID !== 'string') {
      return res.status(400).json({ error: 'Falta orderID' });
    }

    // Sanitize orderID to prevent injection
    if (!/^[A-Za-z0-9]+$/.test(orderID)) {
      return res.status(400).json({ error: 'orderID no válido' });
    }

    const accessToken = await getAccessToken();

    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureRes.json();

    if (captureData.status === 'COMPLETED') {
      return res.status(200).json({ success: true, details: captureData });
    }

    return res.status(400).json({
      success: false,
      error: 'La captura del pago no se completó',
    });
  } catch (error: any) {
    console.error('PayPal capture error:', error);
    return res.status(500).json({ error: 'Error al procesar pago de PayPal' });
  }
}
