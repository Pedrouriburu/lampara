// Web Worker: corre la simulación fuera del hilo de la interfaz.
import { simular } from './simular'
import type { Montos, OpcionesSimulacion, ResultadoSimulacion, Rubro } from './tipos'

export interface PedidoSimulacion {
  id: number
  montos: Partial<Montos>
  rubros: Rubro[]
  opciones: OpcionesSimulacion
}

export type RespuestaSimulacion = { id: number; resultado: ResultadoSimulacion } | { id: number; error: string }

const ctx = self as unknown as { postMessage: (m: RespuestaSimulacion) => void; onmessage: ((e: MessageEvent<PedidoSimulacion>) => void) | null }

ctx.onmessage = (e) => {
  const { id, montos, rubros, opciones } = e.data
  try {
    ctx.postMessage({ id, resultado: simular(montos, rubros, opciones) })
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
