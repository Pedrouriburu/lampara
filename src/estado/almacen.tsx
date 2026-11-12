// Estado global de la app: un contexto simple que además guarda en el navegador.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { montosDesdePct, type Montos } from '../riesgo'
import { formatoMoneda, type FormatoMoneda } from '../util/formato'
import { estadoInicial, paraGuardar, restaurar, type EstadoApp } from './tipos'

const CLAVE = 'lampara-v3'

export function leerLocal(): EstadoApp {
  try {
    return restaurar(JSON.parse(localStorage.getItem(CLAVE) || 'null'))
  } catch {
    return estadoInicial()
  }
}

function guardarLocal(e: EstadoApp) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(paraGuardar(e)))
  } catch {
    /* sin almacenamiento: la app sigue con lo que tiene en memoria */
  }
}

type Cambio = Partial<EstadoApp> | ((e: EstadoApp) => Partial<EstadoApp>)

interface Almacen {
  estado: EstadoApp
  /** Con `silencioso` no cuenta como cambio del usuario (por ejemplo, la cotización del día). */
  cambiar: (c: Cambio, silencioso?: boolean) => void
  /** Reemplaza todo el estado (por ejemplo, al traer la cartera de Supabase). */
  reemplazar: (e: EstadoApp) => void
  /** Montos por rubro en dólares, derivados del total y los porcentajes. */
  montos: Montos
  fm: FormatoMoneda
  /** Cuenta los cambios del usuario; sirve para saber cuándo sincronizar. */
  version: number
}

const Ctx = createContext<Almacen | null>(null)

export function ProveedorEstado({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoApp>(leerLocal)
  const [version, setVersion] = useState(0)
  const primera = useRef(true)

  const cambiar = useCallback((c: Cambio, silencioso = false) => {
    setEstado((e) => ({ ...e, ...(typeof c === 'function' ? c(e) : c) }))
    if (!silencioso) setVersion((v) => v + 1)
  }, [])
  const reemplazar = useCallback((e: EstadoApp) => setEstado(e), [])

  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    const t = setTimeout(() => guardarLocal(estado), 250)
    return () => clearTimeout(t)
  }, [estado])

  const montos = useMemo(() => montosDesdePct(estado.totalUsd, estado.pct), [estado.totalUsd, estado.pct])
  const fm = useMemo(() => formatoMoneda(estado.moneda, estado.mep), [estado.moneda, estado.mep])
  const valor = useMemo(() => ({ estado, cambiar, reemplazar, montos, fm, version }), [estado, cambiar, reemplazar, montos, fm, version])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useEstado(): Almacen {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEstado se usa dentro de <ProveedorEstado>')
  return v
}
