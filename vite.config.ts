/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// La app se publica en GitHub Pages bajo /lampara/. Con base relativa funciona
// igual en esa ruta, en la raíz y en `npm run preview`.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'agente/**/*.test.mjs', 'supabase/**/*.test.mjs'],
    testTimeout: 30000,
  },
})
