import { describe, expect, it } from 'vitest'
import { comprobanteDe, fecha, numero, parsearMovimientos, parsearTenencias } from './parsear'
import type { Celda } from './tipos'

// Grillas inventadas con la MISMA forma que los archivos de Inviu. Nunca datos reales:
// el repositorio es público.

const ENC_TEN = ['Ticker', 'Nombre', 'Cantidad', 'Garantía', 'Disponibles', 'Moneda', 'Precio actual', 'Monto $', 'Equivalente U$S', 'Costo (PPC)', 'Monto invertido', 'Resultado', 'Var %', 'MTM Acumulado']

/** Fila de tenencia como la arma Inviu: columnas calculadas vacías, tipo en la última. */
const filaTen = (ticker: string, nombre: string, disp: number, moneda: string, precio: number, costo: number, clase: string, varPct = 0): Celda[] => [ticker, nombre, null, 0, disp, moneda, precio, null, null, costo, null, null, varPct, `Tipo de Activo: ${clase}`]

const GRILLA_TEN: Celda[][] = [
  [],
  ['Fecha de solicitud:', '01/03/2026 10:00:00', '', '', 'Comitente:', '999999'],
  ['Fecha de valuación:', '03/03/2026', '', '', 'Nombre y apellido:', 'NOMBRE DE PRUEBA'],
  ['TC USD MEP:', 1000],
  ['TC USD CCL:', 1100],
  [],
  ['Tenencias en Portfolio'],
  [],
  ['Tipo de Activo: Moneda'],
  ENC_TEN,
  filaTen('ARS', 'Pesos', 500, 'ARS', 1, 0, 'Moneda'),
  [],
  ['', 'Subtotal Disponibilidades'],
  [],
  ['Tipo de Activo: Acciones'],
  ENC_TEN,
  filaTen('ACME', 'Acme SA', 10, 'ARS', 200, 150, 'Acciones', 33.3),
  [],
  ['', 'Subtotal Acciones'],
  [],
  ['Tipo de Activo: Cedear'],
  ENC_TEN,
  filaTen('GLOB', 'Globant CEDEAR', 5, 'USD', 20, 18, 'Cedear'),
  filaTen('CBL', 'Cable CEDEAR', 2, 'USDC', 10, 9, 'Cedear'),
  [],
  ['', 'Subtotal Cedears'],
  [],
  ['', 'Total'],
]

const GRILLA_MOV: Celda[][] = [
  ['Reporte de cuenta corriente'],
  ['Busqueda por', 'Fecha de liquidación', '', 'Cuenta comitente', '999999'],
  ['Rango', '1/1/2026 a 31/3/2026', '', 'Cliente', 'NOMBRE DE PRUEBA'],
  [],
  ['Cuenta Corriente Consolidada'],
  [],
  ['Fecha de Concertación', 'Fecha de Liquidación', 'Descripción', 'Tipo de Operación', 'Ticker', 'Cantidad VN', 'Precio', 'Import Bruto', 'Importe Neto', 'Saldo'],
  ['Disponible - Cartera monetaria'],
  ['PESOS - $'],
  ['01/03/2026', '01/03/2026', 'Recibo de Cobro / 1001', 'Recibo de Cobro', '- ', '-', 0, 10000, 10000, 10000],
  ['02/03/2026', '03/03/2026', 'Boleto / 2002 / CPRA / 10 / ACME / $', 'CPRA', 'ACME ', 10, 200, -2000, -2050, 7950],
  ['-', '-', 'Saldo al 31/3/2026', '-', '- ', '-', '-', '-', '-', 7950],
  ['Disponible - Instrumentos'],
  ['ACME SA ESCRIT, 1 - ACME /123'],
  ['02/03/2026', '03/03/2026', 'Boleto / 2002 / CPRA / 10 / ACME / $', 'CPRA', 'ACME ', 10, 200, 2000, -2050, 10],
  ['-', '-', 'Saldo al 31/3/2026', '-', '- ', '-', '-', '-', '-', 10],
]

