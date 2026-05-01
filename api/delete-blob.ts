import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}function verifyCollabToken(h:string|undefined):{valid:boolean}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('collab.'))return{valid:false};const s=process.env.ADMIN_SECRET||'dev-secret';const p=t.split('.');if(p.length!==4)return{valid:false};const[,cid,ts,hm]=p;if(!cid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return{valid:false};const py=`collab.${cid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true};}catch{return{valid:false};}}function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = 'musicdrop';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Admin or collaborator auth required
  if (!verifyAdminToken(req.headers.authorization) && !verifyCollabToken(req.headers.authorization).valid) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Falta la URL del archivo' });
    }

    // Only allow deleting R2 or legacy Vercel Blob URLs
    if (!url.includes('.r2.dev') && !url.includes('.r2.cloudflarestorage.com') && !url.includes('.vercel-storage.com')) {
      return res.status(400).json({ error: 'URL no válida' });
    }

    // Extract the key from the R2 public URL
    const r2PublicBase = process.env.R2_PUBLIC_URL || '';
    if (url.startsWith(r2PublicBase)) {
      const key = url.slice(r2PublicBase.length + 1); // +1 for the /
      await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    }

    return res.status(200).json({ deleted: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Error al eliminar archivo' });
  }
}
