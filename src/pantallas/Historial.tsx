// Pantalla Historial: valor y VaR corrida a corrida, comparación de dos corridas y ediciones anteriores.
import { useState, type ReactNode } from 'react'
import { claseSigno } from '../componentes/basicos'
import type { Corrida } from '../datos/corridas'
import { useSesion } from '../datos/sesion'
import { useEstado } from '../estado/almacen'
import { compacto, entero, fechaCorta, formatoMoneda, pct, pctS } from '../util/formato'

/** Cada corrida se muestra al dólar MEP que tenía cuando se guardó. */
const fmDe = (c: Corrida, moneda: 'ARS' | 'USD') => formatoMoneda(moneda, c.opciones.mep || 1)

export function Historial({ ediciones }: { ediciones?: ReactNode }) {
  const { corridas, quitarCorrida, modo } = useSesion()
  const { estado } = useEstado()
  const [elegidas, setElegidas] = useState<string[]>([])
  const marcadas = elegidas.filter((id) => corridas.some((c) => c.id === id))

  const alternar = (id: string) => setElegidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l.slice(-1), id]))
  const par = marcadas.length === 2 ? (marcadas.map((id) => corridas.find((c) => c.id === id)!).sort((a, b) => a.fecha.localeCompare(b.fecha)) as [Corrida, Corrida]) : null

  return (
    <div className="vista">
      <section className="panel" aria-labelledby="h-hist">
        <div className="panel-head">
          <h2 id="h-hist">Corridas guardadas</h2>
          <span className="small muted">{modo === 'cuenta' ? 'guardadas en tu cuenta' : 'guardadas en este navegador'}</span>
        </div>
        {corridas.length === 0 ? (
          <p className="vacio">
            Todavía no guardaste ninguna corrida. En <a href="#riesgo">Cartera y riesgo</a>, tocá "Guardar corrida" para dejar una foto de tu cartera y sus métricas, y después compararla con otra.
          </p>
        ) : (
          <>
            <SerieCorridas corridas={corridas} moneda={estado.moneda} />
            <p className="small muted">Tildá dos corridas para compararlas. Los montos en pesos usan el dólar MEP del día en que se guardó cada una.</p>
            <div className="tbl-scroll">
              <table className="tabla-hist">
                <thead>
                  <tr>
                    <th>
                      <span className="sr">Comparar</span>
                    </th>
                    <th>Fecha</th>
                    <th className="r">Valor</th>
                    <th className="r">VaR 95% a 1 mes</th>
                    <th className="r">CVaR 95%</th>
                    <th className="r">Mediana</th>
                    <th>Horizonte</th>
                    <th>
                      <span className="sr">Borrar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {corridas.map((c) => {
                    const fm = fmDe(c, estado.moneda)
                    const r = c.resultados
                    return (
                      <tr key={c.id} className={marcadas.includes(c.id) ? 'sel' : ''}>
                        <td>
                          <input type="checkbox" checked={marcadas.includes(c.id)} onChange={() => alternar(c.id)} aria-label={'Comparar la corrida del ' + fechaCorta(c.fecha)} />
                        </td>
                        <td className="num">{fechaCorta(c.fecha)}</td>
                        <td className="r num">{fm.monto(r.total0)}</td>
                        <td className="r num">
                          {fm.monto(r.var95)} <span className="muted small">({pct(r.var95 / (r.total0 || 1))})</span>
                        </td>
                        <td className="r num">{fm.monto(r.cvar95)}</td>
                        <td className="r num">{fm.monto(r.mediana)}</td>
                        <td className="small">
                          {c.opciones.anios} {c.opciones.anios === 1 ? 'año' : 'años'}
                          {c.opciones.crisisActiva ? ` · crisis ${Math.round(c.opciones.probCrisis * 100)}%` : ' · sin crisis'}
                        </td>
                        <td className="r">
                          <button type="button" className="q" aria-label={'Borrar la corrida del ' + fechaCorta(c.fecha)} onClick={() => void quitarCorrida(c.id)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {par && <Comparacion a={par[0]} b={par[1]} />}
      {ediciones}
    </div>
  )
}

/** Dos gráficos chicos con el mismo eje: valor de la cartera y VaR como % del valor. */
function SerieCorridas({ corridas, moneda }: { corridas: Corrida[]; moneda: 'ARS' | 'USD' }) {
  const orden = corridas.slice().reverse()
  if (orden.length < 2) return <p className="small muted">Con dos o más corridas vas a ver acá cómo cambian el valor y el VaR de tu cartera.</p>
  const W = 640
  const H = 190
  const mL = 58
  const mR = 14
  const altoValor = 96
  const y0Var = 128
  const altoVar = 44
  const valores = orden.map((c) => c.resultados.total0 * fmDe(c, moneda).k)
  const vars = orden.map((c) => c.resultados.var95 / (c.resultados.total0 || 1))
  const lo = Math.min(...valores)
  const hi = Math.max(...valores)
  const margen = (hi - lo) * 0.1 || hi * 0.05 || 1
  const X = (i: number) => mL + (i / (orden.length - 1)) * (W - mL - mR)
  const Yv = (v: number) => 10 + (1 - (v - (lo - margen)) / (hi - lo + 2 * margen)) * altoValor
  const mxVar = Math.max(...vars, 0.01)
  const ancho = Math.max(3, Math.min(22, ((W - mL - mR) / orden.length) * 0.5))
  return (
    <div className="serie" role="img" aria-label={`Valor y VaR de la cartera en ${orden.length} corridas guardadas`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <text x={mL - 8} y={Yv(hi) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
          {compacto(hi)}
        </text>
        <text x={mL - 8} y={Yv(lo) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
          {compacto(lo)}
        </text>
        <line x1={mL} x2={W - mR} y1={10 + altoValor + 8} y2={10 + altoValor + 8} stroke="var(--rule)" />
        <path d={'M' + valores.map((v, i) => `${X(i).toFixed(1)},${Yv(v).toFixed(1)}`).join('L')} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        {valores.map((v, i) => (
          <circle key={orden[i].id} cx={X(i)} cy={Yv(v)} r="3" fill="var(--accent)" />
        ))}
        <text x={mL - 8} y={y0Var + 10} textAnchor="end" fontSize="11" fill="var(--muted)">
          VaR {pct(mxVar)}
        </text>
        {vars.map((v, i) => {
          const h = (v / mxVar) * altoVar
          return <rect key={orden[i].id} x={X(i) - ancho / 2} y={y0Var + altoVar - h} width={ancho} height={h} rx="2" fill="var(--loss)" />
        })}
        <line x1={mL} x2={W - mR} y1={y0Var + altoVar} y2={y0Var + altoVar} stroke="var(--muted)" />
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--accent)', height: 3, verticalAlign: 2 }} />
          Valor de la cartera
        </span>
        <span>
          <i style={{ background: 'var(--loss)' }} />
          VaR 95% a un mes, como % del valor
        </span>
        <span>
          de {fechaCorta(orden[0].fecha)} a {fechaCorta(orden[orden.length - 1].fecha)}
        </span>
      </div>
    </div>
  )
}

function Comparacion({ a, b }: { a: Corrida; b: Corrida }) {
  const { estado } = useEstado()
  const fa = fmDe(a, estado.moneda)
  const fb = fmDe(b, estado.moneda)
  const ra = a.resultados
  const rb = b.resultados
  // La diferencia se mide en dólares, que es la moneda en que se calcula todo.
  const difMonto = (x: number, y: number) => (
    <span className={'num ' + claseSigno(y - x)}>
      {y === x ? '=' : pctS(x ? y / x - 1 : 0)}
    </span>
  )
  const difPuntos = (x: number, y: number, malo = true) => {
    const d = (y - x) * 100
    const clase = Math.abs(d) < 0.05 ? '' : d > 0 === malo ? 'loss' : 'gain'
    return <span className={'num ' + clase}>{Math.abs(d) < 0.05 ? '=' : (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1).replace('.', ',') + ' pts'}</span>
  }
  const filas: [string, ReactNode, ReactNode, ReactNode][] = [
    ['Valor de la cartera', fa.monto(ra.total0), fb.monto(rb.total0), difMonto(ra.total0, rb.total0)],
    ['VaR 95% a 1 mes', `${fa.monto(ra.var95)} (${pct(ra.var95 / (ra.total0 || 1))})`, `${fb.monto(rb.var95)} (${pct(rb.var95 / (rb.total0 || 1))})`, difPuntos(ra.var95 / (ra.total0 || 1), rb.var95 / (rb.total0 || 1))],
    ['CVaR 95% a 1 mes', `${fa.monto(ra.cvar95)} (${pct(ra.cvar95 / (ra.total0 || 1))})`, `${fb.monto(rb.cvar95)} (${pct(rb.cvar95 / (rb.total0 || 1))})`, difPuntos(ra.cvar95 / (ra.total0 || 1), rb.cvar95 / (rb.total0 || 1))],
    ['VaR 99% a 1 mes', fa.monto(ra.var99), fb.monto(rb.var99), difPuntos(ra.var99 / (ra.total0 || 1), rb.var99 / (rb.total0 || 1))],
    ['Mediana al final', `${fa.monto(ra.mediana)} (${pctS(ra.mediana / (ra.total0 || 1) - 1)})`, `${fb.monto(rb.mediana)} (${pctS(rb.mediana / (rb.total0 || 1) - 1)})`, difPuntos(ra.mediana / (ra.total0 || 1), rb.mediana / (rb.total0 || 1), false)],
    ['Peor 5% al final', fa.monto(ra.p5), fb.monto(rb.p5), difPuntos(ra.p5 / (ra.total0 || 1), rb.p5 / (rb.total0 || 1), false)],
    ['Chance de perder', pct(ra.probPerdida), pct(rb.probPerdida), difPuntos(ra.probPerdida, rb.probPerdida)],
    ['Caída máxima típica', pct(ra.caidaTipica), pct(rb.caidaTipica), difPuntos(ra.caidaTipica, rb.caidaTipica)],
    ['Horizonte', a.opciones.anios + (a.opciones.anios === 1 ? ' año' : ' años'), b.opciones.anios + (b.opciones.anios === 1 ? ' año' : ' años'), ''],
    ['Crisis argentinas', a.opciones.crisisActiva ? Math.round(a.opciones.probCrisis * 100) + '% anual' : 'no', b.opciones.crisisActiva ? Math.round(b.opciones.probCrisis * 100) + '% anual' : 'no', ''],
    ['Dólar MEP', '$ ' + entero(a.opciones.mep), '$ ' + entero(b.opciones.mep), difMonto(a.opciones.mep, b.opciones.mep)],
  ]
  const rubros = estado.rubros.filter((r) => (a.opciones.pct[r.id] || 0) > 0 || (b.opciones.pct[r.id] || 0) > 0)
  const norm = (c: Corrida, id: (typeof rubros)[number]['id']) => {
    const s = Object.values(c.opciones.pct).reduce((t, v) => t + Math.max(0, v || 0), 0) || 1
    return Math.max(0, c.opciones.pct[id] || 0) / s
  }
  return (
    <section className="panel" aria-labelledby="h-comp">
      <h2 id="h-comp">Comparación de dos corridas</h2>
      <div className="tbl-scroll">
        <table className="tabla-hist">
          <thead>
            <tr>
              <th>Medida</th>
              <th className="r">{fechaCorta(a.fecha)}</th>
              <th className="r">{fechaCorta(b.fecha)}</th>
              <th className="r">Cambio</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(([n, x, y, d]) => (
              <tr key={n}>
                <td>{n}</td>
                <td className="r num">{x}</td>
                <td className="r num">{y}</td>
                <td className="r">{d}</td>
              </tr>
            ))}
            {rubros.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="muted small">% en</span> {r.corto}
                </td>
                <td className="r num">{pct(norm(a, r.id))}</td>
                <td className="r num">{pct(norm(b, r.id))}</td>
                <td className="r">{difPuntos(norm(a, r.id), norm(b, r.id), false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">El cambio de los montos se mide en dólares. En riesgo, rojo es más riesgo y verde es menos; en composición, el color solo indica si el rubro pesa más o menos.</p>
    </section>
  )
}
