// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import dotenv from 'dotenv';

// dotenv.config(); // Load .env file

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     // 👇 this fixes 404 on refresh (SPA fallback)
//     historyApiFallback: true
//   },
//   define: {
//     'process.env': process.env
//   }
// });


// /** @type {import('tailwindcss').Config} */
// export default {
//   content: [
//     "./index.html",
//     "./src/**/*.{js,ts,jsx,tsx}"
//   ],
//   theme: {
//     extend: {},
//   },
//   plugins: [],
// };

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: 'react',
      jsxRuntime: 'automatic'
    })
  ],
  optimizeDeps: {
    include: ['qrcode.react'],
  },
  server: {
    host: "localhost",   // allow external access
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000", // your backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
