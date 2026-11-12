// Lectura y escritura en Supabase. Cada función recibe el cliente; ninguna se llama sin claves.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Accion, Grupo } from '../acciones/universo'
import { paraGuardar, restaurar, type EstadoApp } from '../estado/tipos'
import type { Edicion } from '../noticias/tipos'
import type { Rubro, RubroId } from '../riesgo'
import { esCorrida, type Corrida } from './corridas'
import { mepValido, type Cotizacion } from './cotizaciones'

const NOMBRE = 'Mi cartera'

/** Separa el estado en las columnas de `carteras`. */
function aFila(e: EstadoApp) {
  const { totalUsd, pct, moneda, sel: _sel, ...opciones } = paraGuardar(e) as Record<string, unknown>
  return { nombre: NOMBRE, total_usd: totalUsd, pct, moneda_vista: moneda, opciones, actualizada: new Date().toISOString() }
}

export interface CarteraNube {
  id: string
  estado: EstadoApp
}

/** Trae la cartera del usuario con sus selecciones; null si todavía no tiene. */
export async function cargarCartera(sb: SupabaseClient): Promise<CarteraNube | null> {
  const { data, error } = await sb.from('carteras').select('id, total_usd, pct, moneda_vista, opciones').eq('nombre', NOMBRE).maybeSingle()
  if (error) throw error
  if (!data) return null
  const s = await sb.from('selecciones').select('grupo, pesos').eq('cartera_id', data.id)
  if (s.error) throw s.error
  const sel: Record<string, unknown> = { merval: {}, cedears: {} }
  for (const f of s.data ?? []) sel[f.grupo as Grupo] = f.pesos
  const opciones = data.opciones && typeof data.opciones === 'object' ? (data.opciones as Record<string, unknown>) : {}
  return { id: data.id as string, estado: restaurar({ ...opciones, totalUsd: Number(data.total_usd), pct: data.pct, moneda: data.moneda_vista, sel }) }
}

/** Crea o actualiza la cartera y sus selecciones. Devuelve el id. */
export async function guardarCartera(sb: SupabaseClient, e: EstadoApp, id: string | null): Promise<string> {
  let carteraId = id
  if (carteraId) {
    const { error } = await sb.from('carteras').update(aFila(e)).eq('id', carteraId)
    if (error) throw error
  } else {
    const { data, error } = await sb.from('carteras').upsert(aFila(e), { onConflict: 'user_id,nombre' }).select('id').single()
    if (error) throw error
    carteraId = data.id as string
  }
  const filas = (['merval', 'cedears'] as Grupo[]).map((grupo) => ({ cartera_id: carteraId, grupo, pesos: e.sel[grupo] }))
  const s = await sb.from('selecciones').upsert(filas, { onConflict: 'cartera_id,grupo' })
  if (s.error) throw s.error
  return carteraId
}

export async function listarCorridas(sb: SupabaseClient, carteraId: string): Promise<Corrida[]> {
  const { data, error } = await sb.from('corridas').select('id, fecha, opciones, resultados').eq('cartera_id', carteraId).order('fecha', { ascending: false }).limit(60)
  if (error) throw error
  return (data ?? []).filter(esCorrida)
}

export async function insertarCorrida(sb: SupabaseClient, carteraId: string, c: Omit<Corrida, 'id'>): Promise<Corrida> {
  const { data, error } = await sb.from('corridas').insert({ cartera_id: carteraId, fecha: c.fecha, opciones: c.opciones, resultados: c.resultados }).select('id, fecha, opciones, resultados').single()
  if (error) throw error
  return data as Corrida
}

export async function borrarCorrida(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from('corridas').delete().eq('id', id)
  if (error) throw error
}

/** Últimas ediciones del agente (lectura pública). */
export async function listarEdiciones(sb: SupabaseClient): Promise<Edicion[]> {
  const { data, error } = await sb.from('ediciones').select('fecha, generada, panorama, escenario, items, escenarios_acciones, fuentes').order('fecha', { ascending: false }).limit(60)
  if (error) throw error
  return (data ?? [])
    .filter((d) => d && d.fecha && Array.isArray(d.items))
    .map((d) => ({
      fecha: String(d.fecha),
      generada: d.generada ?? undefined,
      panorama: d.panorama ?? '',
      escenario: d.escenario ?? {},
      items: d.items,
      escenariosAcciones: Array.isArray(d.escenarios_acciones) ? d.escenarios_acciones : [],
      fuentes: Array.isArray(d.fuentes) ? d.fuentes : [],
    }))
}

/** Última cotización que guardó el agente: respaldo si la API pública no responde. */
export async function ultimaCotizacion(sb: SupabaseClient): Promise<Cotizacion | null> {
  const { data, error } = await sb.from('cotizaciones').select('fecha, mep, fuente').not('mep', 'is', null).order('fecha', { ascending: false }).limit(1).maybeSingle()
  if (error || !data) return null
  const mep = Number(data.mep)
  return mepValido(mep) ? { mep, fecha: String(data.fecha) + 'T12:00:00-03:00', fuente: data.fuente || 'agente' } : null
}

export interface Referencia {
  rubros: Rubro[] | null
  universo: Accion[] | null
}

/** Supuestos y universo cargados en la base: son los valores a los que vuelve "Restablecer". */
export async function cargarReferencia(sb: SupabaseClient): Promise<Referencia> {
  const [r, u] = await Promise.all([
    sb.from('supuestos_rubros').select('id, nombre, corto, ret, vol, beta_ar, beta_global, golpe_crisis, orden').order('orden'),
    sb.from('universo_acciones').select('ticker, nombre, grupo, sector, rp, beta, tasas, oil, dolar'),
  ])
  const rubros =
    !r.error && r.data && r.data.length
      ? r.data.map((f) => ({ id: f.id as RubroId, nombre: f.nombre, corto: f.corto, ret: +f.ret, vol: +f.vol, betaAr: +f.beta_ar, betaGlobal: +f.beta_global, golpeCrisis: +f.golpe_crisis }))
      : null
  const universo =
    !u.error && u.data && u.data.length
      ? u.data.map((f) => ({ ticker: f.ticker, nombre: f.nombre, grupo: f.grupo as Grupo, sector: f.sector, rp: +f.rp, beta: +f.beta, tasas: +f.tasas, oil: +f.oil, dolar: +f.dolar }))
      : null
  return { rubros, universo }
}
