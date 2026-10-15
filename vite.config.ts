import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const firebaseAuthDomain =
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    (env.VITE_FIREBASE_PROJECT_ID ? `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : 'localhost');

  return {
    plugins: [
      react(),
      basicSsl()
    ],
    server: {
      proxy: {
        "/__/auth": {
          target: `https://${firebaseAuthDomain}`,
          changeOrigin: true,
        }
      }
    }
  };
});
