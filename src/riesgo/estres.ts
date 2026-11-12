// Stress tests: shock instantáneo por rubro y escenario por factores.
import type { Montos, ResultadoEstres, Rubro, RubroId } from './tipos'

export const SHOCK_MIN = -0.95
export const SHOCK_MAX = 3

const acotar = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function estresar(montos: Partial<Montos>, rubros: readonly Rubro[], shocks: Partial<Record<RubroId, number>>): ResultadoEstres {
  const detalle = rubros.map((r) => {
    const monto = Math.max(0, montos[r.id] || 0)
    const shock = shocks[r.id] || 0
    return { id: r.id, monto, shock, pnl: monto * shock }
  })
  const total = detalle.reduce((s, d) => s + d.monto, 0)
  const pnl = detalle.reduce((s, d) => s + d.pnl, 0)
  return { total, pnl, pct: total ? pnl / total : 0, detalle }
}

/** shock = vol · (beta_ar · sA + beta_global · sG), acotado entre −95% y +300%. */
export function shocksPorFactores(rubros: readonly Rubro[], sA: number, sG: number): Record<RubroId, number> {
  const out = {} as Record<RubroId, number>
  for (const r of rubros) out[r.id] = acotar(r.vol * (r.betaAr * sA + r.betaGlobal * sG), SHOCK_MIN, SHOCK_MAX)
  return out
}

/** Número finito dentro de un rango; cualquier otra cosa vale 0. */
export function numero(x: unknown, lo: number, hi: number): number {
  const v = Number(x)
  return Number.isFinite(v) ? acotar(v, lo, hi) : 0
}

export interface ShockNoticia {
  factorAR?: unknown
  factorGlobal?: unknown
  ajustes?: unknown
}

/** Shock de una noticia: factores del modelo más un ajuste propio por rubro. */
export function shocksNoticia(rubros: readonly Rubro[], n: ShockNoticia): Record<RubroId, number> {
  const s = shocksPorFactores(rubros, numero(n.factorAR, -3, 3), numero(n.factorGlobal, -3, 3))
  const aj = n.ajustes && typeof n.ajustes === 'object' ? (n.ajustes as Record<string, unknown>) : {}
  for (const r of rubros) if (aj[r.id] != null) s[r.id] = acotar(s[r.id] + numero(aj[r.id], -0.5, 0.5), SHOCK_MIN, SHOCK_MAX)
  return s
}
