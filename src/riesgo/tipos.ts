// Tipos del motor de riesgo. Todo monto está en dólares.

export type RubroId = 'pesos' | 'mep' | 'soberanos' | 'ons' | 'cer' | 'merval' | 'cedears'
export type Moneda = 'ARS' | 'USD'

/** Supuestos de un rubro de la cartera (tabla `supuestos_rubros`). */
export interface Rubro {
  id: RubroId
  nombre: string
  corto: string
  /** Rendimiento anual esperado en dólares (0,11 = 11%). */
  ret: number
  /** Volatilidad anual. */
  vol: number
  /** Sensibilidad al factor Argentina. */
  betaAr: number
  /** Sensibilidad al factor global. */
  betaGlobal: number
  /** Variación ante una crisis local (−0,45 = −45%). */
  golpeCrisis: number
}

export type Montos = Record<RubroId, number>
export type Porcentajes = Record<RubroId, number>

export interface OpcionesSimulacion {
  anios: number
  caminos: number
  crisisActiva: boolean
  /** Probabilidad anual de crisis (0,08 = 8%). */
  probCrisis: number
  semilla: number
}

export interface Banda {
  p5: number
  p25: number
  p50: number
  p75: number
  p95: number
}

export interface ResultadoSimulacion {
  total0: number
  meses: number
  caminos: number
  /** Percentiles del valor de la cartera mes a mes (índice 0 = hoy). */
  bandas: Banda[]
  var95: number
  var99: number
  cvar95: number
  /** Pérdida promedio de cada rubro en los meses de la cola; suman el CVaR. */
  contribuciones: { id: RubroId; monto: number }[]
  mediana: number
  p5: number
  p95: number
  probPerdida: number
  /** Caída máxima mediana desde un pico. */
  caidaTipica: number
  fraccionConCrisis: number
}

export interface DetalleEstres {
  id: RubroId
  monto: number
  shock: number
  pnl: number
}

export interface ResultadoEstres {
  total: number
  pnl: number
  pct: number
  detalle: DetalleEstres[]
}

export interface EscenarioHistorico {
  id: string
  nombre: string
  desc: string
  shocks: Record<RubroId, number>
}
