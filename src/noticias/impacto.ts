// Impacto de una noticia sobre la cartera del usuario. Se calcula en el navegador.
import { estresar, shocksNoticia, type Montos, type ResultadoEstres, type Rubro, type ShockNoticia } from '../riesgo'
import { pctS } from '../util/formato'

export const impactoNoticia = (montos: Montos, rubros: readonly Rubro[], n: ShockNoticia): ResultadoEstres => estresar(montos, rubros, shocksNoticia(rubros, n))

/** "más afectado: Soberanos (−8,2%)" */
export function masGolpeado(r: ResultadoEstres, rubros: readonly Rubro[]): string {
  const d = r.detalle.filter((x) => x.monto > 0).sort((x, y) => Math.abs(y.pnl) - Math.abs(x.pnl))[0]
  if (!d || Math.abs(d.pnl) < 1) return 'efecto mínimo'
  return `más afectado: ${rubros.find((a) => a.id === d.id)?.corto ?? d.id} (${pctS(d.shock)})`
}
