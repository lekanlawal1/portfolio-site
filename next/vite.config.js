import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fonts stay as separate cached files instead of being inlined into the CSS.
export default defineConfig({ base: './', plugins: [react()], build: { assetsInlineLimit: 0 } });
