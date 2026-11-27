// Esquema de la edición diaria. El agente no escribe nada en la base si la respuesta no pasa esta validación.
import { z } from 'zod'
import { portalDe } from './portales.mjs'

export const RUBROS = ['pesos', 'mep', 'soberanos', 'ons', 'cer', 'merval', 'cedears']

const texto = (min, max) => z.string().trim().min(min).max(max)
const factor = z.number().min(-3).max(3)
const ajuste = z.number().min(-0.1).max(0.1)
const urlPortal = z.string().refine((u) => portalDe(u) !== null, { message: 'tiene que ser una URL https de uno de los portales permitidos' })
// Para ediciones que no vienen del agente de este repositorio: el agente busca solo en los
// portales permitidos, pero la tarea programada de Claude busca en la web abierta y cita
// medios buenos que no están en esa lista. Ahí se exige https y se mide la diversidad aparte.
const urlHttps = z.string().refine((u) => /^https:\/\/[^\s]+$/i.test(String(u)), { message: 'tiene que ser una URL https' })
const identificador = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{1,48}$/, 'identificador corto en minúsculas, con guiones')

export const esquemaNoticia = z.object({
  id: identificador,
  titulo: texto(8, 200),
  ambito: z.enum(['Argentina', 'Mundo']),
  fuente: texto(2, 60),
  url: urlPortal,
  resumen: texto(20, 700),
  canal: texto(10, 500),
  factorAR: factor,
  factorGlobal: factor,
  ajustes: z.partialRecord(z.enum(RUBROS), ajuste).default({}),
  horizonte: z.enum(['días', 'semanas', 'meses']),
  confianza: z.enum(['baja', 'media', 'alta']),
})

export const esquemaEscenarioAcciones = z.object({
  id: identificador,
  nombre: texto(4, 70),
  prob: z.number().min(0).max(100),
  riesgoPais: z.number().min(-1500).max(3000),
  spx: z.number().min(-60).max(60),
  tasas: z.number().min(-300).max(300),
  petroleo: z.number().min(-80).max(150),
  dolar: z.number().min(-50).max(200),
  descripcion: texto(20, 500),
  senales: z.array(texto(5, 160)).min(2).max(3),
})

export const esquemaNoticiaAbierta = esquemaNoticia.extend({ url: urlHttps })

export const COBERTURA = { argentina: 3, mundo: 2 }
/** Mínimo de medios distintos cuando no se exige la lista de portales. */
export const DIVERSIDAD = { argentina: 2, total: 4 }

/** Dominio de una URL, sin "www.", o null si no es una URL https. */
export function dominioDe(url) {
  try {
    const u = new URL(String(url))
    return u.protocol === 'https:' ? u.hostname.toLowerCase().replace(/^www\./, '') : null
  } catch {
    return null
  }
}

/** Campos comunes a las dos variantes; cambian la regla de la URL y la de cobertura. */
const cuerpoEdicion = (esqNoticia, urlRegla, minFuentes = 5) =>
  z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha con forma AAAA-MM-DD'),
    generada: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'fecha y hora en formato ISO' }),
    panorama: texto(60, 1200),
    escenario: z.object({ factorAR: factor, factorGlobal: factor, explicacion: texto(20, 700) }),
    items: z.array(esqNoticia).min(6).max(10),
    escenariosAcciones: z.array(esquemaEscenarioAcciones).min(4).max(6),
    fuentes: z.array(z.object({ portal: texto(2, 60), url: urlRegla })).min(minFuentes).max(40),
    // Solo lo lleva la edición de ejemplo incluida en el código.
    esEjemplo: z.boolean().optional(),
  })

/** Revisiones que valen para cualquier edición: probabilidades e ids. */
function revisarComunes(e, ctx) {
  const suma = e.escenariosAcciones.reduce((s, x) => s + x.prob, 0)
  if (Math.abs(suma - 100) > 1) ctx.addIssue({ code: 'custom', path: ['escenariosAcciones'], message: `las probabilidades suman ${suma}; tienen que sumar 100 (±1)` })

  for (const [campo, lista] of [
    ['items', e.items],
    ['escenariosAcciones', e.escenariosAcciones],
  ]) {
    const ids = lista.map((x) => x.id)
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i)
    if (repetidos.length) ctx.addIssue({ code: 'custom', path: [campo], message: `ids repetidos: ${[...new Set(repetidos)].join(', ')}` })
  }
}

