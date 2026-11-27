// Publica en Supabase una edición ya armada (por ejemplo, por la tarea programada de Claude).
//
// El agente de este repositorio (agente/correr.mjs) investiga Y publica. Este archivo hace
// solo la segunda mitad: recibe la edición hecha, la valida con el mismo esquema y la guarda.
// Así la tarea programada puede investigar gratis con búsqueda web y dejar la escritura acá,
// donde la clave de servicio vive en los secretos de GitHub y no en el texto de la tarea.
//
// De dónde saca la edición, en este orden: --archivo <ruta>, la variable EDICION, o la entrada estándar.
// Variables necesarias para guardar: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
// Con --seco valida y no escribe nada.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { validarEdicionAbierta, extraerJson, dominioDe } from './esquema.mjs'

const DIAS_QUE_SE_GUARDAN = 60
const log = (...a) => console.log('[publicar]', ...a)

/** Resta días a una fecha AAAA-MM-DD. */
function restarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

/** Lee la entrada estándar entera. */
async function leerEntrada() {
  const partes = []
  for await (const c of process.stdin) partes.push(c)
  return Buffer.concat(partes).toString('utf8')
}

/**
 * El esquema pide "fuentes"; quien arma la edición no siempre las manda.
 * Se deducen de las noticias: un par (portal, url) por cada nota citada, sin repetir.
 */
export function completarFuentes(edicion) {
  if (Array.isArray(edicion.fuentes) && edicion.fuentes.length) return edicion
  const vistas = new Set()
  const fuentes = []
  for (const it of Array.isArray(edicion.items) ? edicion.items : []) {
    const url = String(it?.url ?? '')
    const dominio = dominioDe(url)
    // Cualquier medio sirve mientras la URL sea https; la diversidad se controla en el esquema.
    if (!dominio || vistas.has(url)) continue
    vistas.add(url)
    fuentes.push({ portal: String(it?.fuente || dominio), url })
  }
  return { ...edicion, fuentes }
}

export async function publicar(crudo, { seco = false } = {}) {
  const dato = extraerJson(crudo)
  if (!dato) throw new Error('No encontré un objeto JSON en lo que me pasaron.')

  const r = validarEdicionAbierta(completarFuentes(dato))
  if (!r.ok) {
    console.error('[publicar] La edición no pasó la validación:')
    for (const e of r.errores) console.error('  - ' + e)
    throw new Error(`La edición tiene ${r.errores.length} problema(s); no se guardó nada.`)
  }
  const edicion = r.edicion
  log(`edición del ${edicion.fecha} válida: ${edicion.items.length} noticias, ${edicion.escenariosAcciones.length} escenarios, ${edicion.fuentes.length} fuentes.`)
  if (seco) return { edicion, guardada: false }

  const url = process.env.SUPABASE_URL?.trim()
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')

  const base = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } })
  const fila = {
    fecha: edicion.fecha,
    generada: edicion.generada,
    panorama: edicion.panorama,
    escenario: edicion.escenario,
    items: edicion.items,
    escenarios_acciones: edicion.escenariosAcciones,
    fuentes: edicion.fuentes,
  }
  const up = await base.from('ediciones').upsert(fila, { onConflict: 'fecha' })
  if (up.error) throw new Error('No se pudo guardar la edición: ' + up.error.message)

  const del = await base.from('ediciones').delete().lt('fecha', restarDias(edicion.fecha, DIAS_QUE_SE_GUARDAN))
  if (del.error) log('aviso: no se pudieron borrar las ediciones viejas:', del.error.message)

  log(`edición del ${edicion.fecha} publicada.`)
  return { edicion, guardada: true }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const seco = process.argv.includes('--seco')
  const i = process.argv.indexOf('--archivo')
  const crudo = i !== -1 && process.argv[i + 1] ? readFileSync(process.argv[i + 1], 'utf8') : process.env.EDICION?.trim() || (await leerEntrada())
  publicar(crudo, { seco }).catch((e) => {
    console.error('[publicar]', e.message)
    process.exitCode = 1
  })
}
