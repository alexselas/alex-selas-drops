import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_STRIPE_PUBLIC_KEY': JSON.stringify(env.VITE_STRIPE_PUBLIC_KEY || ''),
      'import.meta.env.VITE_PAYPAL_CLIENT_ID': JSON.stringify(env.VITE_PAYPAL_CLIENT_ID || 'sb'),
    },
  };
});
