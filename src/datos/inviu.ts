// Guardado y lectura de lo que sale de los reportes de Inviu.
// El .xlsx se lee en el navegador (src/inviu); acá suben solo las filas ya interpretadas.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Movimiento, ReporteMovimientos, ReporteTenencias, Tenencia } from '../inviu/tipos'

/** Clases que no son un instrumento: plata quieta en la cuenta. */
const EFECTIVO = /^(moneda|disponibilidad|caja)/i

export const esEfectivo = (t: { clase: string }) => EFECTIVO.test(t.clase)

export interface Importacion {
  id: string
  tipo: 'tenencias' | 'movimientos'
  archivo: string
  fecha: string | null
  filas: number
  subida: string
}

async function registrar(sb: SupabaseClient, fila: Record<string, unknown>): Promise<string> {
  const { data, error } = await sb.from('importaciones').insert(fila).select('id').single()
  if (error) throw error
  return data.id as string
}

/**
 * Guarda la foto de la cartera a una fecha. Volver a subir el archivo del mismo día
 * reemplaza la foto entera, así no quedan tickers viejos de una subida anterior.
 */
export async function guardarTenencias(sb: SupabaseClient, r: ReporteTenencias, archivo: string): Promise<number> {
  const importacionId = await registrar(sb, { tipo: 'tenencias', archivo, cuenta: r.cuenta, fecha: r.fecha, tc_mep: r.tcMep, tc_ccl: r.tcCcl, filas: r.tenencias.length })

  const viejas = await sb.from('tenencias').delete().eq('fecha', r.fecha)
  if (viejas.error) throw viejas.error

  const filas = r.tenencias.map((t: Tenencia) => ({
    fecha: r.fecha,
    ticker: t.ticker,
    importacion_id: importacionId,
    nombre: t.nombre,
    clase: t.clase,
    moneda: t.moneda,
    cantidad: t.cantidad,
    precio: t.precio,
    costo: t.costo,
    monto_ars: t.montoArs,
    monto_usd: t.montoUsd,
    invertido_ars: t.invertidoArs,
    resultado_ars: t.resultadoArs,
    var_pct: t.varPct,
  }))
  const { error } = await sb.from('tenencias').insert(filas)
  if (error) throw error
  return filas.length
}

/** Guarda los movimientos. Resubir un rango que se solapa no duplica nada. */
export async function guardarMovimientos(sb: SupabaseClient, r: ReporteMovimientos, archivo: string): Promise<number> {
  const importacionId = await registrar(sb, { tipo: 'movimientos', archivo, cuenta: r.cuenta, fecha: r.fecha, filas: r.movimientos.length })

  const filas = r.movimientos.map((m: Movimiento) => ({
    comprobante: m.comprobante,
    seccion: m.seccion,
    ticker: m.ticker,
    importacion_id: importacionId,
    concertacion: m.concertacion || null,
    liquidacion: m.liquidacion || null,
    descripcion: m.descripcion,
    operacion: m.operacion,
    moneda: m.moneda,
    cantidad: m.cantidad,
    precio: m.precio,
    bruto: m.bruto,
    neto: m.neto,
    saldo: m.saldo,
  }))
  const { error } = await sb.from('movimientos').upsert(filas, { onConflict: 'user_id,comprobante,seccion,ticker' })
  if (error) throw error
  return filas.length
}

export interface Posicion extends Tenencia {
  fecha: string
}

/** La foto más reciente de la cartera. Vacío si todavía no subió nada. */
export async function cargarTenencias(sb: SupabaseClient): Promise<Posicion[]> {
  const ultima = await sb.from('tenencias').select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle()
  if (ultima.error) throw ultima.error
  if (!ultima.data) return []
  const fecha = String(ultima.data.fecha)

  const { data, error } = await sb.from('tenencias').select('*').eq('fecha', fecha)
  if (error) throw error
  return (data ?? []).map((f) => ({
    fecha,
    ticker: String(f.ticker),
    nombre: f.nombre ?? '',
    clase: f.clase ?? '',
    moneda: f.moneda ?? 'ARS',
    cantidad: Number(f.cantidad),
    precio: Number(f.precio),
    costo: Number(f.costo),
    montoArs: Number(f.monto_ars),
    montoUsd: Number(f.monto_usd),
    invertidoArs: Number(f.invertido_ars),
    resultadoArs: Number(f.resultado_ars),
    varPct: Number(f.var_pct),
  }))
}

export async function listarImportaciones(sb: SupabaseClient): Promise<Importacion[]> {
  const { data, error } = await sb.from('importaciones').select('id, tipo, archivo, fecha, filas, subida').order('subida', { ascending: false }).limit(20)
  if (error) throw error
  return (data ?? []).map((f) => ({ id: String(f.id), tipo: f.tipo, archivo: f.archivo ?? '', fecha: f.fecha ? String(f.fecha) : null, filas: Number(f.filas), subida: String(f.subida) }))
}
