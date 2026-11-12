// Sesión del usuario: ingreso por mail, sincronización de la cartera con Supabase y corridas guardadas.
// Sin claves de Supabase (o sin cuenta) todo queda en el navegador: es el modo de demostración.
import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useEstado } from '../estado/almacen'
import { guardarCorridasLocales, idLocal, leerCorridasLocales, type Corrida } from './corridas'
import { borrarCorrida, cargarCartera, cargarReferencia, guardarCartera, insertarCorrida, listarCorridas, type Referencia } from './nube'
import { supabase } from './supabase'

export interface Usuario {
  id: string
  email: string
}

export type EstadoSync = 'inactivo' | 'cargando' | 'guardando' | 'guardado' | 'error'
export type Modo = 'ingreso' | 'demo' | 'cuenta'

interface Sesion {
  /** Falso mientras se averigua si ya había una sesión abierta. */
  listo: boolean
  modo: Modo
  usuario: Usuario | null
  sync: EstadoSync
  errorIngreso: string | null
  entrarDemo: () => void
  irAIngreso: () => void
  pedirEnlace: (email: string) => Promise<string | null>
  verificarCodigo: (email: string, codigo: string) => Promise<string | null>
  salir: () => Promise<void>
  corridas: Corrida[]
  guardarCorrida: (c: Omit<Corrida, 'id'>) => Promise<boolean>
  quitarCorrida: (id: string) => Promise<void>
  referencia: Referencia
}

const Ctx = createContext<Sesion | null>(null)
const CLAVE_DEMO = 'lampara-demo'

const aUsuario = (s: Session | null): Usuario | null => (s?.user ? { id: s.user.id, email: s.user.email ?? '' } : null)

function leerDemo(): boolean {
  try {
    return localStorage.getItem(CLAVE_DEMO) === '1'
  } catch {
    return false
  }
}

