// Ediciones del agente: las de Supabase si hay claves, y si no (o si todavía no hay ninguna) la de ejemplo.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import ejemploCrudo from '../../agente/edicion-ejemplo.json'
import { listarEdiciones } from '../datos/nube'
import { supabase } from '../datos/supabase'
import type { Edicion } from './tipos'

export const EDICION_EJEMPLO = ejemploCrudo as Edicion

type Origen = 'cargando' | 'agente' | 'ejemplo'

interface Ediciones {
  ediciones: Edicion[]
  seleccionada: Edicion | null
  elegir: (fecha: string) => void
  origen: Origen
  /** Por qué se muestra la edición de ejemplo, si es el caso. */
  nota: string | null
}

const Ctx = createContext<Ediciones | null>(null)

export function ProveedorEdiciones({ children }: { children: ReactNode }) {
  const [ediciones, setEdiciones] = useState<Edicion[]>(supabase ? [] : [EDICION_EJEMPLO])
  const [origen, setOrigen] = useState<Origen>(supabase ? 'cargando' : 'ejemplo')
  const [nota, setNota] = useState<string | null>(supabase ? null : 'Modo de demostración: se muestra una edición de ejemplo con noticias inventadas.')
  const [fecha, setFecha] = useState<string | null>(null)

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let vigente = true
    const cargar = () =>
      listarEdiciones(sb)
        .then((lista) => {
          if (!vigente) return
          if (lista.length) {
            setEdiciones(lista)
            setOrigen('agente')
            setNota(null)
          } else {
            setEdiciones([EDICION_EJEMPLO])
            setOrigen('ejemplo')
            setNota('El agente todavía no publicó ninguna edición. Mientras tanto se muestra una de ejemplo, con noticias inventadas.')
          }
        })
        .catch(() => {
          if (!vigente) return
          setEdiciones((l) => (l.length ? l : [EDICION_EJEMPLO]))
          setOrigen((o) => (o === 'agente' ? o : 'ejemplo'))
          setNota((n) => n ?? 'No se pudieron leer las ediciones del agente. Se muestra una de ejemplo, con noticias inventadas.')
        })
    void cargar()
    // Si la app queda abierta, vuelve a mirar cada media hora por si salió la edición del día.
    const t = setInterval(() => void cargar(), 30 * 60 * 1000)
    return () => {
      vigente = false
      clearInterval(t)
    }
  }, [])

  const elegir = useCallback((f: string) => setFecha(f), [])
  const seleccionada = useMemo(() => ediciones.find((e) => e.fecha === fecha) ?? ediciones[0] ?? null, [ediciones, fecha])
  const valor = useMemo(() => ({ ediciones, seleccionada, elegir, origen, nota }), [ediciones, seleccionada, elegir, origen, nota])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useEdiciones(): Ediciones {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEdiciones se usa dentro de <ProveedorEdiciones>')
  return v
}
