// Cálculos de la pestaña Acciones por escenario. Funciones puras.
import { numero } from '../riesgo/estres'
import type { EscenarioAcciones } from './escenarios'
import type { Accion, Grupo } from './universo'

/** Movimientos de las cinco palancas que fija un escenario. */
export type Palancas = Pick<EscenarioAcciones, 'riesgoPais' | 'spx' | 'tasas' | 'petroleo' | 'dolar'>

/**
 * Variación estimada en dólares (0,221 = +22,1%):
 * r = rp·(−ΔRP/100) + beta·ΔSPX + tasas·(ΔT/100) + oil·ΔBrent + dolar·(ΔFX/10), acotada en −90%.
 */
export function retAccion(a: Accion, e: Palancas): number {
  const pct =
    a.rp * (-(e.riesgoPais || 0) / 100) +
    a.beta * (e.spx || 0) +
    a.tasas * ((e.tasas || 0) / 100) +
    a.oil * (e.petroleo || 0) +
    a.dolar * ((e.dolar || 0) / 10)
  return Math.max(-0.9, pct / 100)
}

export interface ResumenAccion {
  rets: number[]
  esperado: number
  peor: number
  puntaje: number
}

const probValida = (e: { prob: number }) => Math.max(0, e.prob || 0)

/** Esperado ponderado por probabilidad (proporcional si no suman 100), peor caso y puntaje. */
export function resumenAccion(a: Accion, escs: readonly EscenarioAcciones[]): ResumenAccion {
  const tot = escs.reduce((s, e) => s + probValida(e), 0) || 1
  const rets = escs.map((e) => retAccion(a, e))
  const esperado = escs.reduce((s, e, i) => s + (rets[i] * probValida(e)) / tot, 0)
  const peor = rets.length ? Math.min(...rets) : 0
  return { rets, esperado, peor, puntaje: esperado + 0.5 * Math.min(0, peor) }
}

export interface FilaAccion extends ResumenAccion {
  a: Accion
}

export function filasGrupo(universo: readonly Accion[], grupo: Grupo, escs: readonly EscenarioAcciones[]): FilaAccion[] {
  return universo.filter((a) => a.grupo === grupo).map((a) => ({ a, ...resumenAccion(a, escs) }))
}

/** Selección equilibrada: las cuatro de mayor puntaje = esperado + 0,5 · mín(0, peor caso). */
export const seleccionEquilibrada = (filas: readonly FilaAccion[], n = 4) => filas.slice().sort((x, y) => y.puntaje - x.puntaje).slice(0, n)

/** Las tres de mayor variación en el escenario i. */
export const mejoresEnEscenario = (filas: readonly FilaAccion[], i: number, n = 3) => filas.slice().sort((x, y) => y.rets[i] - x.rets[i]).slice(0, n)

/** Pesos iguales con un decimal que suman 100 (el resto va a la primera). */
export function pesosIguales(tickers: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {}
  if (!tickers.length) return out
  const w = Math.round(1000 / tickers.length) / 10
  tickers.forEach((t, i) => {
    out[t] = i === 0 ? Math.round((100 - w * (tickers.length - 1)) * 10) / 10 : w
  })
  return out
}

export interface ResultadoSeleccion {
  rets: number[]
  esperado: number
  peor: number
  pesos: { a: Accion; w: number }[]
}

/** Resultado de la selección del usuario en cada escenario. */
export function resultadoSeleccion(sel: Record<string, number>, universo: readonly Accion[], escs: readonly EscenarioAcciones[]): ResultadoSeleccion | null {
  const pares = Object.entries(sel)
    .map(([t, w]) => ({ a: universo.find((x) => x.ticker === t), w: Math.max(0, w || 0) }))
    .filter((x): x is { a: Accion; w: number } => !!x.a)
  const s = pares.reduce((t, x) => t + x.w, 0)
  if (!s || !escs.length) return null
  const pesos = pares.map((x) => ({ a: x.a, w: x.w / s }))
  const rets = escs.map((e) => pesos.reduce((t, x) => t + x.w * retAccion(x.a, e), 0))
  const tot = escs.reduce((t, e) => t + probValida(e), 0) || 1
  return { rets, esperado: rets.reduce((t, r, i) => t + (r * probValida(escs[i])) / tot, 0), peor: Math.min(...rets), pesos }
}

/** Limpia escenarios que vienen del agente o del navegador y aplica las probabilidades editadas. */
export function normalizarEscenarios(lista: readonly unknown[], prefijo: string, probs: Record<string, number>): (EscenarioAcciones & { clave: string; probBase: number })[] {
  return lista.slice(0, 6).map((crudo, i) => {
    const e = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>
    const id = String(e.id || 'e' + i)
    const clave = prefijo + ':' + id
    const probBase = numero(e.prob, 0, 100)
    return {
      id,
      clave,
      nombre: String(e.nombre || 'Escenario ' + (i + 1)),
      descripcion: String(e.descripcion || ''),
      senales: Array.isArray(e.senales) ? e.senales.slice(0, 3).map(String) : [],
      riesgoPais: numero(e.riesgoPais, -1500, 3000),
      spx: numero(e.spx, -60, 60),
      tasas: numero(e.tasas, -300, 300),
      petroleo: numero(e.petroleo, -80, 150),
      dolar: numero(e.dolar, -50, 200),
      probBase,
      prob: probs[clave] != null ? numero(probs[clave], 0, 100) : probBase,
    }
  })
}
