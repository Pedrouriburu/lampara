// Explicaciones automáticas (Groq). La app nunca ve la clave: llama a la Edge Function `explicar` de Supabase.
// Si la función no está desplegada, no tiene clave o no hay sesión, `disponible` es falso y los botones se ocultan.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Noticia } from '../noticias/tipos'
import { numero } from '../riesgo'
import { useSesion } from './sesion'
import { supabase } from './supabase'

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

const GENERICO = 'No se pudo completar el análisis. Probá de nuevo.'

/** Llama a la función y traduce cualquier falla a un mensaje para el usuario. */
async function invocar(cuerpo: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('Las explicaciones no están disponibles.')
  const { data, error } = await supabase.functions.invoke('explicar', { body: cuerpo, signal })
  if (error) {
    let mensaje = GENERICO
    const contexto = (error as { context?: unknown }).context
    if (contexto instanceof Response) {
      try {
        const j = (await contexto.json()) as { mensaje?: unknown }
        if (typeof j.mensaje === 'string' && j.mensaje) mensaje = j.mensaje
      } catch {
        /* la respuesta no era JSON: queda el mensaje genérico */
      }
    }
    throw new Error(mensaje)
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

const texto = (r: Record<string, unknown>): string => {
  if (typeof r.texto !== 'string' || !r.texto.trim()) throw new Error(GENERICO)
  return r.texto.trim()
}

const cadena = (x: unknown) => (typeof x === 'string' ? x : '')

/** La noticia analizada vuelve de la función ya acotada; acá se vuelve a acotar por las dudas. */
function aNoticia(r: Record<string, unknown>): Noticia {
  const j = r.noticia && typeof r.noticia === 'object' ? (r.noticia as Record<string, unknown>) : null
  if (!j || !cadena(j.titulo)) throw new Error('No pude convertir la respuesta en un escenario. Probá con un texto más concreto.')
  const ajustes: Record<string, number> = {}
  if (j.ajustes && typeof j.ajustes === 'object') for (const [k, v] of Object.entries(j.ajustes)) ajustes[k] = numero(v, -0.1, 0.1)
  return {
    titulo: cadena(j.titulo).slice(0, 140),
    ambito: j.ambito === 'Mundo' ? 'Mundo' : 'Argentina',
    resumen: cadena(j.resumen),
    canal: cadena(j.canal),
    factorAR: numero(j.factorAR, -3, 3),
    factorGlobal: numero(j.factorGlobal, -3, 3),
    ajustes,
    horizonte: cadena(j.horizonte),
    confianza: cadena(j.confianza),
    explicacion: cadena(j.explicacion),
    fuente: 'Analizada por vos',
  }
}

const noDisponible = () => Promise.reject(new Error('Las explicaciones no están disponibles.'))

const CtxClaude = createContext<Claude>({ disponible: false, motivo: null, explicar: noDisponible, analizar: noDisponible, lectura: noDisponible })

type EstadoClave = 'sin-nube' | 'averiguando' | 'con-clave' | 'sin-clave'

export function ProveedorClaude({ children }: { children: ReactNode }) {
  const { modo } = useSesion()
  const [clave, setClave] = useState<EstadoClave>(supabase ? 'averiguando' : 'sin-nube')

  // ¿La función existe y tiene cargada la clave del modelo? Se pregunta al abrir y de nuevo al entrar o salir.
  useEffect(() => {
    if (!supabase) return
    let vigente = true
    invocar({ tipo: 'estado' })
      .then((r) => vigente && setClave(r.disponible === true ? 'con-clave' : 'sin-clave'))
      .catch(() => vigente && setClave('sin-clave'))
    return () => {
      vigente = false
    }
  }, [modo])

  const valor = useMemo<Claude>(() => {
    const disponible = clave === 'con-clave' && modo === 'cuenta'
    const motivo =
      clave === 'con-clave' && modo !== 'cuenta'
        ? 'Entrá con tu mail para pedir una explicación de las noticias para tu cartera.'
        : clave === 'sin-clave' || clave === 'sin-nube'
          ? 'Las explicaciones automáticas se activan al cargar la clave del modelo (los pasos están en PENDIENTES.md). El resto funciona igual.'
          : null
    if (!disponible) return { disponible, motivo, explicar: noDisponible, analizar: noDisponible, lectura: noDisponible }
    return {
      disponible,
      motivo: null,
      explicar: async (d, signal) => texto(await invocar({ tipo: 'explicar', ...d }, signal)),
      analizar: async (d, signal) => aNoticia(await invocar({ tipo: 'analizar', ...d }, signal)),
      lectura: async (d, signal) => texto(await invocar({ tipo: 'lectura', ...d }, signal)),
    }
  }, [clave, modo])

  return <CtxClaude.Provider value={valor}>{children}</CtxClaude.Provider>
}

// oxlint-disable-next-line react/only-export-components
export const useClaude = () => useContext(CtxClaude)