/** Si el enlace del mail venció, Supabase vuelve con el error en la dirección. */
function errorDeUrl(): string | null {
  const h = window.location.hash
  if (!/error=/.test(h)) return null
  const p = new URLSearchParams(h.replace(/^#/, ''))
  const codigo = p.get('error_code') || ''
  if (codigo === 'otp_expired') return 'El enlace del mail venció o ya se usó. Pedí uno nuevo.'
  return 'No se pudo completar el ingreso. Pedí un enlace nuevo.'
}

function mensaje(e: { message?: string; status?: number } | null): string {
  const m = (e?.message || '').toLowerCase()
  if (e?.status === 429 || m.includes('rate limit') || m.includes('security purposes')) return 'Pediste demasiados mails seguidos. Esperá un minuto y probá de nuevo.'
  if (m.includes('expired') || m.includes('invalid')) return 'El código no es válido o venció. Pedí uno nuevo.'
  if (m.includes('fetch') || m.includes('network')) return 'No hay conexión con el servidor. Revisá tu internet y probá de nuevo.'
  return 'No se pudo completar el ingreso. Probá de nuevo en un rato.'
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const { estado, reemplazar, version } = useEstado()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [listo, setListo] = useState(!supabase)
  const [demo, setDemo] = useState(leerDemo)
  const [carteraId, setCarteraId] = useState<string | null>(null)
  const [sync, setSync] = useState<EstadoSync>('inactivo')
  const [corridas, setCorridas] = useState<Corrida[]>(leerCorridasLocales)
  const [errorIngreso, setErrorIngreso] = useState<string | null>(errorDeUrl)
  const [referencia, setReferencia] = useState<Referencia>({ rubros: null, universo: null })
  const estadoRef = useRef(estado)
  const versionRef = useRef(version)
  const versionGuardada = useRef(version)

  useEffect(() => {
    estadoRef.current = estado
    versionRef.current = version
  })

  // Sesión: la que ya estaba abierta, la que llega por el enlace del mail y los cambios posteriores.
  useEffect(() => {
    if (!supabase) return
    let vigente = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!vigente) return
      setUsuario(aUsuario(data.session))
      setListo(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      const u = aUsuario(sesion)
      setUsuario((previo) => (previo?.id === u?.id ? previo : u))
      if (u) setErrorIngreso(null)
    })
    void cargarReferencia(supabase).then((r) => {
      if (vigente) setReferencia(r)
    })
    return () => {
      vigente = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Al entrar: traer la cartera de la cuenta, o subir la del navegador si es la primera vez.
  const idUsuario = usuario?.id ?? null
  useEffect(() => {
    const sb = supabase
    if (!sb || !idUsuario) {
      setCarteraId(null)
      setSync('inactivo')
      setCorridas(leerCorridasLocales())
      return
    }
    let vigente = true
    setSync('cargando')
    void (async () => {
      try {
        const nube = await cargarCartera(sb)
        if (!vigente) return
        let id: string
        if (nube) {
          const actual = estadoRef.current
          // La cotización del día no se guarda: se conserva la que ya trajo la app.
          const cotizacion = nube.estado.mepOrigen === 'manual' ? {} : { mep: actual.mep, mepOrigen: actual.mepOrigen, mepFecha: actual.mepFecha }
          reemplazar({ ...nube.estado, ...cotizacion })
          id = nube.id
        } else {
          id = await guardarCartera(sb, estadoRef.current, null)
        }
        const lista = await listarCorridas(sb, id)
        if (!vigente) return
        versionGuardada.current = versionRef.current
        setCarteraId(id)
        setCorridas(lista)
        setSync('guardado')
      } catch {
        if (vigente) setSync('error')
      }
    })()
    return () => {
      vigente = false
    }
  }, [idUsuario, reemplazar])

  // Cada cambio del usuario se guarda en su cuenta, con una pequeña espera.
  useEffect(() => {
    const sb = supabase
    if (!sb || !idUsuario || !carteraId || version === versionGuardada.current) return
    setSync('guardando')
    const t = setTimeout(() => {
      const v = versionRef.current
      guardarCartera(sb, estadoRef.current, carteraId)
        .then(() => {
          versionGuardada.current = v
          setSync('guardado')
        })
        .catch(() => setSync('error'))
    }, 1200)
    return () => clearTimeout(t)
  }, [version, carteraId, idUsuario])

  const entrarDemo = useCallback(() => {
    try {
      localStorage.setItem(CLAVE_DEMO, '1')
    } catch {
      /* sin almacenamiento */
    }
    setDemo(true)
  }, [])

  const irAIngreso = useCallback(() => {
    try {
      localStorage.removeItem(CLAVE_DEMO)
    } catch {
      /* sin almacenamiento */
    }
    setDemo(false)
  }, [])

  const pedirEnlace = useCallback(async (email: string) => {
    if (!supabase) return 'El ingreso con mail todavía no está activado.'
    setErrorIngreso(null)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname, shouldCreateUser: true } })
    return error ? mensaje(error) : null
  }, [])

  const verificarCodigo = useCallback(async (email: string, codigo: string) => {
    if (!supabase) return 'El ingreso con mail todavía no está activado.'
    const { error } = await supabase.auth.verifyOtp({ email, token: codigo.trim(), type: 'email' })
    return error ? mensaje(error) : null
  }, [])

  const salir = useCallback(async () => {
    await supabase?.auth.signOut()
    setUsuario(null)
  }, [])

  const guardarCorrida = useCallback(
    async (c: Omit<Corrida, 'id'>) => {
      if (supabase && idUsuario && carteraId) {
        try {
          const nueva = await insertarCorrida(supabase, carteraId, c)
          setCorridas((l) => [nueva, ...l])
          return true
        } catch {
          return false
        }
      }
      setCorridas((l) => {
        const lista = [{ ...c, id: idLocal() }, ...l].slice(0, 60)
        guardarCorridasLocales(lista)
        return lista
      })
      return true
    },
    [idUsuario, carteraId],
  )

  const quitarCorrida = useCallback(
    async (id: string) => {
      if (supabase && idUsuario && !id.startsWith('local-')) {
        try {
          await borrarCorrida(supabase, id)
        } catch {
          return
        }
        setCorridas((l) => l.filter((c) => c.id !== id))
        return
      }
      setCorridas((l) => {
        const lista = l.filter((c) => c.id !== id)
        guardarCorridasLocales(lista)
        return lista
      })
    },
    [idUsuario],
  )

  const modo: Modo = usuario ? 'cuenta' : demo ? 'demo' : 'ingreso'
  const valor = useMemo<Sesion>(
    () => ({ listo, modo, usuario, sync, errorIngreso, entrarDemo, irAIngreso, pedirEnlace, verificarCodigo, salir, corridas, guardarCorrida, quitarCorrida, referencia }),
    [listo, modo, usuario, sync, errorIngreso, entrarDemo, irAIngreso, pedirEnlace, verificarCodigo, salir, corridas, guardarCorrida, quitarCorrida, referencia],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useSesion(): Sesion {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSesion se usa dentro de <ProveedorSesion>')
  return v
}
