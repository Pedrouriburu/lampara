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

export async function traerMepDelDia(): Promise<Cotizacion | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 8000)
  try {
    const r = await fetch(URL_MEP, { signal: ctl.signal, headers: { accept: 'application/json' } })
    if (!r.ok) return null
    const j = (await r.json()) as { venta?: unknown; fechaActualizacion?: unknown }
    if (!mepValido(j.venta)) return null
    return { mep: Math.round(j.venta * 100) / 100, fecha: typeof j.fechaActualizacion === 'string' ? j.fechaActualizacion : new Date().toISOString(), fuente: 'dolarapi.com' }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}
