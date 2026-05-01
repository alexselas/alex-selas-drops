import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}function verifyCollabToken(h:string|undefined):{valid:boolean;collaboratorId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('collab.'))return{valid:false};const s=process.env.ADMIN_SECRET||'';const p=t.split('.');if(p.length!==4)return{valid:false};const[,cid,ts,hm]=p;if(!cid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return{valid:false};const py=`collab.${cid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,collaboratorId:cid};}catch{return{valid:false};}}function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Admin-Edit-Collab'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const PROFILES_KEY = 'collab-profiles';
const ACCOUNTS_KEY = 'collab-accounts';
const TRACKS_KEY = 'tracks';

function toSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collab';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — public
    if (req.method === 'GET') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: 'Falta id' });

      const profiles = ((await redis.get(PROFILES_KEY)) || {}) as Record<string, any>;
      const profile = profiles[id];
      if (!profile) return res.status(200).json(null);
      return res.status(200).json(profile);
    }

    // PUT — authenticated collaborator OR admin
    if (req.method === 'PUT') {
      let targetId = '';

      // Check if admin is editing a collaborator's profile
      const isAdmin = verifyAdminToken(req.headers.authorization);
      const adminEditCollab = req.headers['x-admin-edit-collab'] as string;

      if (isAdmin && adminEditCollab) {
        targetId = adminEditCollab;
      } else {
        const collab = verifyCollabToken(req.headers.authorization);
        if (!collab.valid || !collab.collaboratorId) {
          return res.status(401).json({ error: 'No autorizado' });
        }
        targetId = collab.collaboratorId;
      }

      const { bio, photoUrl, bannerUrl, artistName, socialLinks, colorPrimary, colorSecondary } = req.body;

      // Validate social links — only allow https:// URLs from known domains
      const allowedDomains = ['instagram.com', 'soundcloud.com', 'spotify.com', 'youtube.com', 'twitter.com', 'x.com', 'facebook.com', 'tiktok.com', 'mixcloud.com', 'beatport.com', 'bandcamp.com', 'apple.com', 'music.apple.com', 'linktr.ee', 'open.spotify.com'];
      let safeSocialLinks: Record<string, string> = {};
      if (socialLinks && typeof socialLinks === 'object') {
        for (const [key, val] of Object.entries(socialLinks)) {
          const url = String(val || '').trim();
          if (!url) continue;
          if (!url.startsWith('https://')) continue;
          if (url.toLowerCase().startsWith('javascript:')) continue;
          try {
            const hostname = new URL(url).hostname.replace(/^www\./, '');
            if (allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d))) {
              safeSocialLinks[key.substring(0, 30)] = url.substring(0, 500);
            }
          } catch { /* invalid URL, skip */ }
        }
      }

      // Validate image URLs: only allow R2 or Vercel storage URLs
      function validateImageUrl(url: string): string {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim().substring(0, 2000);
        if (!trimmed) return '';
        try {
          const parsed = new URL(trimmed);
          const hostname = parsed.hostname;
          if (hostname.endsWith('.r2.dev') || hostname.endsWith('.r2.cloudflarestorage.com') || hostname.endsWith('.vercel-storage.com') || hostname.endsWith('.public.blob.vercel-storage.com')) {
            return trimmed;
          }
        } catch {}
        return '';
      }

      // Validate color format
      function validateColor(c: string, fallback: string): string {
        if (!c || typeof c !== 'string') return fallback;
        return /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
      }

      const profileData = {
        bio: (bio || '').substring(0, 300),
        photoUrl: validateImageUrl(photoUrl),
        bannerUrl: validateImageUrl(bannerUrl),
        artistName: (artistName || '').substring(0, 50),
        socialLinks: safeSocialLinks,
        colorPrimary: validateColor(colorPrimary, '#FACC15'),
        colorSecondary: validateColor(colorSecondary, '#EAB308'),
      };

      // Save profile (collaboratorId never changes — fixed at registration)
      const profiles = ((await redis.get(PROFILES_KEY)) || {}) as Record<string, any>;
      profiles[targetId] = profileData;
      await redis.set(PROFILES_KEY, profiles);

      // Sync artist name to all tracks + account
      if (artistName) {
        const tracks = ((await redis.get(TRACKS_KEY)) || []) as any[];
        let tracksChanged = false;
        for (const t of tracks) {
          if (t.collaboratorId === targetId && t.artist !== artistName) {
            t.artist = artistName;
            tracksChanged = true;
          }
        }
        if (tracksChanged) await redis.set(TRACKS_KEY, tracks);

        const accounts = ((await redis.get(ACCOUNTS_KEY)) || []) as any[];
        const acc = accounts.find((a: any) => a.collaboratorId === targetId);
        if (acc && acc.artistName !== artistName) {
          acc.artistName = artistName;
          await redis.set(ACCOUNTS_KEY, accounts);
        }
      }

      return res.status(200).json(profileData);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Collab profile error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
