import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const PROFILES_KEY = 'collab-profiles';

// One-time migration: fix corrupted bios with broken ñ/accents
const BIO_FIXES: Record<string, string> = {
  'alex-selas': 'DJ y Productor Español',
  'dj-aaron-garcia': 'Aaron Garcia, DJ Productor. Profesional del sector musical desde los 15 años. Inició su trayectoria en eventos populares como Fallas, Hogueras y bodas, evolucionando posteriormente a salas y discotecas.',
  'cristian-gil': '20 años de elite en sonido urbano. De las salas más emblemáticas de la costa levantina a festivales junto a leyendas como Daddy Yankee o Don Omar. Su técnica impecable y lectura de pista garantizan sesiones explosivas. El activo estratégico para asegurar el éxito en cualquier cabina de alto nivel.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const profiles = ((await redis.get(PROFILES_KEY)) || {}) as Record<string, any>;
    const fixed: string[] = [];

    for (const [id, newBio] of Object.entries(BIO_FIXES)) {
      if (profiles[id]) {
        const oldBio = profiles[id].bio || '';
        if (oldBio !== newBio) {
          profiles[id].bio = newBio;
          fixed.push(`${id}: "${oldBio}" -> "${newBio}"`);
        }
      }
    }

    if (fixed.length > 0) {
      await redis.set(PROFILES_KEY, profiles);
    }

    return res.status(200).json({ fixed, message: fixed.length > 0 ? 'Bios corregidos' : 'Nada que corregir' });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message });
  }
}
