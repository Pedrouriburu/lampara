// Corre la simulación en un Web Worker, con una pequeña espera para no recalcular en cada tecla.
import { useEffect, useMemo, useRef, useState } from 'react'
import { simular } from '../riesgo/simular'
import type { Montos, OpcionesSimulacion, ResultadoSimulacion, Rubro } from '../riesgo/tipos'
import type { PedidoSimulacion, RespuestaSimulacion } from '../riesgo/worker'

let worker: Worker | null = null
let workerRoto = false
let ultimoId = 0
const esperas = new Map<number, (r: RespuestaSimulacion) => void>()

function obtenerWorker(): Worker | null {
  if (workerRoto || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('../riesgo/worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<RespuestaSimulacion>) => {
      const fn = esperas.get(e.data.id)
      esperas.delete(e.data.id)
      fn?.(e.data)
    }
    worker.onerror = () => {
      // Si el worker no carga, se calcula en el hilo principal: más lento pero funciona.
      workerRoto = true
      worker = null
      for (const fn of esperas.values()) fn({ id: -1, error: 'worker' })
      esperas.clear()
    }
    return worker
  } catch {
    workerRoto = true
    return null
  }
}

function correr(pedido: Omit<PedidoSimulacion, 'id'>): Promise<ResultadoSimulacion> {
  const w = obtenerWorker()
  if (!w) return Promise.resolve(simular(pedido.montos, pedido.rubros, pedido.opciones))
  const id = ++ultimoId
  return new Promise((resolve) => {
    esperas.set(id, (r) => resolve('resultado' in r ? r.resultado : simular(pedido.montos, pedido.rubros, pedido.opciones)))
    w.postMessage({ id, ...pedido } satisfies PedidoSimulacion)
  })
}

export interface EstadoSimulacion {
  resultado: ResultadoSimulacion | null
  calculando: boolean
}

export function useSimulacion(montos: Montos, rubros: Rubro[], opciones: OpcionesSimulacion): EstadoSimulacion {
  const clave = useMemo(() => JSON.stringify([montos, rubros, opciones]), [montos, rubros, opciones])
  const [estado, setEstado] = useState<EstadoSimulacion>({ resultado: null, calculando: true })
  const pedido = useRef({ montos, rubros, opciones })
  pedido.current = { montos, rubros, opciones }

  useEffect(() => {
    let vigente = true
    const total = Object.values(pedido.current.montos).reduce((s, x) => s + Math.max(0, x || 0), 0)
    if (total <= 0) {
      setEstado({ resultado: null, calculando: false })
      return
    }
    setEstado((e) => ({ ...e, calculando: true }))
    const t = setTimeout(() => {
      void correr(pedido.current).then((resultado) => {
        if (vigente) setEstado({ resultado, calculando: false })
      })
    }, 160)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [clave])

  return estado
}