describe('ayudantes', () => {
  it('numero acepta los dos formatos y el guion vacío', () => {
    expect(numero(1234.56)).toBe(1234.56)
    expect(numero('1.234,56')).toBe(1234.56)
    expect(numero('1,234.56')).toBe(1234.56)
    expect(numero('-')).toBe(0)
    expect(numero(null)).toBe(0)
    expect(numero('-39,08')).toBeCloseTo(-39.08, 6)
  })

  it('fecha convierte d/m/aaaa a AAAA-MM-DD', () => {
    expect(fecha('3/3/2026')).toBe('2026-03-03')
    expect(fecha('27/11/2026 20:26:45')).toBe('2026-11-27')
    expect(fecha('-')).toBe('')
  })

  it('comprobanteDe saca el número de boleto o de recibo', () => {
    expect(comprobanteDe('Boleto / 4380613 / CPRA / 1 / PAMP / $')).toBe('4380613')
    expect(comprobanteDe('Recibo de Cobro / 416019')).toBe('416019')
    expect(comprobanteDe('sin número')).toBe('')
  })
})

describe('reporte de tenencias', () => {
  const r = parsearTenencias(GRILLA_TEN)
  const de = (t: string) => r.tenencias.find((x) => x.ticker === t)!

  it('lee el encabezado', () => {
    expect(r.cuenta).toBe('999999')
    expect(r.fecha).toBe('2026-03-03')
    expect(r.tcMep).toBe(1000)
    expect(r.tcCcl).toBe(1100)
  })

  it('toma las cuatro filas de datos y saltea encabezados y subtotales', () => {
    expect(r.tenencias.map((t) => t.ticker)).toEqual(['ARS', 'ACME', 'GLOB', 'CBL'])
    expect(de('ACME').clase).toBe('Acciones')
    expect(de('CBL').clase).toBe('Cedear')
  })

  it('la cantidad sale de garantía más disponibles, no de la columna "Cantidad"', () => {
    expect(de('ACME').cantidad).toBe(10)
  })

  it('calcula en pesos lo que el Excel deja como fórmula', () => {
    expect(de('ACME').montoArs).toBe(2000)
    expect(de('ACME').invertidoArs).toBe(1500)
    expect(de('ACME').resultadoArs).toBe(500)
    expect(de('ACME').montoUsd).toBe(2)
  })

  it('convierte dólares por MEP y dólar cable por CCL', () => {
    expect(de('GLOB').montoArs).toBe(100_000)
    expect(de('GLOB').montoUsd).toBe(100)
    expect(de('GLOB').resultadoArs).toBe(10_000)
    expect(de('CBL').montoArs).toBe(22_000)
    expect(de('CBL').montoUsd).toBe(22)
    expect(de('CBL').resultadoArs).toBe(2_200)
  })

  it('sin costo de compra no inventa un resultado', () => {
    expect(de('ARS').resultadoArs).toBe(0)
  })

  it('avisa claro si el archivo no es el que corresponde', () => {
    expect(() => parsearTenencias([['otra cosa']])).toThrow(/tipo de cambio MEP/i)
  })
})

describe('reporte de cuenta corriente', () => {
  const r = parsearMovimientos(GRILLA_MOV)

  it('lee el encabezado y toma el fin del rango', () => {
    expect(r.cuenta).toBe('999999')
    expect(r.fecha).toBe('2026-03-31')
  })

  it('separa la sección monetaria de la de instrumentos', () => {
    expect(r.movimientos.map((m) => m.seccion)).toEqual(['monetaria', 'monetaria', 'instrumentos'])
  })

  it('no toma las filas de "Saldo al"', () => {
    expect(r.movimientos).toHaveLength(3)
    expect(r.movimientos.some((m) => /saldo al/i.test(m.descripcion))).toBe(false)
  })

  it('el mismo boleto en las dos secciones no choca como clave', () => {
    const dos = r.movimientos.filter((m) => m.comprobante === '2002')
    expect(dos).toHaveLength(2)
    expect(new Set(dos.map((m) => `${m.comprobante}|${m.seccion}|${m.ticker}`)).size).toBe(2)
  })

  it('lee la operación, el ticker y los importes', () => {
    const compra = r.movimientos.find((m) => m.operacion === 'CPRA' && m.seccion === 'monetaria')!
    expect(compra.ticker).toBe('ACME')
    expect(compra.cantidad).toBe(10)
    expect(compra.precio).toBe(200)
    expect(compra.neto).toBe(-2050)
    expect(compra.liquidacion).toBe('2026-03-03')
    expect(compra.moneda).toBe('ARS')
  })

  it('avisa claro si el archivo no es el que corresponde', () => {
    expect(() => parsearMovimientos([['otra cosa']])).toThrow(/no tiene movimientos/i)
  })
})
