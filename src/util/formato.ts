// Formato de cifras en castellano rioplatense (es-AR): miles con punto, decimales con coma.
import type { Moneda } from '../riesgo/tipos'

const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const entero = (x: number) => nf0.format(x)
export const decimal1 = (x: number) => nf1.format(x)
const signo = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '')

/** 0,123 -> "12,3%" */
export const pct = (x: number) => nf1.format(x * 100) + '%'
/** 0,123 -> "+12,3%" ; -0,05 -> "−5,0%" */
export const pctS = (x: number) => signo(x) + nf1.format(Math.abs(x * 100)) + '%'
/** 0,4 -> "+0,4" (para factores en desvíos) */
export const conSigno1 = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + nf1.format(Math.abs(x))
/** Siempre en dólares, sin importar la moneda visible. */
export const enDolares = (x: number) => 'US$ ' + nf0.format(Math.round(x))
/** Montos grandes para ejes: 1.500.000 -> "1,5 M". */
export const compacto = (v: number) =>
  v >= 1e9 ? nf1.format(v / 1e9) + ' mil M' : v >= 1e6 ? nf1.format(v / 1e6) + ' M' : nf0.format(v / 1000) + ' mil'

export interface FormatoMoneda {
  /** Factor que pasa de dólares a la moneda visible. */
  k: number
  simbolo: string
  /** Monto en dólares -> texto en la moneda visible. */
  monto: (usd: number) => string
  /** Igual, con signo explícito. */
  montoS: (usd: number) => string
}

/** Todo se calcula en dólares; si la vista está en pesos se multiplica por el MEP. */
export function formatoMoneda(moneda: Moneda, mep: number): FormatoMoneda {
  const k = moneda === 'ARS' ? mep : 1
  const simbolo = moneda === 'ARS' ? '$' : 'US$'
  return {
    k,
    simbolo,
    monto: (usd) => simbolo + ' ' + nf0.format(Math.round(usd * k)),
    montoS: (usd) => signo(usd) + simbolo + ' ' + nf0.format(Math.abs(Math.round(usd * k))),
  }
}

// Lámpara habla de Argentina: las fechas y horas se muestran siempre en hora de Buenos Aires.
const ZONA = 'America/Argentina/Buenos_Aires'

export function fechaLarga(f: string): string {
  try {
    return new Date(f + 'T12:00:00-03:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA })
  } catch {
    return f
  }
}

export function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA })
  } catch {
    return iso
  }
}

export function horaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA })
  } catch {
    return ''
  }
}
