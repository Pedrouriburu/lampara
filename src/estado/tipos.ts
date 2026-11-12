import { copiaUniverso, type Accion, type Grupo } from '../acciones/universo'
import { CARTERA_EJEMPLO, copiaRubros, MEP_REFERENCIA, pctDeMontos, RUBRO_IDS, type Moneda, type Porcentajes, type Rubro } from '../riesgo'

export type OrigenMep = 'referencia' | 'api' | 'agente' | 'manual'
export type Seleccion = Record<Grupo, Record<string, number>>

/** Todo lo que el usuario puede cambiar. Se guarda en el navegador y, con cuenta, en Supabase. */
export interface EstadoApp {
  /** Monto total de la cartera, siempre en dólares. */
  totalUsd: number
  pct: Porcentajes
  esEjemplo: boolean
  moneda: Moneda
  mep: number
  mepOrigen: OrigenMep
  mepFecha: string | null
  anios: number
  crisisActiva: boolean
  probCrisis: number
  semilla: number
  rubros: Rubro[]
  universo: Accion[]
  grupo: Grupo
  sel: Seleccion
  selEjemplo: boolean
  /** Probabilidades editadas, por clave "<edición>:<escenario>". */
  probs: Record<string, number>
}

export const TOTAL_EJEMPLO = Object.values(CARTERA_EJEMPLO).reduce((s, x) => s + x, 0)
export const SEL_EJEMPLO: Seleccion = { merval: { GGAL: 30, YPFD: 40, PAMP: 30 }, cedears: { SPY: 50, AAPL: 25, KO: 25 } }
export const copiaSelEjemplo = (): Seleccion => ({ merval: { ...SEL_EJEMPLO.merval }, cedears: { ...SEL_EJEMPLO.cedears } })

export function estadoInicial(): EstadoApp {
  return {
    totalUsd: TOTAL_EJEMPLO,
    pct: pctDeMontos(CARTERA_EJEMPLO),
    esEjemplo: true,
    moneda: 'ARS',
    mep: MEP_REFERENCIA,
    mepOrigen: 'referencia',
    mepFecha: null,
    anios: 3,
    crisisActiva: true,
    probCrisis: 0.08,
    semilla: 42,
    rubros: copiaRubros(),
    universo: copiaUniverso(),
    grupo: 'merval',
    sel: copiaSelEjemplo(),
    selEjemplo: true,
    probs: {},
  }
}

const num = (x: unknown, lo: number, hi: number, def: number) => {
  const v = typeof x === 'number' ? x : NaN
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def
}

function mapaNumeros(x: unknown, hi: number): Record<string, number> {
  const out: Record<string, number> = {}
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(hi, Math.max(0, v))
  return out
}

/** Reconstruye un estado válido a partir de lo guardado (navegador o Supabase), tolerando datos viejos o rotos. */
export function restaurar(crudo: unknown): EstadoApp {
  const base = estadoInicial()
  if (!crudo || typeof crudo !== 'object') return base
  const g = crudo as Record<string, unknown>
  const e: EstadoApp = { ...base }
  e.totalUsd = num(g.totalUsd, 0, 1e13, base.totalUsd)
  if (g.pct && typeof g.pct === 'object') {
    const p = mapaNumeros(g.pct, 100)
    const pct = {} as Porcentajes
    for (const id of RUBRO_IDS) pct[id] = p[id] ?? 0
    e.pct = pct
  }
  e.esEjemplo = !!g.esEjemplo
  e.moneda = g.moneda === 'USD' ? 'USD' : 'ARS'
  e.mep = num(g.mep, 100, 1e7, base.mep)
  e.mepOrigen = g.mepOrigen === 'manual' ? 'manual' : 'referencia'
  e.anios = [1, 2, 3, 5].includes(g.anios as number) ? (g.anios as number) : 3
  e.crisisActiva = g.crisisActiva !== false
  e.probCrisis = num(g.probCrisis, 0, 0.5, 0.08)
  e.semilla = num(g.semilla, 1, 2147483646, 42)
  if (Array.isArray(g.rubros)) {
    e.rubros = base.rubros.map((r) => {
      const s = (g.rubros as Record<string, unknown>[]).find((x) => x && x.id === r.id)
      if (!s) return r
      return {
        ...r,
        ret: num(s.ret, -0.9, 2, r.ret),
        vol: num(s.vol, 0, 2, r.vol),
        betaAr: num(s.betaAr, -1, 1, r.betaAr),
        betaGlobal: num(s.betaGlobal, -1, 1, r.betaGlobal),
        golpeCrisis: num(s.golpeCrisis, -0.95, 1, r.golpeCrisis),
      }
    })
  }
  if (Array.isArray(g.universo)) {
    e.universo = base.universo.map((a) => {
      const s = (g.universo as Record<string, unknown>[]).find((x) => x && x.ticker === a.ticker)
      if (!s) return a
      return { ...a, rp: num(s.rp, -50, 50, a.rp), beta: num(s.beta, -5, 5, a.beta), tasas: num(s.tasas, -50, 50, a.tasas), oil: num(s.oil, -5, 5, a.oil), dolar: num(s.dolar, -50, 50, a.dolar) }
    })
  }
  e.grupo = g.grupo === 'cedears' ? 'cedears' : 'merval'
  if (g.sel && typeof g.sel === 'object') {
    const s = g.sel as Record<string, unknown>
    e.sel = { merval: mapaNumeros(s.merval, 100), cedears: mapaNumeros(s.cedears, 100) }
  }
  e.selEjemplo = !!g.selEjemplo
  e.probs = mapaNumeros(g.probs, 100)
  return e
}

/** Lo que se guarda: todo menos la cotización del día, que se vuelve a pedir. */
export function paraGuardar(e: EstadoApp): Record<string, unknown> {
  const { mepFecha: _f, ...resto } = e
  return { ...resto, mepOrigen: e.mepOrigen === 'manual' ? 'manual' : 'referencia', mep: e.mepOrigen === 'manual' ? e.mep : undefined }
}
