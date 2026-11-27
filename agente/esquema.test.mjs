import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { armarInstruccion, fechaBuenosAires, isoBuenosAires, restarDias } from './correr.mjs'
import { extraerJson, validarEdicion, validarEdicionAbierta } from './esquema.mjs'
import { completarFuentes } from './publicar.mjs'
import { DOMINIOS, portalDe, PORTALES } from './portales.mjs'

const ejemplo = () => JSON.parse(readFileSync(new URL('./edicion-ejemplo.json', import.meta.url), 'utf8'))
const errores = (e) => {
  const v = validarEdicion(e)
  return v.ok ? [] : v.errores
}

describe('esquema de la edición', () => {
  it('la edición de ejemplo es válida y está marcada como ejemplo', () => {
    const v = validarEdicion(ejemplo())
    expect(v.ok).toBe(true)
    expect(v.edicion.esEjemplo).toBe(true)
    expect(v.edicion.items.length).toBeGreaterThanOrEqual(6)
    for (const n of v.edicion.items) expect(n.titulo.startsWith('Ejemplo')).toBe(true)
  })

  it('rechaza probabilidades que no suman 100 (±1)', () => {
    const e = ejemplo()
    e.escenariosAcciones[0].prob = 20
    expect(errores(e).join(' ')).toMatch(/suman 85/)
    e.escenariosAcciones[0].prob = 35.8
    expect(errores(e)).toEqual([])
  })

  it('rechaza factores fuera de −3 a 3 y ajustes fuera de −0,10 a 0,10', () => {
    const e = ejemplo()
    e.items[0].factorAR = -3.5
    e.items[1].ajustes = { pesos: 0.2 }
    e.escenario.factorGlobal = 4
    const err = errores(e).join('\n')
    expect(err).toMatch(/items\.0\.factorAR/)
    expect(err).toMatch(/items\.1\.ajustes\.pesos/)
    expect(err).toMatch(/escenario\.factorGlobal/)
  })

  it('rechaza ajustes sobre rubros que no existen y campos obligatorios faltantes', () => {
    const e = ejemplo()
    e.items[0].ajustes = { bitcoin: 0.05 }
    delete e.items[2].canal
    delete e.panorama
    const err = errores(e).join('\n')
    expect(err).toMatch(/items\.0\.ajustes/)
    expect(err).toMatch(/items\.2\.canal/)
    expect(err).toMatch(/panorama/)
  })

  it('rechaza URLs que no son https o no son de un portal permitido', () => {
    for (const url of ['http://www.infobae.com/economia/', 'https://www.ejemplo-trucho.com/nota', 'https://infobae.com.evil.io/x', 'no es una url']) {
      const e = ejemplo()
      e.items[0].url = url
      expect(errores(e).join(' ')).toMatch(/items\.0\.url/)
    }
  })

  it('exige cobertura: tres portales argentinos y dos internacionales', () => {
    const e = ejemplo()
    for (const n of e.items) if (n.ambito === 'Mundo') n.url = 'https://www.reuters.com/markets/'
    e.fuentes = e.fuentes.filter((f) => !['CNBC', 'Associated Press', 'MarketWatch'].includes(f.portal))
    expect(errores(e).join(' ')).toMatch(/1 portales internacionales/)

    const a = ejemplo()
    for (const n of a.items) if (n.ambito === 'Argentina') n.url = 'https://www.infobae.com/economia/'
    a.fuentes = a.fuentes.filter((f) => !['Ámbito', 'La Nación', 'El Cronista'].includes(f.portal))
    expect(errores(a).join(' ')).toMatch(/1 portales argentinos/)
  })

  it('exige entre 6 y 10 noticias, entre 4 y 6 escenarios e ids sin repetir', () => {
    const e = ejemplo()
    e.items = e.items.slice(0, 5)
    expect(errores(e).join(' ')).toMatch(/items/)
    const r = ejemplo()
    r.items[1].id = r.items[0].id
    expect(errores(r).join(' ')).toMatch(/ids repetidos/)
    const s = ejemplo()
    s.escenariosAcciones = s.escenariosAcciones.slice(0, 3)
    expect(errores(s).join(' ')).toMatch(/escenariosAcciones/)
  })
})

