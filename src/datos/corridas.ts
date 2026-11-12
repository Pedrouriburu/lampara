// Corridas guardadas: una foto de la cartera y de sus métricas en un momento dado.
import type { Moneda, OpcionesSimulacion, Porcentajes, ResultadoSimulacion } from '../riesgo'

export interface Corrida {
  id: string
  /** Fecha y hora en ISO. */
  fecha: string
  opciones: OpcionesSimulacion & { totalUsd: number; pct: Porcentajes; mep: number; moneda: Moneda }
  resultados: Pick<ResultadoSimulacion, 'total0' | 'var95' | 'var99' | 'cvar95' | 'mediana' | 'p5' | 'p95' | 'probPerdida' | 'caidaTipica'>
}

export function armarCorrida(r: ResultadoSimulacion, opciones: OpcionesSimulacion, cartera: { totalUsd: number; pct: Porcentajes; mep: number; moneda: Moneda }): Omit<Corrida, 'id'> {
  return {
    fecha: new Date().toISOString(),
    opciones: { ...opciones, ...cartera },
    resultados: { total0: r.total0, var95: r.var95, var99: r.var99, cvar95: r.cvar95, mediana: r.mediana, p5: r.p5, p95: r.p95, probPerdida: r.probPerdida, caidaTipica: r.caidaTipica },
  }
}

const CLAVE = 'lampara-corridas'
const MAXIMO = 60

export function esCorrida(x: unknown): x is Corrida {
  if (!x || typeof x !== 'object') return false
  const c = x as Record<string, unknown>
  const r = c.resultados as Record<string, unknown> | undefined
  const o = c.opciones as Record<string, unknown> | undefined
  return typeof c.id === 'string' && typeof c.fecha === 'string' && !!r && typeof r.total0 === 'number' && typeof r.var95 === 'number' && !!o && typeof o.totalUsd === 'number'
}

export function leerCorridasLocales(): Corrida[] {
  try {
    const j = JSON.parse(localStorage.getItem(CLAVE) || '[]')
    return Array.isArray(j) ? j.filter(esCorrida) : []
  } catch {
    return []
  }
}

export function guardarCorridasLocales(lista: Corrida[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAXIMO)))
  } catch {
    /* sin almacenamiento */
  }
}

export const idLocal = () => 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
