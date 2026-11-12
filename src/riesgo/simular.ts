// Simulación Monte Carlo mensual con un modelo de dos factores. Todo en dólares.
import { mulberry32, normalGen } from './aleatorio'
import type { Banda, Montos, OpcionesSimulacion, ResultadoSimulacion, Rubro } from './tipos'

/** Cuantil con interpolación lineal sobre un arreglo ya ordenado. */
export function cuantil(ordenado: ArrayLike<number>, p: number): number {
  const n = ordenado.length
  if (n === 0) return NaN
  const pos = (n - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (pos - lo)
}

/** Correlación implícita entre dos rubros según el modelo de dos factores. */
export function correlacion(a: Rubro, b: Rubro): number {
  if (a.id === b.id) return 1
  return a.betaAr * b.betaAr + a.betaGlobal * b.betaGlobal
}

/** Peso del componente propio: √(1 − beta_ar² − beta_global²). */
export const pesoPropio = (r: Rubro) => Math.sqrt(Math.max(0, 1 - r.betaAr * r.betaAr - r.betaGlobal * r.betaGlobal))

/** Probabilidad mensual de crisis a partir de la anual. */
export const probMensual = (pAnual: number) => 1 - Math.pow(1 - pAnual, 1 / 12)

export function simular(montos: Partial<Montos>, rubros: readonly Rubro[], opciones: OpcionesSimulacion): ResultadoSimulacion {
  const { anios, caminos } = opciones
  const probCrisis = opciones.crisisActiva ? opciones.probCrisis : 0
  const meses = Math.round(anios * 12)
  const dt = 1 / 12
  const n = rubros.length
  const rand = mulberry32(opciones.semilla)
  const normal = normalGen(rand)

  const v0 = rubros.map((r) => Math.max(0, montos[r.id] || 0))
  const total0 = v0.reduce((s, x) => s + x, 0)
  const deriva = rubros.map((r) => (Math.log(1 + r.ret) - (r.vol * r.vol) / 2) * dt)
  const escala = rubros.map((r) => r.vol * Math.sqrt(dt))
  const propio = rubros.map(pesoPropio)
  const golpe = rubros.map((r) => Math.log(Math.max(0.01, 1 + r.golpeCrisis)))
  const pMes = probMensual(probCrisis)

  const porMes: Float64Array[] = []
  for (let t = 0; t <= meses; t++) porMes.push(new Float64Array(caminos))
  const pnlMes1 = new Float64Array(caminos)
  const pnlRubroMes1 = new Float64Array(caminos * n)
  const caidaMax = new Float64Array(caminos)
  let caminosConCrisis = 0
  const v = new Float64Array(n)

  for (let k = 0; k < caminos; k++) {
    for (let i = 0; i < n; i++) v[i] = v0[i]
    porMes[0][k] = total0
    let pico = total0
    let peor = 0
    let huboCrisis = false
    for (let t = 1; t <= meses; t++) {
      const zA = normal()
      const zG = normal()
      const crisis = pMes > 0 && rand() < pMes
      if (crisis) huboCrisis = true
      let tot = 0
      for (let i = 0; i < n; i++) {
        const r = rubros[i]
        const z = r.betaAr * zA + r.betaGlobal * zG + propio[i] * normal()
        let lr = deriva[i] + escala[i] * z
        if (crisis) lr += golpe[i]
        const antes = v[i]
        v[i] = antes * Math.exp(lr)
        if (t === 1) pnlRubroMes1[k * n + i] = v[i] - antes
        tot += v[i]
      }
      porMes[t][k] = tot
      if (t === 1) pnlMes1[k] = tot - total0
      if (tot > pico) pico = tot
      const dd = pico > 0 ? (pico - tot) / pico : 0
      if (dd > peor) peor = dd
    }
    caidaMax[k] = peor
    if (huboCrisis) caminosConCrisis++
  }

  const bandas: Banda[] = porMes.map((arr) => {
    const s = Float64Array.from(arr).sort()
    return { p5: cuantil(s, 0.05), p25: cuantil(s, 0.25), p50: cuantil(s, 0.5), p75: cuantil(s, 0.75), p95: cuantil(s, 0.95) }
  })
  const finalOrd = Float64Array.from(porMes[meses]).sort()

  // Riesgo a un mes: VaR, CVaR y contribución de cada rubro a la cola.
  const pnlOrd = Float64Array.from(pnlMes1).sort()
  const q05 = cuantil(pnlOrd, 0.05)
  const q01 = cuantil(pnlOrd, 0.01)
  const contrib = new Float64Array(n)
  let enCola = 0
  for (let k = 0; k < caminos; k++) {
    if (pnlMes1[k] <= q05) {
      enCola++
      for (let i = 0; i < n; i++) contrib[i] += pnlRubroMes1[k * n + i]
    }
  }
  const contribuciones = rubros.map((r, i) => ({ id: r.id, monto: enCola ? -contrib[i] / enCola : 0 }))
  // El CVaR se define como la suma de las contribuciones: así la descomposición cierra exacta.
  const cvar95 = contribuciones.reduce((s, c) => s + c.monto, 0)

  let perdida = 0
  for (let k = 0; k < caminos; k++) if (porMes[meses][k] < total0) perdida++
  const ddOrd = Float64Array.from(caidaMax).sort()

  return {
    total0,
    meses,
    caminos,
    bandas,
    var95: -q05,
    var99: -q01,
    cvar95,
    contribuciones,
    mediana: cuantil(finalOrd, 0.5),
    p5: cuantil(finalOrd, 0.05),
    p95: cuantil(finalOrd, 0.95),
    probPerdida: perdida / caminos,
    caidaTipica: cuantil(ddOrd, 0.5),
    fraccionConCrisis: caminosConCrisis / caminos,
  }
}
