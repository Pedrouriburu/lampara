// Cliente de Supabase. Si faltan las claves, `supabase` es null y la app queda en modo de demostración.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const clave = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const supabase: SupabaseClient | null =
  url && clave
    ? createClient(url, clave, {
        auth: {
          // Flujo implícito: el enlace del mail funciona aunque se abra en otro navegador
          // (pasa en el iPhone cuando la app está instalada en la pantalla de inicio).
          flowType: 'implicit',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null

export const hayNube = supabase !== null
