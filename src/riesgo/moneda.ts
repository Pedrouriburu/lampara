// Conversión entre la moneda visible y los dólares en que se guarda y se calcula todo.
import { RUBRO_IDS } from './supuestos'
import type { Moneda, Montos, Porcentajes } from './tipos'

/** Monto cargado en la moneda visible -> dólares (lo que se guarda). */
export const aDolares = (monto: number, moneda: Moneda, mep: number) => (moneda === 'ARS' ? monto / mep : monto)
/** Dólares guardados -> moneda visible. */
export const aVisible = (usd: number, moneda: Moneda, mep: number) => (moneda === 'ARS' ? usd * mep : usd)

export const sumaPct = (pct: Partial<Porcentajes>) => RUBRO_IDS.reduce((s, id) => s + Math.max(0, pct[id] || 0), 0)

/** Reparte el total según los porcentajes (en proporción si no suman 100). */
export function montosDesdePct(totalUsd: number, pct: Partial<Porcentajes>): Montos {
  const s = sumaPct(pct)
  const out = {} as Montos
  for (const id of RUBRO_IDS) out[id] = s > 0 ? (totalUsd * Math.max(0, pct[id] || 0)) / s : 0
  return out
}

/** Porcentajes con un decimal a partir de montos. */
export function pctDeMontos(m: Partial<Montos>): Porcentajes {
  const t = RUBRO_IDS.reduce((s, id) => s + Math.max(0, m[id] || 0), 0) || 1
  const out = {} as Porcentajes
  for (const id of RUBRO_IDS) out[id] = Math.round((Math.max(0, m[id] || 0) / t) * 1000) / 10
  return out
}

const r1 = (x: number) => Math.round(x * 10) / 10

/**
 * Lleva un reparto cualquiera a 100% exacto con un decimal.
 * El resto del redondeo va a la posición más grande.
 */
export function ajustarA100<K extends string>(pesos: Record<K, number>): Record<K, number> {
  const claves = Object.keys(pesos) as K[]
  const s = claves.reduce((t, k) => t + Math.max(0, pesos[k] || 0), 0)
  if (!s) return { ...pesos }
  const out = {} as Record<K, number>
  for (const k of claves) out[k] = r1((Math.max(0, pesos[k] || 0) / s) * 100)
  const dif = r1(100 - claves.reduce((t, k) => t + out[k], 0))
  if (dif) {
    const mayor = claves.reduce((m, k) => (out[k] > out[m] ? k : m), claves[0])
    out[mayor] = r1(out[mayor] + dif)
  }
  return out
}
