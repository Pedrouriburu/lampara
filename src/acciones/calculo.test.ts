import { describe, expect, it } from 'vitest'
import { filasGrupo, mejoresEnEscenario, normalizarEscenarios, pesosIguales, resultadoSeleccion, resumenAccion, retAccion, seleccionEquilibrada } from './calculo'
import { ESCENARIOS_RESPALDO } from './escenarios'
import { UNIVERSO_BASE } from './universo'

const accion = (t: string) => UNIVERSO_BASE.find((a) => a.ticker === t)!
const escenario = (id: string) => ESCENARIOS_RESPALDO.find((e) => e.id === id)!

describe('acciones por escenario', () => {
  it('el universo tiene 15 acciones del Merval y 17 CEDEARs', () => {
    expect(UNIVERSO_BASE.filter((a) => a.grupo === 'merval')).toHaveLength(15)
    expect(UNIVERSO_BASE.filter((a) => a.grupo === 'cedears')).toHaveLength(17)
    expect(new Set(UNIVERSO_BASE.map((a) => a.ticker)).size).toBe(UNIVERSO_BASE.length)
  })

  it('las probabilidades de los escenarios de respaldo suman 100', () => {
    expect(ESCENARIOS_RESPALDO.reduce((s, e) => s + e.prob, 0)).toBe(100)
  })

  it('GGAL da +22,1% si se calma el riesgo país y −39,0% con salto cambiario', () => {
    expect(retAccion(accion('GGAL'), escenario('calma'))).toBeCloseTo(0.221, 10)
    expect(retAccion(accion('GGAL'), escenario('salto'))).toBeCloseTo(-0.39, 10)
  })

  it('la variación se acota en −90%', () => {
    expect(retAccion(accion('SUPV'), { riesgoPais: 2000, spx: -30, tasas: 0, petroleo: 0, dolar: 50 })).toBe(-0.9)
  })

  it('la selección equilibrada del Merval es ALUA, TXAR, CRES y TGSU2', () => {
    const filas = filasGrupo(UNIVERSO_BASE, 'merval', ESCENARIOS_RESPALDO)
    expect(seleccionEquilibrada(filas).map((f) => f.a.ticker)).toEqual(['ALUA', 'TXAR', 'CRES', 'TGSU2'])
  })

  it('esperado pondera por probabilidad y usa proporción si no suman 100', () => {
    const r = resumenAccion(accion('GGAL'), ESCENARIOS_RESPALDO)
    const aMano = ESCENARIOS_RESPALDO.reduce((s, e) => s + (retAccion(accion('GGAL'), e) * e.prob) / 100, 0)
    expect(r.esperado).toBeCloseTo(aMano, 12)
    expect(r.peor).toBeCloseTo(-0.39, 10)
    expect(r.puntaje).toBeCloseTo(r.esperado + 0.5 * r.peor, 12)
    const mitad = ESCENARIOS_RESPALDO.map((e) => ({ ...e, prob: e.prob / 2 }))
    expect(resumenAccion(accion('GGAL'), mitad).esperado).toBeCloseTo(r.esperado, 12)
  })

  it('mejores por escenario: los bancos lideran si se calma el riesgo país', () => {
    const filas = filasGrupo(UNIVERSO_BASE, 'merval', ESCENARIOS_RESPALDO)
    const i = ESCENARIOS_RESPALDO.findIndex((e) => e.id === 'calma')
    const top = mejoresEnEscenario(filas, i).map((f) => f.a.ticker)
    expect(top).toHaveLength(3)
    expect(top[0]).toBe('SUPV')
  })

  it('"Usar estas en mi selección" reparte en pesos iguales que suman 100', () => {
    const p = pesosIguales(['A', 'B', 'C'])
    expect(p.A + p.B + p.C).toBeCloseTo(100, 9)
    expect(p.B).toBe(33.3)
  })

  it('tu selección: resultado por escenario, esperado y peor caso', () => {
    const r = resultadoSeleccion({ GGAL: 50, ALUA: 50 }, UNIVERSO_BASE, ESCENARIOS_RESPALDO)!
    const i = ESCENARIOS_RESPALDO.findIndex((e) => e.id === 'calma')
    const aMano = 0.5 * retAccion(accion('GGAL'), escenario('calma')) + 0.5 * retAccion(accion('ALUA'), escenario('calma'))
    expect(r.rets[i]).toBeCloseTo(aMano, 12)
    expect(r.peor).toBe(Math.min(...r.rets))
    expect(resultadoSeleccion({}, UNIVERSO_BASE, ESCENARIOS_RESPALDO)).toBeNull()
    // Un ticker que ya no existe se ignora en lugar de romper.
    expect(resultadoSeleccion({ NOEXISTE: 100 }, UNIVERSO_BASE, ESCENARIOS_RESPALDO)).toBeNull()
  })

  it('las probabilidades editadas pisan las del escenario y los datos rotos se acotan', () => {
    const n = normalizarEscenarios([...ESCENARIOS_RESPALDO], 'ejemplo', { 'ejemplo:calma': 60 })
    expect(n.find((e) => e.id === 'calma')!.prob).toBe(60)
    expect(n.find((e) => e.id === 'calma')!.probBase).toBe(25)
    const roto = normalizarEscenarios([{ prob: 'x', riesgoPais: 99999 }, null], 'p', {})
    expect(roto[0].prob).toBe(0)
    expect(roto[0].riesgoPais).toBe(3000)
    expect(roto[1].nombre).toBe('Escenario 2')
  })
})
