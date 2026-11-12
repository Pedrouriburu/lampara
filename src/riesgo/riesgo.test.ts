import { describe, expect, it } from 'vitest'
import {
  aDolares,
  ajustarA100,
  aVisible,
  CARTERA_EJEMPLO,
  correlacion,
  cuantil,
  ESCENARIOS_HISTORICOS,
  estresar,
  montosDesdePct,
  pctDeMontos,
  probMensual,
  RUBROS_BASE,
  shocksNoticia,
  shocksPorFactores,
  simular,
  sumaPct,
  type Montos,
  type OpcionesSimulacion,
} from './index'

const OPC: OpcionesSimulacion = { anios: 3, caminos: 5000, crisisActiva: true, probCrisis: 0.08, semilla: 42 }
const cero: Montos = { pesos: 0, mep: 0, soberanos: 0, ons: 0, cer: 0, merval: 0, cedears: 0 }

describe('simulación Monte Carlo', () => {
  const r = simular(CARTERA_EJEMPLO, RUBROS_BASE, OPC)

  it('las contribuciones al riesgo suman exactamente el CVaR', () => {
    const suma = r.contribuciones.reduce((s, c) => s + c.monto, 0)
    expect(suma).toBe(r.cvar95)
    expect(r.cvar95).toBeGreaterThan(0)
    // El CVaR mira la cola: no puede ser menor que el VaR del mismo nivel.
    expect(r.cvar95).toBeGreaterThanOrEqual(r.var95)
    expect(r.var99).toBeGreaterThanOrEqual(r.var95)
  })

  it('VaR y CVaR a un mes coinciden con la fórmula lognormal para un rubro solo', () => {
    // Para un solo activo lognormal hay solución cerrada; sirve de control independiente.
    const merval = RUBROS_BASE.find((x) => x.id === 'merval')!
    const s = simular({ ...cero, merval: 1000 }, RUBROS_BASE, { ...OPC, anios: 1, crisisActiva: false })
    const mu = (Math.log(1 + merval.ret) - (merval.vol * merval.vol) / 2) / 12
    const sigma = merval.vol / Math.sqrt(12)
    const z05 = -1.6448536269514722
    // Función de distribución normal (Abramowitz y Stegun 26.2.17, error < 1e-7).
    const phi = (x: number) => {
      const t = 1 / (1 + 0.2316419 * Math.abs(x))
      const d = 0.3989422804014327 * Math.exp((-x * x) / 2)
      const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
      return x >= 0 ? 1 - p : p
    }
    const varTeorico = 1000 * (1 - Math.exp(mu + sigma * z05))
    const cvarTeorico = 1000 * (1 - (Math.exp(mu + (sigma * sigma) / 2) * phi(z05 - sigma)) / 0.05)
    expect(Math.abs(s.var95 / varTeorico - 1)).toBeLessThan(0.06)
    expect(Math.abs(s.cvar95 / cvarTeorico - 1)).toBeLessThan(0.06)
    // Y con un solo rubro, toda la contribución es suya.
    expect(s.contribuciones.find((c) => c.id === 'merval')!.monto).toBe(s.cvar95)
  })

  it('misma semilla, mismo resultado; otra semilla, otro resultado', () => {
    const otra = simular(CARTERA_EJEMPLO, RUBROS_BASE, OPC)
    expect(otra).toEqual(r)
    const distinta = simular(CARTERA_EJEMPLO, RUBROS_BASE, { ...OPC, semilla: 43 })
    expect(distinta.var95).not.toBe(r.var95)
  })

  it('un rubro solo, sin crisis, tiene mediana a un año cercana a exp(ln(1 + ret) − vol²/2)', () => {
    for (const rubro of RUBROS_BASE) {
      const s = simular({ ...cero, [rubro.id]: 1000 }, RUBROS_BASE, { ...OPC, anios: 1, crisisActiva: false })
      const esperada = Math.exp(Math.log(1 + rubro.ret) - (rubro.vol * rubro.vol) / 2)
      // Error de muestreo de la mediana con 5.000 trayectorias: ~1,8% de la volatilidad.
      expect(Math.abs(s.mediana / 1000 - esperada)).toBeLessThan(0.02 + 0.06 * rubro.vol)
    }
  })

  it('las bandas están ordenadas y arrancan en el valor de hoy', () => {
    expect(r.bandas).toHaveLength(37)
    expect(r.bandas[0].p50).toBeCloseTo(r.total0, 9)
    for (const b of r.bandas) {
      expect(b.p5).toBeLessThanOrEqual(b.p25)
      expect(b.p25).toBeLessThanOrEqual(b.p50)
      expect(b.p50).toBeLessThanOrEqual(b.p75)
      expect(b.p75).toBeLessThanOrEqual(b.p95)
    }
    expect(r.probPerdida).toBeGreaterThanOrEqual(0)
    expect(r.probPerdida).toBeLessThanOrEqual(1)
  })

  it('la probabilidad mensual de crisis compone la anual', () => {
    const pm = probMensual(0.08)
    expect(1 - Math.pow(1 - pm, 12)).toBeCloseTo(0.08, 12)
    // Con 8% anual durante 3 años, cerca de 22% de los escenarios tiene alguna crisis.
    expect(r.fraccionConCrisis).toBeGreaterThan(0.18)
    expect(r.fraccionConCrisis).toBeLessThan(0.27)
    const sin = simular(CARTERA_EJEMPLO, RUBROS_BASE, { ...OPC, crisisActiva: false })
    expect(sin.fraccionConCrisis).toBe(0)
  })
})

