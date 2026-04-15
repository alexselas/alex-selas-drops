import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}function verifyCollabToken(h:string|undefined):{valid:boolean;collaboratorId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('collab.'))return{valid:false};const s=process.env.ADMIN_SECRET||'dev-secret';const p=t.split('.');if(p.length!==4)return{valid:false};const[,cid,ts,hm]=p;if(!cid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return{valid:false};const py=`collab.${cid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,collaboratorId:cid};}catch{return{valid:false};}}function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','http://localhost:3000'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Admin-Edit-Collab'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

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

      const profileData = {
        bio: (bio || '').substring(0, 300),
        photoUrl: photoUrl || '',
        bannerUrl: bannerUrl || '',
        artistName: (artistName || '').substring(0, 50),
        socialLinks: socialLinks || {},
        colorPrimary: colorPrimary || '#FACC15',
        colorSecondary: colorSecondary || '#EAB308',
      };

      // Check if artistName changed → update collaboratorId (slug) everywhere
      const newSlug = artistName ? toSlug(artistName) : '';
      let finalId = targetId;

      if (newSlug && newSlug !== targetId) {
        const profiles = ((await redis.get(PROFILES_KEY)) || {}) as Record<string, any>;

        // Check slug not taken by another collaborator
        if (profiles[newSlug] && newSlug !== targetId) {
          // Append number to make unique
          let n = 2;
          while (profiles[`${newSlug}-${n}`]) n++;
          finalId = `${newSlug}-${n}`;
        } else {
          finalId = newSlug;
        }

        // Move profile to new key
        delete profiles[targetId];
        profiles[finalId] = profileData;
        await redis.set(PROFILES_KEY, profiles);

        // Update account collaboratorId
        const accounts = ((await redis.get(ACCOUNTS_KEY)) || []) as any[];
        const acc = accounts.find((a: any) => a.collaboratorId === targetId);
        if (acc) {
          acc.collaboratorId = finalId;
          await redis.set(ACCOUNTS_KEY, accounts);
        }

        // Update all tracks with old collaboratorId
        const tracks = ((await redis.get(TRACKS_KEY)) || []) as any[];
        let tracksChanged = false;
        for (const t of tracks) {
          if (t.collaboratorId === targetId) {
            t.collaboratorId = finalId;
            t.artist = artistName || t.artist;
            tracksChanged = true;
          }
        }
        if (tracksChanged) await redis.set(TRACKS_KEY, tracks);

        return res.status(200).json({ ...profileData, newCollaboratorId: finalId });
      }

      // No slug change — just update profile
      const profiles = ((await redis.get(PROFILES_KEY)) || {}) as Record<string, any>;
      profiles[targetId] = profileData;
      await redis.set(PROFILES_KEY, profiles);

      return res.status(200).json(profileData);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Collab profile error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
