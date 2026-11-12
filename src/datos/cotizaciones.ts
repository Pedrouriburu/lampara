// Cotización del dólar MEP del día. Fuente principal: dolarapi.com (API pública, sin clave).
// Si no responde, la app sigue con el último valor conocido o con el que cargue el usuario.

export interface Cotizacion {
  mep: number
  /** Fecha y hora de la cotización, en ISO. */
  fecha: string
  fuente: string
}

const URL_MEP = 'https://dolarapi.com/v1/dolares/bolsa'

export function mepValido(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x >= 100 && x < 1e7
}

// DolarApi pide no consultar cada serie más de una vez cada 3 horas: la respuesta se guarda en el navegador.
const CLAVE = 'lampara-mep'
const TRES_HORAS = 3 * 60 * 60 * 1000

function leerGuardada(): Cotizacion | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null') as (Cotizacion & { traida?: number }) | null
    if (g && mepValido(g.mep) && typeof g.traida === 'number' && Date.now() - g.traida < TRES_HORAS) return { mep: g.mep, fecha: g.fecha, fuente: g.fuente }
  } catch {
    /* sin almacenamiento o dato roto: se consulta de nuevo */
  }
  return null
}

export async function traerMepDelDia(): Promise<Cotizacion | null> {
  const guardada = leerGuardada()
  if (guardada) return guardada
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 8000)
  try {
    const r = await fetch(URL_MEP, { signal: ctl.signal, headers: { accept: 'application/json' } })
    if (!r.ok) return null
    const j = (await r.json()) as { venta?: unknown; fechaActualizacion?: unknown }
    if (!mepValido(j.venta)) return null
    const c: Cotizacion = { mep: Math.round(j.venta * 100) / 100, fecha: typeof j.fechaActualizacion === 'string' ? j.fechaActualizacion : new Date().toISOString(), fuente: 'dolarapi.com' }
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ ...c, traida: Date.now() }))
    } catch {
      /* sin almacenamiento */
    }
    return c
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}