describe('modelo de dos factores', () => {
  it('ninguna correlación implícita supera 1', () => {
    for (const a of RUBROS_BASE) {
      expect(a.betaAr * a.betaAr + a.betaGlobal * a.betaGlobal).toBeLessThanOrEqual(1)
      for (const b of RUBROS_BASE) {
        const c = correlacion(a, b)
        expect(c).toBeLessThanOrEqual(1)
        expect(c).toBeGreaterThanOrEqual(-1)
      }
    }
  })

  it('cuantil interpola entre vecinos', () => {
    expect(cuantil([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(cuantil([0, 10], 0.25)).toBe(2.5)
  })
})

describe('stress tests', () => {
  it('escenario histórico: PASO 2019 sobre la cartera de ejemplo', () => {
    const paso = ESCENARIOS_HISTORICOS.find((e) => e.id === 'paso2019')!
    const s = estresar(CARTERA_EJEMPLO, RUBROS_BASE, paso.shocks)
    // 2000·−0,20 + 4000·−0,45 + 3000·−0,15 + 1000·−0,35 + 2000·−0,55 = −4.100
    expect(s.pnl).toBeCloseTo(-4100, 9)
    expect(s.pct).toBeCloseTo(-4100 / 20000, 12)
  })

  it('los seis escenarios tienen shock para los siete rubros', () => {
    expect(ESCENARIOS_HISTORICOS).toHaveLength(6)
    for (const e of ESCENARIOS_HISTORICOS) expect(Object.keys(e.shocks).sort()).toEqual(RUBROS_BASE.map((r) => r.id).sort())
  })

  it('escenario por factores: shock = vol · (beta_ar · sA + beta_global · sG), acotado', () => {
    const s = shocksPorFactores(RUBROS_BASE, -2, 0)
    expect(s.merval).toBeCloseTo(0.42 * 0.8 * -2, 12)
    expect(s.mep).toBeCloseTo(0, 12)
    const extremo = shocksPorFactores([{ ...RUBROS_BASE[5], vol: 5 }], -3, -3)
    expect(extremo.merval).toBe(-0.95)
    const arriba = shocksPorFactores([{ ...RUBROS_BASE[5], vol: 5 }], 3, 3)
    expect(arriba.merval).toBe(3)
  })

  it('una noticia suma su ajuste por rubro al shock de los factores', () => {
    const s = shocksNoticia(RUBROS_BASE, { factorAR: -0.4, factorGlobal: 0, ajustes: { pesos: -0.04 } })
    expect(s.pesos).toBeCloseTo(0.28 * 0.6 * -0.4 - 0.04, 12)
    expect(s.cedears).toBeCloseTo(0.17 * 0.1 * -0.4, 12)
    // Datos rotos no rompen el cálculo.
    expect(shocksNoticia(RUBROS_BASE, { factorAR: 'x', ajustes: null }).merval).toBeCloseTo(0, 12)
  })
})

describe('pesos y dólares', () => {
  it('pasar de dólares a pesos y volver no cambia el monto guardado', () => {
    for (const mep of [1585, 1572.4, 999.99]) {
      for (const usd of [20000, 1234.56, 0.01, 7_654_321.12]) {
        const enPesos = aVisible(usd, 'ARS', mep)
        expect(aDolares(enPesos, 'ARS', mep)).toBeCloseTo(usd, 8)
        expect(aDolares(aVisible(usd, 'USD', mep), 'USD', mep)).toBe(usd)
      }
    }
  })

  it('los montos salen del total y los porcentajes, en proporción si no suman 100', () => {
    const pct = pctDeMontos(CARTERA_EJEMPLO)
    expect(sumaPct(pct)).toBeCloseTo(100, 9)
    const m = montosDesdePct(20000, pct)
    expect(m.cedears).toBeCloseTo(5000, 9)
    const mitad = montosDesdePct(1000, { pesos: 25, mep: 25 })
    expect(mitad.pesos).toBeCloseTo(500, 9)
    expect(mitad.merval).toBe(0)
  })

  it('"Ajustar a 100%" deja la suma exacta', () => {
    const a = ajustarA100({ a: 33, b: 33, c: 33 })
    expect(a.a + a.b + a.c).toBeCloseTo(100, 9)
    const b = ajustarA100({ x: 10, y: 20, z: 5 })
    expect(Object.values(b).reduce((s, v) => s + v, 0)).toBeCloseTo(100, 9)
  })
})
