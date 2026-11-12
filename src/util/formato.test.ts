import { describe, expect, it } from 'vitest'
import { compacto, conSigno1, formatoMoneda, pct, pctS } from './formato'

// Intl usa espacio de no separación en algunos entornos: se normaliza para comparar.
const limpio = (s: string) => s.replace(/ /g, ' ')

describe('formato', () => {
  it('porcentajes con coma decimal y signo', () => {
    expect(pct(0.123)).toBe('12,3%')
    expect(pctS(0.221)).toBe('+22,1%')
    expect(pctS(-0.39)).toBe('−39,0%')
    expect(pctS(0)).toBe('0,0%')
    expect(conSigno1(-0.6)).toBe('−0,6')
  })

  it('montos en pesos multiplican por el MEP y en dólares no', () => {
    const ars = formatoMoneda('ARS', 1500)
    const usd = formatoMoneda('USD', 1500)
    expect(limpio(ars.monto(1000))).toBe('$ 1.500.000')
    expect(limpio(usd.monto(1000))).toBe('US$ 1.000')
    expect(limpio(ars.montoS(-10))).toBe('−$ 15.000')
  })

  it('montos compactos para los ejes', () => {
    expect(compacto(1_500_000)).toBe('1,5 M')
    expect(compacto(25_000)).toBe('25 mil')
  })
})