describe('portales', () => {
  it('reconoce subdominios pero no dominios parecidos', () => {
    expect(portalDe('https://www.infobae.com/economia/2026/nota/')?.nombre).toBe('Infobae')
    expect(portalDe('https://es.investing.com/news/x')?.nombre).toBe('Investing.com en español')
    expect(portalDe('https://www.bloomberglinea.com/x')?.nombre).toBe('Bloomberg Línea')
    expect(portalDe('https://www.bloomberg.com/x')?.pago).toBe(true)
    expect(portalDe('https://www.investing.com/news/x')).toBeNull()
    expect(portalDe('https://notinfobae.com/')).toBeNull()
  })

  it('hay 14 portales argentinos y 12 del mundo, con dominios sin esquema', () => {
    expect(PORTALES.filter((p) => p.ambito === 'Argentina')).toHaveLength(14)
    expect(PORTALES.filter((p) => p.ambito === 'Mundo')).toHaveLength(12)
    for (const d of DOMINIOS) expect(d).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/)
  })
})

describe('respuesta del modelo', () => {
  it('extrae el JSON aunque venga con texto alrededor o en un bloque de código', () => {
    const obj = { panorama: 'hola {con llaves} y "comillas"', items: [{ a: 1 }] }
    expect(extraerJson(JSON.stringify(obj))).toEqual(obj)
    expect(extraerJson('Acá va la edición:\n```json\n' + JSON.stringify(obj, null, 2) + '\n```\nListo.')).toEqual(obj)
    expect(extraerJson('Busqué {varias} cosas. ' + JSON.stringify(obj))).toEqual(obj)
    expect(extraerJson('sin json')).toBeNull()
    expect(extraerJson('{ roto: ')).toBeNull()
  })
})

describe('fechas e instrucción', () => {
  it('usa la fecha de Buenos Aires, no la del servidor', () => {
    // 02:30 UTC del 13 todavía es 23:30 del 12 en Buenos Aires.
    const t = new Date('2026-11-13T02:30:00Z')
    expect(fechaBuenosAires(t)).toBe('2026-11-12')
    expect(isoBuenosAires(t)).toBe('2026-11-12T23:30:00-03:00')
    expect(restarDias('2026-11-12', 60)).toBe('2026-09-13')
  })

  it('completa la instrucción con la fecha, las cotizaciones, las sensibilidades y los portales', () => {
    const txt = armarInstruccion({
      fecha: '2026-11-12',
      generada: '2026-11-12T08:04:00-03:00',
      cotizaciones: { mep: 1572.4, ccl: 1664.8, oficial: 1570, riesgo_pais: 852, riesgo_pais_fecha: '2026-11-11', fuente: 'dolarapi.com + argentinadatos.com' },
      rubros: [{ id: 'merval', nombre: 'Acciones argentinas (Merval)', vol: 0.42, beta_ar: 0.8, beta_global: 0.3 }],
    })
    expect(txt).not.toMatch(/\{\{/)
    expect(txt).toContain('Fecha de hoy en Buenos Aires: 2026-11-12')
    expect(txt).toContain('1.572,4')
    expect(txt).toContain('merval (Acciones argentinas (Merval)): volatilidad anual 42%')
    expect(txt).toContain('Financial Times (ft.com) · de pago')
    expect(txt.startsWith('Sos el analista de noticias de Lámpara')).toBe(true)
  })
})

describe('conversación con Claude (cliente simulado)', () => {
  // Cliente falso: devuelve respuestas preparadas y anota lo que recibe.
  const clienteFalso = (respuestas) => {
    const pedidos = []
    const stream = (params) => {
      pedidos.push(JSON.parse(JSON.stringify(params)))
      const r = respuestas.shift()
      return { finalMessage: async () => r }
    }
    return { pedidos, beta: { messages: { stream } }, messages: { stream } }
  }
  const texto = (t, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text: t }], usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 2 } } })
  const datos = { fecha: '2026-11-20', generada: '2026-11-20T08:01:00-03:00' }

  it('continúa después de una pausa, pone la fecha del día y publica una edición válida', async () => {
    const { generarEdicion } = await import('./correr.mjs')
    const pausa = { stop_reason: 'pause_turn', container: { id: 'cont_1' }, content: [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'riesgo país' } }], usage: { input_tokens: 1, output_tokens: 1 } }
    const cliente = clienteFalso([pausa, texto('Listo:\n' + JSON.stringify(ejemplo()))])
    const { edicion, uso } = await generarEdicion(cliente, 'instrucción', datos)
    expect(edicion.fecha).toBe('2026-11-20')
    expect(edicion.generada).toBe(datos.generada)
    expect(edicion.esEjemplo).toBeUndefined()
    expect(uso.busquedas).toBe(2)
    // La segunda llamada reenvía la respuesta pausada tal cual y conserva el contenedor y la herramienta.
    expect(cliente.pedidos).toHaveLength(2)
    expect(cliente.pedidos[1].messages[1]).toEqual({ role: 'assistant', content: pausa.content })
    expect(cliente.pedidos[1].container).toBe('cont_1')
    expect(cliente.pedidos[1].tools[0].allowed_domains).toEqual(DOMINIOS)
    expect(cliente.pedidos[0].model).toBe('claude-sonnet-5-5')
  })

  it('si el JSON no valida, pide corregirlo una sola vez', async () => {
    const { generarEdicion } = await import('./correr.mjs')
    const malo = ejemplo()
    malo.escenariosAcciones[0].prob = 5
    const cliente = clienteFalso([texto(JSON.stringify(malo)), texto(JSON.stringify(ejemplo()))])
    const { edicion } = await generarEdicion(cliente, 'instrucción', datos)
    expect(edicion.items).toHaveLength(8)
    const ultimo = cliente.pedidos[1].messages.at(-1)
    expect(ultimo.role).toBe('user')
    expect(ultimo.content).toMatch(/suman 70/)
  })

  it('si vuelve a fallar, no devuelve nada y termina con error', async () => {
    const { generarEdicion } = await import('./correr.mjs')
    const cliente = clienteFalso([texto('no hay json'), texto('{"items": []}')])
    await expect(generarEdicion(cliente, 'instrucción', datos)).rejects.toThrow(/no pasó la validación/)
    expect(cliente.pedidos).toHaveLength(2)
  })

  it('un rechazo de Claude corta la corrida', async () => {
    const { generarEdicion } = await import('./correr.mjs')
    const cliente = clienteFalso([{ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [], usage: {} }])
    await expect(generarEdicion(cliente, 'instrucción', datos)).rejects.toThrow(/rechazó/)
  })
})

