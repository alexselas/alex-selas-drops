import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Plugin para guardar archivos en local durante desarrollo
function localUploadPlugin(): Plugin {
  return {
    name: 'local-upload',
    configureServer(server) {
      server.middlewares.use('/api/upload', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Folder');
          res.statusCode = 200;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const filename = req.headers['x-filename'] as string;
        const folder = (req.headers['x-folder'] as string) || 'uploads';
        const chunks: Buffer[] = [];

        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          const dir = path.resolve(__dirname, 'public', folder);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          const safeName = `${Date.now()}-${filename}`;
          const filePath = path.join(dir, safeName);
          fs.writeFileSync(filePath, Buffer.concat(chunks));

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ url: `/${folder}/${safeName}`, pathname: `${folder}/${safeName}` }));
        });
      });

      // Local AI description proxy
      server.middlewares.use('/api/generate-description', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 200;
          res.end();
          return;
        }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const env = loadEnv('development', '.', '');
            const GEMINI_KEY = env.GEMINI_API_KEY || '';

            const prompt = `Eres un copywriter experto en música electrónica y DJ culture. Genera una descripción comercial atractiva en español para vender este track en una tienda online.\n\nDatos:\n- Título: ${body.title}\n- Productor: ${body.artist}\n${body.authors ? `- Artistas originales: ${body.authors}\n` : ''}- Categoría: ${body.category}\n- Género: ${body.genre}\n${body.bpm ? `- BPM: ${body.bpm}\n` : ''}${body.userDescription ? `- Notas: ${body.userDescription}\n` : ''}\nReglas: Máximo 2-3 frases. Tono profesional. Menciona estilo y momento ideal. Sin emojis. Solo la descripción.`;

            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
                }),
              }
            );
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ description: text.trim() }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss(), localUploadPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        // Proxy API calls to Vercel deployment (tracks, orders, etc.)
        '/api/tracks': {
          target: 'https://alex-selas-drops.vercel.app',
          changeOrigin: true,
        },
        '/api/orders': {
          target: 'https://alex-selas-drops.vercel.app',
          changeOrigin: true,
        },
        // Proxy media files (covers, previews, tracks) to Vercel
        '/covers': {
          target: 'https://alex-selas-drops.vercel.app',
          changeOrigin: true,
        },
        '/previews': {
          target: 'https://alex-selas-drops.vercel.app',
          changeOrigin: true,
        },
        '/tracks': {
          target: 'https://alex-selas-drops.vercel.app',
          changeOrigin: true,
        },
      },
    },
  };
});
