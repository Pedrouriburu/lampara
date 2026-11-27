// Lo que sale de los dos reportes de Inviu.

/** Una celda cruda del Excel. */
export type Celda = string | number | boolean | Date | null | undefined

export interface Tenencia {
  ticker: string
  nombre: string
  /** "Acciones", "Cedear", "Moneda"... tal cual lo nombra Inviu. */
  clase: string
  moneda: string
  cantidad: number
  precio: number
  /** Precio promedio de compra. */
  costo: number
  montoArs: number
  montoUsd: number
  invertidoArs: number
  resultadoArs: number
  varPct: number
}

export interface ReporteTenencias {
  cuenta: string
  /** Fecha de valuación, AAAA-MM-DD. */
  fecha: string
  tcMep: number
  tcCcl: number
  tenencias: Tenencia[]
}

export interface Movimiento {
  comprobante: string
  seccion: 'monetaria' | 'instrumentos'
  ticker: string
  concertacion: string
  liquidacion: string
  descripcion: string
  operacion: string
  moneda: string
  cantidad: number | null
  precio: number | null
  bruto: number | null
  neto: number | null
  saldo: number | null
}

export interface ReporteMovimientos {
  cuenta: string
  /** Fin del rango pedido, AAAA-MM-DD. */
  fecha: string
  movimientos: Movimiento[]
}

export class ErrorInviu extends Error {}