describe('esquema abierto (ediciones armadas fuera de este repositorio)', () => {
  /** La edición de ejemplo, pero citando medios que no están en la lista de portales. */
  const deOtrosMedios = () => {
    const e = ejemplo()
    const medios = ['https://www.investing.com/n/1', 'https://finance.yahoo.com/n/2', 'https://tradingeconomics.com/n/3', 'https://forbesargentina.com/n/4']
    e.items.forEach((n, i) => (n.url = medios[i % medios.length]))
    e.fuentes = []
    return e
  }

  it('acepta medios fuera de la lista de portales, que el esquema estricto rechaza', () => {
    const e = deOtrosMedios()
    expect(validarEdicion(e).ok).toBe(false)
    const v = validarEdicionAbierta(completarFuentes(e))
    expect(v.ok ? [] : v.errores).toEqual([])
  })

  it('sigue exigiendo https', () => {
    const e = deOtrosMedios()
    e.items[0].url = 'http://investing.com/n/1'
    const v = validarEdicionAbierta(completarFuentes(e))
    expect(v.ok).toBe(false)
    expect(v.errores.join(' ')).toMatch(/items\.0\.url/)
  })

  it('rechaza una edición armada con un solo medio', () => {
    const e = ejemplo()
    e.items.forEach((n, i) => (n.url = `https://www.ambito.com/n/${i}`))
    e.fuentes = []
    const v = validarEdicionAbierta(completarFuentes(e))
    expect(v.ok).toBe(false)
    expect(v.errores.join(' ')).toMatch(/1 medio\(s\) distinto/)
  })

  it('rechaza una edición sin prensa argentina propia', () => {
    const e = deOtrosMedios()
    e.items.forEach((n) => (n.ambito = 'Mundo'))
    const v = validarEdicionAbierta(completarFuentes(e))
    expect(v.ok).toBe(false)
    expect(v.errores.join(' ')).toMatch(/medios distintos en las noticias de Argentina/)
  })

  it('completarFuentes deduce las fuentes de las noticias y respeta las que ya vienen', () => {
    const e = deOtrosMedios()
    e.items[1].url = e.items[0].url // repetida: cuenta una sola vez
    const deducidas = completarFuentes(e).fuentes
    expect(deducidas.length).toBe(new Set(e.items.map((n) => n.url)).size)
    expect(deducidas.every((f) => f.portal && f.url.startsWith('https://'))).toBe(true)

    const yaTraia = completarFuentes({ ...e, fuentes: [{ portal: 'Ámbito', url: 'https://www.ambito.com/x' }] })
    expect(yaTraia.fuentes.length).toBe(1)
  })
})
