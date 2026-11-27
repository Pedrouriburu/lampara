// Puente entre el archivo que elige el usuario y las funciones puras de `parsear`.
// Lee el .xlsx en el navegador: el archivo nunca sale de la computadora, solo suben
// a la base las filas ya interpretadas.

import { readSheet } from 'read-excel-file/browser'
import { parsearMovimientos, parsearTenencias } from './parsear'
import { type Celda, ErrorInviu, type ReporteMovimientos, type ReporteTenencias } from './tipos'

const MAX_BYTES = 10 * 1024 * 1024

async function grilla(archivo: File): Promise<Celda[][]> {
  if (archivo.size > MAX_BYTES) throw new ErrorInviu('El archivo pesa más de 10 MB; no parece un reporte de Inviu.')
  if (!/\.xlsx$/i.test(archivo.name)) throw new ErrorInviu('Tiene que ser el .xlsx que descarga Inviu, no un PDF ni un CSV.')
  try {
    // readSheet devuelve la primera hoja como grilla; los dos reportes traen una sola.
    return await readSheet(archivo)
  } catch {
    throw new ErrorInviu('No pude abrir el archivo. ¿Se descargó completo?')
  }
}

export const leerTenencias = async (archivo: File): Promise<ReporteTenencias> => parsearTenencias(await grilla(archivo))
export const leerMovimientos = async (archivo: File): Promise<ReporteMovimientos> => parsearMovimientos(await grilla(archivo))

/**
 * Reconoce cuál de los dos reportes es, porque los nombres que pone Inviu no ayudan:
 * el de cuenta corriente se descarga como "inviu-voucher-<fecha>.xlsx".
 */
export async function leerReporte(archivo: File): Promise<{ tipo: 'tenencias'; datos: ReporteTenencias } | { tipo: 'movimientos'; datos: ReporteMovimientos }> {
  const g = await grilla(archivo)
  const primeras = g
    .slice(0, 8)
    .map((f) => f.map((c) => (c == null ? '' : String(c))).join(' '))
    .join(' ')
    .toLowerCase()
  if (primeras.includes('cuenta corriente')) return { tipo: 'movimientos', datos: parsearMovimientos(g) }
  if (primeras.includes('tc usd mep') || primeras.includes('tenencias')) return { tipo: 'tenencias', datos: parsearTenencias(g) }
  throw new ErrorInviu('No reconozco este archivo. Tiene que ser el reporte de Portfolio o el de Cuenta corriente de Inviu.')
}