/** Cobertura por la lista de portales permitidos (agente de este repositorio). */
function revisarCobertura(e, ctx) {
  const vistos = { Argentina: new Set(), Mundo: new Set() }
  for (const u of [...e.items.map((i) => i.url), ...e.fuentes.map((f) => f.url)]) {
    const p = portalDe(u)
    if (p) vistos[p.ambito].add(p.nombre)
  }
  if (vistos.Argentina.size < COBERTURA.argentina) {
    ctx.addIssue({ code: 'custom', path: ['fuentes'], message: `cobertura insuficiente: ${vistos.Argentina.size} portales argentinos (${[...vistos.Argentina].join(', ') || 'ninguno'}); hacen falta al menos ${COBERTURA.argentina}` })
  }
  if (vistos.Mundo.size < COBERTURA.mundo) {
    ctx.addIssue({ code: 'custom', path: ['fuentes'], message: `cobertura insuficiente: ${vistos.Mundo.size} portales internacionales (${[...vistos.Mundo].join(', ') || 'ninguno'}); hacen falta al menos ${COBERTURA.mundo}` })
  }
}

/**
 * Diversidad por medios distintos, sin exigir la lista de portales. Lo que se quiere evitar es
 * una edición armada con una sola fuente, o leída enteramente desde afuera. No se pide que las
 * noticias del mundo vengan de medios extranjeros: un diario argentino cubriendo a la Fed sirve.
 */
function revisarDiversidad(e, ctx) {
  const argentinos = new Set()
  const todos = new Set()
  for (const it of e.items) {
    const d = dominioDe(it.url)
    if (!d) continue
    todos.add(d)
    if (it.ambito === 'Argentina') argentinos.add(d)
  }
  if (argentinos.size < DIVERSIDAD.argentina) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: `pocos medios distintos en las noticias de Argentina: ${argentinos.size} (${[...argentinos].join(', ') || 'ninguno'}); hacen falta al menos ${DIVERSIDAD.argentina}` })
  }
  if (todos.size < DIVERSIDAD.total) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: `la edición sale de ${todos.size} medio(s) distinto(s); hacen falta al menos ${DIVERSIDAD.total}` })
  }
}

export const esquemaEdicion = cuerpoEdicion(esquemaNoticia, urlPortal).superRefine((e, ctx) => {
  revisarComunes(e, ctx)
  revisarCobertura(e, ctx)
})

/** Variante para ediciones armadas fuera de este repositorio (tarea programada de Claude). */
export const esquemaEdicionAbierta = cuerpoEdicion(esquemaNoticiaAbierta, urlHttps, 0).superRefine((e, ctx) => {
  revisarComunes(e, ctx)
  revisarDiversidad(e, ctx)
})

/**
 * Valida una edición.
 * @returns {{ ok: true, edicion: import('zod').infer<typeof esquemaEdicion> } | { ok: false, errores: string[] }}
 */
export function validarEdicion(dato) {
  const r = esquemaEdicion.safeParse(dato)
  if (r.success) return { ok: true, edicion: r.data }
  return { ok: false, errores: r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`) }
}

/**
 * Igual que validarEdicion, pero sin exigir que cada URL sea de la lista de portales.
 * @returns {{ ok: true, edicion: object } | { ok: false, errores: string[] }}
 */
export function validarEdicionAbierta(dato) {
  const r = esquemaEdicionAbierta.safeParse(dato)
  if (r.success) return { ok: true, edicion: r.data }
  return { ok: false, errores: r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`) }
}

/**
 * Saca el objeto JSON de la edición del texto que devuelve el modelo,
 * aunque venga rodeado de comentarios o dentro de un bloque ```json.
 */
export function extraerJson(texto) {
  const s = String(texto ?? '')
  let mejor = null
  for (let inicio = s.indexOf('{'); inicio !== -1; inicio = s.indexOf('{', inicio + 1)) {
    let nivel = 0
    let enCadena = false
    let escape = false
    for (let i = inicio; i < s.length; i++) {
      const c = s[i]
      if (enCadena) {
        if (escape) escape = false
        else if (c === '\\') escape = true
        else if (c === '"') enCadena = false
        continue
      }
      if (c === '"') enCadena = true
      else if (c === '{') nivel++
      else if (c === '}' && --nivel === 0) {
        try {
          const obj = JSON.parse(s.slice(inicio, i + 1))
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            if ('items' in obj || 'panorama' in obj) return obj
            mejor ??= obj
          }
        } catch {
          /* no era JSON: se prueba con la siguiente llave */
        }
        break
      }
    }
  }
  return mejor
}
