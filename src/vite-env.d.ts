/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLIC_KEY: string;
  readonly VITE_PAYPAL_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
