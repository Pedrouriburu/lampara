#!/usr/bin/env node
// Agente diario de Lámpara.
//
//   node agente/correr.mjs          lee las noticias y publica la edición del día
//   node agente/correr.mjs --seco   prueba sin red ni claves: valida la edición de ejemplo
//
// Necesita tres variables de entorno (en GitHub van como secretos del repositorio):
//   ANTHROPIC_API_KEY, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extraerJson, validarEdicion } from './esquema.mjs'
import { DOMINIOS, PORTALES } from './portales.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const MODELO = 'claude-sonnet-5-5'
const DIAS_QUE_SE_GUARDAN = 60
const MAX_PAUSAS = 8

// Búsqueda web del servidor de Anthropic, limitada a los portales permitidos.
// Versión vigente verificada en docs.claude.com el 12/11/2026: web_search_20260318.
const BUSQUEDA_WEB = {
  type: 'web_search_20260318',
  name: 'web_search',
  allowed_domains: DOMINIOS,
  max_uses: 20,
  user_location: { type: 'approximate', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
}

// Supuestos de respaldo (los mismos de la migración) por si no se puede leer la tabla.
const RUBROS_RESPALDO = [
  { id: 'pesos', nombre: 'Pesos (plazo fijo / caución)', vol: 0.28, beta_ar: 0.6, beta_global: 0.1 },
  { id: 'mep', nombre: 'Dólar MEP / billete', vol: 0.01, beta_ar: 0, beta_global: 0 },
  { id: 'soberanos', nombre: 'Bonos soberanos en USD', vol: 0.24, beta_ar: 0.85, beta_global: 0.2 },
  { id: 'ons', nombre: 'Obligaciones negociables en USD', vol: 0.09, beta_ar: 0.6, beta_global: 0.3 },
  { id: 'cer', nombre: 'Bonos CER', vol: 0.22, beta_ar: 0.7, beta_global: 0.1 },
  { id: 'merval', nombre: 'Acciones argentinas (Merval)', vol: 0.42, beta_ar: 0.8, beta_global: 0.3 },
  { id: 'cedears', nombre: 'CEDEARs', vol: 0.17, beta_ar: 0.1, beta_global: 0.95 },
]

const log = (...a) => console.log('[agente]', ...a)

// ----------------------------- Fechas -----------------------------

/** Fecha de Buenos Aires como AAAA-MM-DD. */
export function fechaBuenosAires(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
}

/** Fecha y hora de Buenos Aires en ISO con -03:00 (Argentina no cambia la hora). */
export function isoBuenosAires(ahora = new Date()) {
  const local = new Date(ahora.getTime() - 3 * 3600 * 1000)
  return local.toISOString().slice(0, 19) + '-03:00'
}

export function restarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

// ----------------------------- Cotizaciones -----------------------------

async function traerJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`)
  return r.json()
}

const numeroValido = (x, min, max) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : null)

/** MEP, CCL y oficial (dolarapi.com) y riesgo país (argentinadatos.com). Lo que falle queda en null. */
export async function traerCotizaciones() {
  const pedido = async (url, leer) => {
    try {
      return leer(await traerJson(url))
    } catch (e) {
      log('aviso: no se pudo leer', url, '-', e.message)
      return null
    }
  }
  const [mep, ccl, oficial, riesgo] = await Promise.all([
    pedido('https://dolarapi.com/v1/dolares/bolsa', (j) => numeroValido(j.venta, 100, 1e7)),
    pedido('https://dolarapi.com/v1/dolares/contadoconliqui', (j) => numeroValido(j.venta, 100, 1e7)),
    pedido('https://dolarapi.com/v1/dolares/oficial', (j) => numeroValido(j.venta, 100, 1e7)),
    pedido('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo', (j) => {
      const valor = numeroValido(j.valor, 1, 20000)
      return valor === null ? null : { valor, fecha: typeof j.fecha === 'string' ? j.fecha : null }
    }),
  ])
  const fuentes = [mep !== null || ccl !== null || oficial !== null ? 'dolarapi.com' : null, riesgo ? 'argentinadatos.com' : null].filter(Boolean)
  return { mep, ccl, oficial, riesgo_pais: riesgo?.valor ?? null, riesgo_pais_fecha: riesgo?.fecha ?? null, fuente: fuentes.join(' + ') || null }
}

function textoCotizaciones(c) {
  const f = (x) => (x === null ? 'sin dato' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(x))
  if (!c.fuente) return '- No se pudieron leer las cotizaciones de hoy: buscá los valores en páginas abiertas.'
  return [
    `- Dólar MEP: $ ${f(c.mep)} (dolarapi.com)`,
    `- Dólar contado con liquidación: $ ${f(c.ccl)} (dolarapi.com)`,
    `- Dólar oficial, venta: $ ${f(c.oficial)} (dolarapi.com)`,
    `- Riesgo país: ${f(c.riesgo_pais)} puntos${c.riesgo_pais_fecha ? ` (dato del ${c.riesgo_pais_fecha}, argentinadatos.com)` : ''}`,
  ].join('\n')
}

// ----------------------------- Instrucción -----------------------------

export function armarInstruccion({ fecha, generada, cotizaciones, rubros }) {
  const plantilla = readFileSync(join(AQUI, 'instruccion.md'), 'utf8')
  const sensibilidades = rubros
    .map((r) => `- ${r.id} (${r.nombre}): volatilidad anual ${Math.round(r.vol * 100)}%, sensibilidad Argentina ${r.beta_ar}, sensibilidad global ${r.beta_global}`)
    .join('\n')
  const lista = (ambito) =>
    PORTALES.filter((p) => p.ambito === ambito)
      .map((p) => `- ${p.nombre} (${p.dominio})${p.pago ? ' · de pago: solo titulares y resúmenes' : ''}`)
      .join('\n')
  const portales = `Argentina:\n${lista('Argentina')}\n\nMundo:\n${lista('Mundo')}`
  const texto = plantilla
    .replaceAll('{{FECHA}}', fecha)
    .replaceAll('{{GENERADA}}', generada)
    .replaceAll('{{COTIZACIONES}}', textoCotizaciones(cotizaciones))
    .replaceAll('{{SENSIBILIDADES}}', sensibilidades)
    .replaceAll('{{PORTALES}}', portales)
  const sinCompletar = texto.match(/\{\{[A-Z_]+\}\}/)
  if (sinCompletar) throw new Error(`La instrucción tiene un campo sin completar: ${sinCompletar[0]}`)
  return texto
}

// ----------------------------- Claude -----------------------------

let conRespaldoDeRechazos = true

/** Una llamada a la API, con transmisión para no chocar con los tiempos de espera. */
async function llamar(cliente, mensajes, contenedor) {
  const base = {
    model: MODELO,
    max_tokens: 32000,
    output_config: { effort: 'medium' },
    tools: [BUSQUEDA_WEB],
    messages: mensajes,
    ...(contenedor ? { container: contenedor } : {}),
  }
  if (conRespaldoDeRechazos) {
    try {
      // Si un filtro de seguridad rechaza el pedido, la API lo reintenta sola con otro modelo.
      return await cliente.beta.messages.stream({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }).finalMessage()
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError) || !/fallback|beta/i.test(e.message)) throw e
      log('aviso: la API no aceptó el respaldo de rechazos; sigo sin él.')
      conRespaldoDeRechazos = false
    }
  }
  return await cliente.messages.stream(base).finalMessage()
}

/** Un turno completo: continúa si la API pausa la búsqueda (pause_turn). */
async function turno(cliente, mensajes, uso) {
  let contenedor
  for (let pausas = 0; ; pausas++) {
    const r = await llamar(cliente, mensajes, contenedor)
    uso.entrada += r.usage?.input_tokens ?? 0
    uso.salida += r.usage?.output_tokens ?? 0
    uso.busquedas += r.usage?.server_tool_use?.web_search_requests ?? 0
    if (r.container?.id) contenedor = r.container.id
    if (r.stop_reason === 'pause_turn') {
      if (pausas >= MAX_PAUSAS) throw new Error('La búsqueda se pausó demasiadas veces seguidas.')
      // Se devuelve la respuesta pausada tal cual y la API sigue donde quedó.
      mensajes.push({ role: 'assistant', content: r.content })
      continue
    }
    if (r.stop_reason === 'refusal') throw new Error(`Claude rechazó el pedido (${r.stop_details?.category ?? 'sin categoría'}).`)
    if (r.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por longitud.')
    mensajes.push({ role: 'assistant', content: r.content })
    return r.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
  }
}

/** Pide la edición, valida y reintenta una sola vez pidiendo corregir el JSON. */
export async function generarEdicion(cliente, instruccion, { fecha, generada }) {
  const uso = { entrada: 0, salida: 0, busquedas: 0 }
  const mensajes = [{ role: 'user', content: instruccion }]
  let errores = []
  for (let intento = 1; intento <= 2; intento++) {
    const texto = await turno(cliente, mensajes, uso)
    const crudo = extraerJson(texto)
    if (!crudo) errores = ['la respuesta no contiene un objeto JSON']
    else {
      // La fecha y la hora las pone el agente, no el modelo.
      const v = validarEdicion({ ...crudo, fecha, generada, esEjemplo: undefined })
      if (v.ok) return { edicion: v.edicion, uso }
      errores = v.errores
    }
    log(`intento ${intento}: la respuesta no pasó la validación:\n  - ${errores.join('\n  - ')}`)
    if (intento === 1) {
      mensajes.push({
        role: 'user',
        content: `El JSON no pasó la validación automática. Errores:\n- ${errores.join('\n- ')}\n\nCorregilo y respondé de nuevo solo con el objeto JSON completo, con la misma forma. Buscá más solo si el error es de cobertura o de URLs; no inventes direcciones ni cifras.`,
      })
    }
  }
  const e = new Error('La edición no pasó la validación después de un reintento. No se escribió nada.')
  e.errores = errores
  throw e
}

// ----------------------------- Modo de prueba -----------------------------

function correrEnSeco() {
  log('modo de prueba (--seco): sin red, sin claves y sin escribir en la base.')
  const ejemplo = JSON.parse(readFileSync(join(AQUI, 'edicion-ejemplo.json'), 'utf8'))
  const v = validarEdicion(ejemplo)
  if (!v.ok) {
    console.error('[agente] la edición de ejemplo NO valida:\n  - ' + v.errores.join('\n  - '))
    process.exit(1)
  }
  const fecha = fechaBuenosAires()
  const instruccion = armarInstruccion({ fecha, generada: isoBuenosAires(), cotizaciones: { mep: null, ccl: null, oficial: null, riesgo_pais: null, riesgo_pais_fecha: null, fuente: null }, rubros: RUBROS_RESPALDO })
  const suma = v.edicion.escenariosAcciones.reduce((s, e) => s + e.prob, 0)
  log(`edición de ejemplo válida: ${v.edicion.items.length} noticias, ${v.edicion.escenariosAcciones.length} escenarios (probabilidades: ${suma}), ${v.edicion.fuentes.length} fuentes.`)
  log(`instrucción armada para el ${fecha}: ${instruccion.length} caracteres, ${DOMINIOS.length} portales permitidos, modelo ${MODELO}, herramienta ${BUSQUEDA_WEB.type}.`)
  log('todo en orden.')
}

// ----------------------------- Corrida real -----------------------------

async function correr() {
  const faltan = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k]?.trim())
  if (faltan.length) {
    const msg = `Faltan claves: ${faltan.join(', ')}. El agente no corrió. Los pasos para cargarlas están en PENDIENTES.md.`
    // En GitHub Actions queda como advertencia visible, sin marcar la corrida como fallida ni mandar mails todos los días.
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Agente de noticias sin claves::${msg}`)
    else console.error('[agente] ' + msg)
    process.exit(process.env.GITHUB_ACTIONS ? 0 : 1)
  }

  const base = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), { auth: { persistSession: false, autoRefreshToken: false } })
  const fecha = fechaBuenosAires()
  const generada = isoBuenosAires()
  log(`edición del ${fecha}`)

  // 1) Cotizaciones del día.
  const cot = await traerCotizaciones()
  if (cot.fuente) {
    const { error } = await base.from('cotizaciones').upsert({ fecha, mep: cot.mep, ccl: cot.ccl, oficial: cot.oficial, riesgo_pais: cot.riesgo_pais, fuente: cot.fuente, actualizada: new Date().toISOString() }, { onConflict: 'fecha' })
    if (error) throw new Error('No se pudieron guardar las cotizaciones: ' + error.message)
    log(`cotizaciones guardadas: MEP ${cot.mep ?? 's/d'}, CCL ${cot.ccl ?? 's/d'}, oficial ${cot.oficial ?? 's/d'}, riesgo país ${cot.riesgo_pais ?? 's/d'}`)
  } else {
    log('aviso: ninguna fuente de cotizaciones respondió; sigue vigente la última guardada.')
  }

  // 2) Sensibilidades vigentes de los rubros.
  const sup = await base.from('supuestos_rubros').select('id, nombre, vol, beta_ar, beta_global, orden').order('orden')
  const rubros = !sup.error && sup.data?.length ? sup.data.map((r) => ({ ...r, vol: +r.vol, beta_ar: +r.beta_ar, beta_global: +r.beta_global })) : RUBROS_RESPALDO

  // 3) Noticias y escenarios con Claude y búsqueda web.
  const cliente = new Anthropic()
  const instruccion = armarInstruccion({ fecha, generada, cotizaciones: cot, rubros })
  const { edicion, uso } = await generarEdicion(cliente, instruccion, { fecha, generada })
  log(`edición válida: ${edicion.items.length} noticias, ${edicion.escenariosAcciones.length} escenarios, ${edicion.fuentes.length} fuentes.`)
  log(`consumo: ${uso.entrada} tokens de entrada, ${uso.salida} de salida, ${uso.busquedas} búsquedas web.`)

  // 4) Publicar (reemplaza la del día si ya existía) y borrar las viejas.
  const fila = { fecha: edicion.fecha, generada: edicion.generada, panorama: edicion.panorama, escenario: edicion.escenario, items: edicion.items, escenarios_acciones: edicion.escenariosAcciones, fuentes: edicion.fuentes }
  const up = await base.from('ediciones').upsert(fila, { onConflict: 'fecha' })
  if (up.error) throw new Error('No se pudo guardar la edición: ' + up.error.message)
  const del = await base.from('ediciones').delete().lt('fecha', restarDias(fecha, DIAS_QUE_SE_GUARDAN))
  if (del.error) log('aviso: no se pudieron borrar las ediciones viejas:', del.error.message)
  log(`edición del ${fecha} publicada.`)
}

// Solo corre si se lo ejecuta directamente (los tests importan las funciones).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--seco')) correrEnSeco()
  else {
    correr().catch((e) => {
      // Mensajes claros para los errores más comunes de la API de Claude.
      if (e instanceof Anthropic.AuthenticationError) console.error('[agente] La clave de la API de Claude no es válida. Revisá el secreto ANTHROPIC_API_KEY.')
      else if (e instanceof Anthropic.RateLimitError) console.error('[agente] La API de Claude está limitando los pedidos. Mañana se vuelve a intentar.')
      else if (e instanceof Anthropic.APIConnectionError) console.error('[agente] No se pudo conectar con la API de Claude.')
      else if (e instanceof Anthropic.APIError) console.error(`[agente] Error de la API de Claude (${e.status}): ${e.message}`)
      else console.error('[agente] ' + (e?.message ?? e))
      if (e?.errores) console.error('  - ' + e.errores.join('\n  - '))
      process.exit(1)
    })
  }
}
