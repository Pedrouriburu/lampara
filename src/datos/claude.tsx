// Explicaciones con Claude. La app nunca ve la clave: llama a la Edge Function `explicar` de Supabase.
// Si la función no está desplegada, no tiene clave o no hay sesión, `disponible` es falso y los botones se ocultan.
import { createContext, useContext, type ReactNode } from 'react'
import type { Noticia } from '../noticias/tipos'

export interface DatosExplicar {
  noticia: Pick<Noticia, 'titulo' | 'resumen' | 'canal' | 'factorAR' | 'factorGlobal'>
  /** Composición de la cartera, una línea por rubro. */
  cartera: string
  /** Impacto que calculó el modelo, en texto. */
  impacto: string
}

export interface DatosAnalizar {
  texto: string
  cartera: string
}

export interface DatosLectura {
  grupo: string
  escenarios: string
  resultados: string
  equilibrada: string
  seleccion: string
}

export interface Claude {
  disponible: boolean
  /** Motivo por el que no está disponible, para mostrarlo en una línea. */
  motivo: string | null
  explicar: (d: DatosExplicar, signal?: AbortSignal) => Promise<string>
  analizar: (d: DatosAnalizar, signal?: AbortSignal) => Promise<Noticia>
  lectura: (d: DatosLectura, signal?: AbortSignal) => Promise<string>
}

const noDisponible = () => Promise.reject(new Error('Claude no está disponible.'))

export const CLAUDE_APAGADO: Claude = {
  disponible: false,
  motivo: 'Las explicaciones con Claude se activan al cargar las claves (ver PENDIENTES.md).',
  explicar: noDisponible,
  analizar: noDisponible,
  lectura: noDisponible,
}

export const CtxClaude = createContext<Claude>(CLAUDE_APAGADO)

export function ProveedorClaude({ children }: { children: ReactNode }) {
  return <CtxClaude.Provider value={CLAUDE_APAGADO}>{children}</CtxClaude.Provider>
}

// oxlint-disable-next-line react/only-export-components
export const useClaude = () => useContext(CtxClaude)
