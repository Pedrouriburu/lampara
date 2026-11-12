// Forma de la edición diaria que publica el agente (tabla `ediciones`).
// El esquema estricto con el que el agente valida antes de escribir está en agente/esquema.mjs;
// la app es tolerante al leer: acota números y descarta lo que no entiende.

export interface Noticia {
  id?: string
  titulo: string
  ambito?: string
  fuente?: string
  url?: string
  resumen?: string
  canal?: string
  factorAR?: number
  factorGlobal?: number
  ajustes?: Record<string, number>
  horizonte?: string
  confianza?: string
  /** Solo en noticias analizadas a pedido del usuario. */
  explicacion?: string
}

export interface Edicion {
  fecha: string
  generada?: string
  panorama?: string
  escenario?: { factorAR?: number; factorGlobal?: number; explicacion?: string }
  items: Noticia[]
  escenariosAcciones?: unknown[]
  fuentes?: { portal: string; url: string }[]
  /** Verdadero en la edición de ejemplo incluida en el código: no son noticias reales. */
  esEjemplo?: boolean
}

export const urlSegura = (u: unknown): string => (/^https:\/\//i.test(String(u || '')) ? String(u) : '')
