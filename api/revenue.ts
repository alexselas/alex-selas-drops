import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import Stripe from 'stripe';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
const U_TOKEN_MAX_AGE=30*24*60*60*1000;function verifyUserToken(h:string|undefined):{valid:boolean;userId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('user.'))return{valid:false};const p=t.split('.');if(p.length!==4)return{valid:false};const[,uid,ts,hm]=p;if(!uid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>U_TOKEN_MAX_AGE||a<0)return{valid:false};const s=process.env.ADMIN_SECRET||'';const py=`user.${uid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,userId:uid};}catch{return{valid:false};}}
function verifyCollabToken(h:string|undefined):{valid:boolean;collaboratorId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('collab.'))return{valid:false};const s=process.env.ADMIN_SECRET||'';const p=t.split('.');if(p.length!==4)return{valid:false};const[,cid,ts,hm]=p;if(!cid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return{valid:false};const py=`collab.${cid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,collaboratorId:cid};}catch{return{valid:false};}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });

// Drop cost in EUR (average based on packs: 5=3.99, 10=6.99, 20=11.99 → avg ~0.70/drop)
const EUR_PER_DROP = 0.70;
const COLLAB_SHARE = 0.65; // 65% for collaborator
const PLATFORM_SHARE = 0.35; // 35% for MusicDrop

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const isAdmin = verifyAdminToken(req.headers.authorization);
  const collab = verifyCollabToken(req.headers.authorization);

  if (!isAdmin && !collab.valid) return res.status(401).json({ error: 'No autorizado' });

  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

    // Get revenue ledger for this month
    const ledger = (await redis.get(`revenue:${month}`) as any[]) || [];

    // Get all Stripe purchases this month (scan all users)
    // For simplicity, sum from ledger drops × EUR_PER_DROP
    const totalDropsConsumed = ledger.reduce((s: number, e: any) => s + (e.drops || 0), 0);
    const totalRevenueEstimate = totalDropsConsumed * EUR_PER_DROP;

    // Group by collaborator
    const byCollab: Record<string, { drops: number; tracks: number; trackList: { trackId: string; title?: string; drops: number }[] }> = {};
    for (const entry of ledger) {
      const cid = entry.collaboratorId || 'alex-selas';
      if (!byCollab[cid]) byCollab[cid] = { drops: 0, tracks: 0, trackList: [] };
      byCollab[cid].drops += entry.drops || 0;
      byCollab[cid].tracks += 1;
      // Deduplicate track list
      if (!byCollab[cid].trackList.find((t: any) => t.trackId === entry.trackId)) {
        byCollab[cid].trackList.push({ trackId: entry.trackId, title: entry.title, drops: entry.drops || 0 });
      }
    }

    // Calculate earnings
    const collabEarnings: { collaboratorId: string; drops: number; downloads: number; eurEarned: number; eurPlatform: number }[] = [];
    for (const [cid, data] of Object.entries(byCollab)) {
      const share = totalDropsConsumed > 0 ? data.drops / totalDropsConsumed : 0;
      const eurTotal = totalRevenueEstimate * share;
      collabEarnings.push({
        collaboratorId: cid,
        drops: data.drops,
        downloads: data.tracks,
        eurEarned: Math.round(eurTotal * COLLAB_SHARE * 100) / 100,
        eurPlatform: Math.round(eurTotal * PLATFORM_SHARE * 100) / 100,
      });
    }
    collabEarnings.sort((a, b) => b.eurEarned - a.eurEarned);

    // If collaborator: only show their data + individual downloads
    if (collab.valid && !isAdmin) {
      const myData = collabEarnings.find(e => e.collaboratorId === collab.collaboratorId);
      const myTracks = byCollab[collab.collaboratorId || '']?.trackList || [];
      // Get individual download entries for their tracks
      const myDownloads = ledger
        .filter((e: any) => (e.collaboratorId || 'alex-selas') === collab.collaboratorId)
        .map((e: any) => ({ trackId: e.trackId, title: e.title, drops: e.drops, date: e.date }));
      return res.status(200).json({
        month,
        collaboratorId: collab.collaboratorId,
        drops: myData?.drops || 0,
        downloads: myData?.downloads || 0,
        eurEarned: myData?.eurEarned || 0,
        trackBreakdown: myTracks,
        recentDownloads: myDownloads.slice(0, 30),
        totalDropsConsumed,
      });
    }

    // Scan all users for Stripe drop purchases this month
    const allPurchases: any[] = [];
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: 'user-purchases:*', count: 100 });
      cursor = Number(nextCursor);
      for (const key of keys) {
        const purchases = (await redis.get(key) as any[]) || [];
        for (const p of purchases) {
          if (p.date && p.date.startsWith(month)) {
            allPurchases.push(p);
          }
        }
      }
    } while (cursor !== 0);

    // Check refund status with Stripe (filter out refunded)
    const dropPurchases: any[] = [];
    let totalStripeRevenue = 0;
    for (const p of allPurchases) {
      if (p.stripeSessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(p.stripeSessionId);
          const pi = session.payment_intent;
          if (pi && typeof pi === 'string') {
            const intent = await stripe.paymentIntents.retrieve(pi);
            if (intent.status === 'canceled' || (intent.latest_charge && typeof intent.latest_charge === 'string')) {
              const charge = await stripe.charges.retrieve(intent.latest_charge as string);
              if (charge.refunded) {
                continue; // Skip refunded purchases
              }
            }
          }
        } catch {}
      }
      dropPurchases.push(p);
      totalStripeRevenue += p.amount || 0;
    }

    dropPurchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Admin: full view
    return res.status(200).json({
      month,
      totalDropsConsumed,
      totalStripeRevenue: Math.round(totalStripeRevenue * 100) / 100,
      totalRevenueEstimate: Math.round(totalRevenueEstimate * 100) / 100,
      totalCollabPayments: Math.round(collabEarnings.reduce((s, e) => s + e.eurEarned, 0) * 100) / 100,
      totalPlatformRevenue: Math.round(collabEarnings.reduce((s, e) => s + e.eurPlatform, 0) * 100) / 100,
      collaborators: collabEarnings,
      transactionCount: ledger.length,
      dropPurchases: dropPurchases.slice(0, 50),
      dropPurchaseCount: dropPurchases.length,
    });
  } catch (error: any) {
    console.error('Revenue error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
