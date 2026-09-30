import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl()
  ],
  server: {
    proxy: {
      "/__/auth": {
        target: "https://fde-capstone-510119.firebaseapp.com",
        changeOrigin: true,
      }
    }
  }
});
