// Lectura de los dos reportes que exporta Inviu (Reportes > Portfolio y > Cuenta corriente).
//
// Los dos archivos traen las columnas de plata VACÍAS: Inviu las deja como fórmulas de Excel
// y no las calcula al generar el archivo. Por eso acá se recalculan con las mismas fórmulas
// que trae adentro el .xlsx, para que los números den idénticos a los que muestra la web.
//
// Estas funciones son puras: reciben la grilla de celdas y no tocan ni red ni disco.

import { type Celda, ErrorInviu, type Movimiento, type ReporteMovimientos, type ReporteTenencias, type Tenencia } from './tipos'

const texto = (c: Celda): string => (c == null ? '' : String(c).trim())

/** Número tolerante: acepta 1.234,56 y 1234.56, y devuelve 0 si no hay nada. */
export function numero(c: Celda): number {
  if (typeof c === 'number') return Number.isFinite(c) ? c : 0
  const s = texto(c)
  if (!s || s === '-') return 0
  // Si tiene coma decimal, los puntos son separadores de miles.
  const limpio = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  const n = Number(limpio.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Fecha de Inviu (d/m/aaaa, con o sin hora) a AAAA-MM-DD. '' si no es una fecha. */
export function fecha(c: Celda): string {
  if (c instanceof Date && !Number.isNaN(c.getTime())) return c.toISOString().slice(0, 10)
  const s = texto(c)
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return ''
}

/** Busca el valor que sigue a una etiqueta, en cualquier fila y columna del encabezado. */
function trasEtiqueta(filas: Celda[][], etiqueta: string, hasta = 8): Celda {
  const buscada = etiqueta.toLowerCase()
  for (const fila of filas.slice(0, hasta)) {
    for (let i = 0; i < fila.length; i++) {
      if (texto(fila[i]).toLowerCase().startsWith(buscada)) return fila[i + 1]
    }
  }
  return null
}

// ---------------------------------------------------------------- tenencias

/** Las fórmulas del propio Excel de Inviu, para que los montos coincidan. */
export function calcular(t: Omit<Tenencia, 'montoArs' | 'montoUsd' | 'invertidoArs' | 'resultadoArs'>, tcMep: number, tcCcl: number) {
  const { cantidad: c, precio: g, costo: j, moneda: f, clase } = t
  if (clase.toUpperCase() === 'FUTURE') {
    return { montoArs: 0, montoUsd: 0, invertidoArs: 0, resultadoArs: (g - j) * c * 1000 }
  }
  // Monto en pesos: los dólares cable van por CCL y el resto de las divisas por MEP.
  const aPesos = (v: number) => (f === 'ARS' ? v : f === 'USDC' ? v * tcCcl : v * tcMep)
  const montoArs = aPesos(c * g)
  const montoUsd = f === 'ARS' ? (tcMep ? (c * g) / tcMep : 0) : f === 'USDC' ? (tcMep ? (c * g * tcCcl) / tcMep : 0) : c * g
  const invertidoArs = c * j
  const resultadoArs = j > 0 ? (t.ticker === 'CT' ? aPesos(g) + aPesos(j) : aPesos(c * g) - aPesos(c * j)) : 0
  return { montoArs, montoUsd, invertidoArs, resultadoArs }
}

export function parsearTenencias(filas: Celda[][]): ReporteTenencias {
  const tcMep = numero(trasEtiqueta(filas, 'tc usd mep'))
  const tcCcl = numero(trasEtiqueta(filas, 'tc usd ccl'))
  const f = fecha(trasEtiqueta(filas, 'fecha de valuación')) || fecha(trasEtiqueta(filas, 'fecha de solicitud'))
  const cuenta = texto(trasEtiqueta(filas, 'comitente'))
  if (!tcMep) throw new ErrorInviu('No encontré el tipo de cambio MEP en el encabezado. ¿Es el reporte de Portfolio de Inviu?')
  if (!f) throw new ErrorInviu('No encontré la fecha de valuación en el encabezado.')

  const tenencias: Tenencia[] = []
  for (const fila of filas) {
    // Las filas con datos llevan el tipo de activo repetido en la última columna.
    const clase = /^Tipo de Activo:\s*(.+)$/i.exec(texto(fila[13]))?.[1]?.trim()
    const ticker = texto(fila[0])
    if (!clase || !ticker || ticker.toLowerCase() === 'ticker') continue

    const base = {
      ticker,
      nombre: texto(fila[1]),
      clase,
      moneda: texto(fila[5]) || 'ARS',
      // La cantidad real es garantía + disponibles; la columna "Cantidad" viene vacía.
      cantidad: numero(fila[3]) + numero(fila[4]),
      precio: numero(fila[6]),
      costo: numero(fila[9]),
      varPct: numero(fila[12]),
    }
    tenencias.push({ ...base, ...calcular(base, tcMep, tcCcl) })
  }
  if (!tenencias.length) throw new ErrorInviu('El archivo no tiene ninguna tenencia.')
  return { cuenta, fecha: f, tcMep, tcCcl, tenencias }
}

// -------------------------------------------------------------- movimientos

/** Número de boleto o de recibo que viene dentro de la descripción. */
export function comprobanteDe(descripcion: string): string {
  return /\/\s*(\d+)/.exec(descripcion)?.[1] ?? ''
}

const MONEDAS: [RegExp, string][] = [
  [/d[oó]lar.*cable|u\$s\.?c|usdc/i, 'USDC'],
  [/d[oó]lar|u\$s|usd/i, 'USD'],
  [/peso|\$/i, 'ARS'],
]

export function parsearMovimientos(filas: Celda[][]): ReporteMovimientos {
  const cuenta = texto(trasEtiqueta(filas, 'cuenta comitente'))
  const rango = texto(trasEtiqueta(filas, 'rango'))
  const f = fecha(rango.split(/\s+a\s+/).pop()) || fecha(rango)

  const movimientos: Movimiento[] = []
  let seccion: 'monetaria' | 'instrumentos' | null = null
  let moneda = 'ARS'

  for (const fila of filas) {
    const a = texto(fila[0])
    // Encabezado de sección: "Disponible - Cartera monetaria" / "Disponible - Instrumentos".
    if (/^disponible\s*-/i.test(a)) {
      seccion = /instrumento/i.test(a) ? 'instrumentos' : 'monetaria'
      continue
    }
    // Subtítulo: la moneda dentro de la sección monetaria, el instrumento en la otra.
    if (a && !/^\d{1,2}\//.test(a) && a !== '-' && texto(fila[2]) === '') {
      if (seccion === 'monetaria') moneda = MONEDAS.find(([re]) => re.test(a))?.[1] ?? moneda
      continue
    }
    const descripcion = texto(fila[2])
    // Las filas de cierre ("Saldo al ...") no tienen fecha.
    const concertacion = fecha(fila[0])
    if (!seccion || !descripcion || !concertacion) continue

    const comprobante = comprobanteDe(descripcion)
    if (!comprobante) continue
    movimientos.push({
      comprobante,
      seccion,
      ticker: texto(fila[4]).replace(/\s+$/, ''),
      concertacion,
      liquidacion: fecha(fila[1]) || concertacion,
      descripcion,
      operacion: texto(fila[3]),
      moneda,
      cantidad: numero(fila[5]) || null,
      precio: numero(fila[6]) || null,
      bruto: numero(fila[7]) || null,
      neto: numero(fila[8]) || null,
      saldo: numero(fila[9]) || null,
    })
  }
  if (!movimientos.length) throw new ErrorInviu('El archivo no tiene movimientos. ¿Es el reporte de Cuenta corriente de Inviu?')
  return { cuenta, fecha: f, movimientos }
}
