// Pestaña Cartera y riesgo: carga de la cartera, simulación, contribución al riesgo y stress tests.
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Abanico } from '../componentes/Abanico'
import { BarraDivergente, CampoNumero, Chip, claseSigno, MarcaEjemplo, Seg } from '../componentes/basicos'
import { useEstado } from '../estado/almacen'
import { TOTAL_EJEMPLO } from '../estado/tipos'
import { useSimulacion } from '../estado/useSimulacion'
import {
  ajustarA100,
  CARTERA_EJEMPLO,
  ESCENARIOS_HISTORICOS,
  estresar,
  pctDeMontos,
  shocksPorFactores,
  siguienteSemilla,
  sumaPct,
  type OpcionesSimulacion,
  type ResultadoSimulacion,
  type RubroId,
} from '../riesgo'
import { conSigno1, enDolares, entero, pct, pctS } from '../util/formato'

const CAMINOS = 5000
const r1 = (v: number) => Math.round(v * 10) / 10

export interface Factores {
  sA: number
  sG: number
  origen: string | null
}

export interface PropsNoticias {
  llevarAFactores: (sA: number, sG: number, origen: string) => void
}

interface Props {
  /** Panel del agente de noticias (se monta entre la proyección y la contribución). */
  noticias?: (p: PropsNoticias) => ReactNode
  /** Botón "Guardar corrida": recibe el resultado vigente. */
  acciones?: (r: ResultadoSimulacion | null, opciones: OpcionesSimulacion) => ReactNode
}

export function CarteraRiesgo({ noticias, acciones }: Props) {
  const { estado, cambiar, montos, fm } = useEstado()
  const opciones = useMemo<OpcionesSimulacion>(
    () => ({ anios: estado.anios, caminos: CAMINOS, crisisActiva: estado.crisisActiva, probCrisis: estado.probCrisis, semilla: estado.semilla }),
    [estado.anios, estado.crisisActiva, estado.probCrisis, estado.semilla],
  )
  const { resultado, calculando } = useSimulacion(montos, estado.rubros, opciones)
  const [factores, setFactores] = useState<Factores>({ sA: -2, sG: 0, origen: null })
  const refEstres = useRef<HTMLHeadingElement>(null)

  const llevarAFactores = useCallback((sA: number, sG: number, origen: string) => {
    const acotar = (x: number) => Math.max(-3, Math.min(3, r1(x)))
    setFactores({ sA: acotar(sA), sG: acotar(sG), origen })
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    refEstres.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' })
  }, [])

  const horizonte = estado.anios === 1 ? '1 año' : estado.anios + ' años'

  return (
    <div className="vista">
      <div className="controls" role="group" aria-label="Parámetros de la simulación">
        <span className="ctl">
          Horizonte
          <Seg
            etiqueta="Horizonte"
            valor={estado.anios}
            onCambio={(anios) => cambiar({ anios })}
            opciones={[1, 2, 3, 5].map((a) => ({ valor: a, texto: a === 1 ? '1 año' : a + ' años' }))}
          />
        </span>
        <label className="ctl">
          <input type="checkbox" checked={estado.crisisActiva} onChange={(e) => cambiar({ crisisActiva: e.target.checked })} /> Incluir crisis argentinas, probabilidad anual
        </label>
        <span className="ctl">
          <CampoNumero
            valor={Math.round(estado.probCrisis * 100)}
            onCambio={(v) => cambiar({ probCrisis: Math.min(0.5, Math.max(0, v / 100)) })}
            min={0}
            max={50}
            step={1}
            disabled={!estado.crisisActiva}
            aria-label="Probabilidad anual de crisis en porcentaje"
          />{' '}
          %
        </span>
        <button type="button" className="act" onClick={() => cambiar((e) => ({ semilla: siguienteSemilla(e.semilla) }))}>
          Nueva simulación
        </button>
        {acciones?.(resultado, opciones)}
        <span className="small muted num" aria-live="polite">
          {calculando ? 'Simulando…' : `${entero(CAMINOS)} escenarios · semilla ${estado.semilla}`}
        </span>
      </div>

      <FranjaMetricas r={resultado} horizonte={horizonte} />

      <div className="grid2">
        <PanelCartera />
        <section className="panel" aria-labelledby="h-proy">
          <div className="panel-head">
            <h2 id="h-proy">Proyección del valor</h2>
            <span className="small muted">
              {resultado ? (estado.crisisActiva ? `${pct(resultado.fraccionConCrisis)} de los escenarios incluye una crisis local` : 'sin crisis locales') : ''}
            </span>
          </div>
          {resultado ? <Abanico r={resultado} fm={fm} anios={estado.anios} /> : <div id="fan" className="vacio">Cargá un monto para ver la proyección.</div>}
          <div className="legend">
            <span>
              <i style={{ background: 'var(--accent-soft)' }} />
              90% de los escenarios (percentil 5 a 95)
            </span>
            <span>
              <i style={{ background: 'var(--accent-mid)' }} />
              50% central (25 a 75)
            </span>
            <span>
              <i style={{ background: 'var(--accent)', height: 3, verticalAlign: 2 }} />
              Mediana
            </span>
          </div>
        </section>
      </div>

      {noticias?.({ llevarAFactores })}

      <div className="grid2b">
        <PanelContribucion r={resultado} />
        <section className="panel" aria-labelledby="h-stress">
          <div className="panel-head">
            <h2 id="h-stress" ref={refEstres}>
              Si se repite la historia
            </h2>
            <span className="small muted">impacto inmediato</span>
          </div>
          <EscenariosHistoricos />
          <EscenarioPorFactores factores={factores} setFactores={setFactores} />
        </section>
      </div>

      <section className="panel" aria-labelledby="h-how">
        <h2 id="h-how">Cómo calcula</h2>
        <div className="how">
          <div>
            <h3>Modelo de dos factores</h3>
            <p>
              Cada activo se mueve por un factor Argentina (riesgo país, dólar, política), un factor global (bolsas del mundo) y un componente propio. Así se obtienen las correlaciones: soberanos y
              Merval se mueven juntos; los CEDEARs, mucho menos.
            </p>
          </div>
          <div>
            <h3>Monte Carlo mensual</h3>
            <p>
              Se simulan 5.000 trayectorias mes a mes con rendimientos lognormales. Si activás las crisis, cada mes puede ocurrir un shock local que golpea a la vez a pesos, bonos y acciones
              argentinas.
            </p>
          </div>
          <div>
            <h3>VaR y CVaR</h3>
            <p>El VaR 95% es la pérdida que solo se supera en 1 de cada 20 meses. El CVaR es la pérdida promedio dentro de ese peor 5%: mira la cola, que es donde se rompen las carteras.</p>
          </div>
          <div>
            <h3>Contribución al riesgo</h3>
            <p>En los meses de la cola se mide cuánto perdió cada activo. Las contribuciones suman exactamente el CVaR, y muestran qué posición concentra el riesgo.</p>
          </div>
        </div>
        <p className="small muted">
          Los rendimientos, volatilidades y sensibilidades se pueden ver y cambiar en <a href="#supuestos">Supuestos</a>.
        </p>
      </section>
    </div>
  )
}

function FranjaMetricas({ r, horizonte }: { r: ResultadoSimulacion | null; horizonte: string }) {
  const { estado, fm } = useEstado()
  if (!r) {
    return (
      <section className="strip" aria-label="Resumen de riesgo">
        <div className="stat">
          <span className="h">Cargá al menos un monto para simular.</span>
        </div>
      </section>
    )
  }
  const items: [string, string, string, string][] = [
    ['Valor hoy', fm.monto(r.total0), estado.moneda === 'ARS' ? `En pesos al MEP de $ ${entero(estado.mep)}` : 'Suma de la cartera en dólares', ''],
    ['VaR 95% a 1 mes', fm.monto(r.var95), `Solo 1 de cada 20 meses se pierde más (${pct(r.var95 / r.total0)}). VaR 99%: ${fm.monto(r.var99)}`, 'loss'],
    ['CVaR 95% a 1 mes', fm.monto(r.cvar95), `Pérdida promedio en ese peor 5% (${pct(r.cvar95 / r.total0)})`, 'loss'],
    [`Mediana en ${horizonte}`, fm.monto(r.mediana), `Escenario del medio: ${pctS(r.mediana / r.total0 - 1)}`, ''],
    [`Peor 5% en ${horizonte}`, fm.monto(r.p5), `Uno de cada 20 escenarios termina por debajo (${pctS(r.p5 / r.total0 - 1)})`, 'loss'],
    ['Chance de perder', pct(r.probPerdida), 'De terminar el plazo con menos de lo invertido', ''],
    ['Caída máxima típica', pct(r.caidaTipica), 'Peor baja desde un pico, en el escenario mediano', 'loss'],
  ]
  return (
    <section className="strip" aria-label="Resumen de riesgo">
      {items.map(([e, v, h, c]) => (
        <div className="stat" key={e}>
          <span className="eyebrow">{e}</span>
          <span className={'v ' + c}>{v}</span>
          <span className="h">{h}</span>
        </div>
      ))}
    </section>
  )
}

function PanelCartera() {
  const { estado, cambiar, montos, fm } = useEstado()
  const enPesos = estado.moneda === 'ARS'
  const s = sumaPct(estado.pct)
  const ok = Math.abs(s - 100) < 0.05
  const fijar = (id: RubroId, v: number) => cambiar((e) => ({ pct: { ...e.pct, [id]: Math.min(100, Math.max(0, v || 0)) }, esEjemplo: false }))
  const nota = ok
    ? 'Asignado'
    : s === 0
      ? 'Asigná algún porcentaje'
      : (s < 100 ? `Faltan ${r1(100 - s)} puntos` : `Sobran ${r1(s - 100)} puntos`) + '; mientras tanto se reparte en proporción'

  return (
    <section className="panel" aria-labelledby="h-cartera">
      <div className="panel-head">
        <h2 id="h-cartera">Cartera</h2>
        <button type="button" className="link" onClick={() => cambiar({ totalUsd: TOTAL_EJEMPLO, pct: pctDeMontos(CARTERA_EJEMPLO), esEjemplo: true })}>
          Cargar cartera de ejemplo
        </button>
      </div>
      <div className="totalbox">
        <label htmlFor="totalUsd" className="eyebrow">
          Monto total de la cartera
        </label>
        <span className="totalin">
          <span className="cur">{fm.simbolo}</span>
          <CampoNumero
            id="totalUsd"
            valor={Math.round(estado.totalUsd * fm.k)}
            onCambio={(v) => {
              if (v >= 0) cambiar({ totalUsd: v / fm.k, esEjemplo: false })
            }}
            min={0}
            step={enPesos ? 100000 : 500}
          />
        </span>
        <span className="small muted num">
          {enPesos ? `equivale a ${enDolares(estado.totalUsd)} al MEP de $ ${entero(estado.mep)}` : `equivale a $ ${entero(Math.round(estado.totalUsd * estado.mep))} al MEP de $ ${entero(estado.mep)}`}
        </span>
        {estado.esEjemplo && (
          <p className="small muted">
            <MarcaEjemplo /> Cartera de ejemplo. Cambiá el total y los porcentajes por los tuyos.
          </p>
        )}
      </div>
      <div className="rhead">
        <span>Rubro</span>
        <span className="r">% del total</span>
        <span className="r">{fm.simbolo}</span>
      </div>
      <div className="rubros">
        {estado.rubros.map((a) => (
          <div className="rubro" key={a.id}>
            <label className="rnom" htmlFor={'pr-' + a.id}>
              {a.nombre}
            </label>
            <input
              type="range"
              id={'pr-' + a.id}
              min={0}
              max={100}
              step={1}
              value={Math.round(estado.pct[a.id] || 0)}
              onChange={(e) => fijar(a.id, parseFloat(e.target.value))}
              aria-label={'Porcentaje en ' + a.corto}
            />
            <span className="rpct">
              <CampoNumero valor={r1(estado.pct[a.id] || 0)} onCambio={(v) => fijar(a.id, v)} min={0} max={100} step={0.5} aria-label={'Porcentaje en ' + a.corto + ', campo numérico'} />
              <span aria-hidden="true">%</span>
            </span>
            <span className="rmonto num">{fm.monto(montos[a.id])}</span>
          </div>
        ))}
      </div>
      <div className="sumrow">
        <Chip ok={ok}>
          Suma <strong className="num">{r1(s)}%</strong>
        </Chip>
        <span className="small muted">{nota}</span>
        {!ok && s > 0 && (
          <button type="button" className="act small-act" onClick={() => cambiar((e) => ({ pct: ajustarA100(e.pct), esEjemplo: false }))}>
            Ajustar a 100%
          </button>
        )}
      </div>
    </section>
  )
}

function PanelContribucion({ r }: { r: ResultadoSimulacion | null }) {
  const { estado, montos } = useEstado()
  let cuerpo: ReactNode = <p className="vacio">Cargá un monto para ver quién pone el riesgo.</p>
  if (r && r.total0 > 0) {
    const c = r.cvar95 || 1
    const filas = estado.rubros
      .map((a) => ({ a, w: Math.max(0, montos[a.id] || 0) / r.total0, rr: (r.contribuciones.find((x) => x.id === a.id)?.monto ?? 0) / c }))
      .filter((x) => x.w > 0)
      .sort((x, y) => y.rr - x.rr)
    const mx = Math.max(...filas.map((x) => Math.max(x.w, x.rr)), 0.01)
    const top = filas[0]
    const cargada = filas.filter((x) => x.w > 0.02).sort((x, y) => y.rr / y.w - x.rr / x.w)[0]
    const amortiguan = filas.filter((x) => x.rr < x.w * 0.5).map((x) => x.a.corto)
    cuerpo = (
      <>
        <div className="contrib">
          {filas.map((x) => (
            <div className="crow" key={x.a.id}>
              <span>{x.a.corto}</span>
              <span className="cbars">
                <span className="cbar w" style={{ width: ((x.w / mx) * 100).toFixed(1) + '%' }} />
                <span className="cbar r" style={{ width: ((Math.max(0, x.rr) / mx) * 100).toFixed(1) + '%' }} />
              </span>
              <span className="cval">
                {pct(x.w)}
                <br />
                <span className="loss">{pct(x.rr)}</span>
              </span>
            </div>
          ))}
        </div>
        {top && (
          <p className="callout">
            <strong>{top.a.corto}</strong> explica {pct(top.rr)} de la pérdida en los meses malos.
            {cargada && cargada.rr > cargada.w * 1.15 && ` ${cargada.a.corto} pesa ${pct(cargada.w)} de la cartera pero aporta ${pct(cargada.rr)} del riesgo: es la posición más cargada.`}
            {amortiguan.length > 0 &&
              ` ${amortiguan.join(' y ')} ${amortiguan.length > 1 ? 'aportan' : 'aporta'} mucho menos riesgo que su peso: ${amortiguan.length > 1 ? 'funcionan' : 'funciona'} como amortiguador.`}
          </p>
        )}
      </>
    )
  }
  return (
    <section className="panel" aria-labelledby="h-contrib">
      <div className="panel-head">
        <h2 id="h-contrib">Quién pone el riesgo</h2>
        <span className="small muted">en el peor 5% de los meses</span>
      </div>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--weight)' }} />
          Peso en la cartera
        </span>
        <span>
          <i style={{ background: 'var(--loss)' }} />
          Parte de la pérdida
        </span>
      </div>
      {cuerpo}
    </section>
  )
}

function EscenariosHistoricos() {
  const { estado, montos, fm } = useEstado()
  const res = ESCENARIOS_HISTORICOS.map((e) => ({ e, r: estresar(montos, estado.rubros, e.shocks) }))
  const mx = Math.max(0.4, ...res.map((x) => Math.abs(x.r.pct)))
  return (
    <div className="scen">
      {res.map(({ e, r }) => (
        <details className="srow" key={e.id}>
          <summary>
            <span className="nm">{e.nombre}</span>
            <BarraDivergente valor={r.pct} maximo={mx} />
            <span className={'sval ' + (r.pct < 0 ? 'loss' : 'gain')}>
              {pctS(r.pct)}
              <br />
              <span className="small">{fm.montoS(r.pnl)}</span>
            </span>
          </summary>
          <div className="sdet">
            <p className="small muted">{e.desc} Cifras aproximadas.</p>
            <table>
              <thead>
                <tr>
                  <th>Activo</th>
                  <th className="r">Variación</th>
                  <th className="r">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {r.detalle
                  .filter((d) => d.monto > 0)
                  .map((d) => (
                    <tr key={d.id}>
                      <td>{estado.rubros.find((x) => x.id === d.id)?.corto}</td>
                      <td className="r num">{pctS(d.shock)}</td>
                      <td className={'r num ' + claseSigno(d.pnl)}>{fm.montoS(d.pnl)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  )
}

function EscenarioPorFactores({ factores, setFactores }: { factores: Factores; setFactores: (f: Factores) => void }) {
  const { estado, montos, fm } = useEstado()
  const r = estresar(montos, estado.rubros, shocksPorFactores(estado.rubros, factores.sA, factores.sG))
  const peor = r.detalle.filter((d) => d.monto > 0).sort((x, y) => x.pnl - y.pnl)[0]
  const nombrePeor = peor ? estado.rubros.find((a) => a.id === peor.id)?.corto : ''
  return (
    <div className="factor">
      <h3>Escenario propio por factores</h3>
      <p className="small muted">Mové los dos factores del modelo, en desvíos estándar. Cada activo reacciona según su sensibilidad.</p>
      <label className="slider" htmlFor="fA">
        Factor Argentina
        <input type="range" id="fA" min={-3} max={3} step={0.1} value={factores.sA} onChange={(e) => setFactores({ sA: +e.target.value, sG: factores.sG, origen: null })} />
        <span className="num">{conSigno1(factores.sA)}</span>
      </label>
      <label className="slider" htmlFor="fG">
        Factor global
        <input type="range" id="fG" min={-3} max={3} step={0.1} value={factores.sG} onChange={(e) => setFactores({ sA: factores.sA, sG: +e.target.value, origen: null })} />
        <span className="num">{conSigno1(factores.sG)}</span>
      </label>
      {factores.origen && <p className="small muted">Cargado desde: {factores.origen}. Los ajustes propios de cada rubro no entran acá; solo los dos factores.</p>}
      <div className="fres">
        <span className={'big ' + claseSigno(r.pct)}>{pctS(r.pct)}</span>
        <span className="small muted">
          {fm.montoS(r.pnl)} sobre {fm.monto(r.total)}
          {peor && peor.pnl < 0 ? ` · el mayor golpe es en ${nombrePeor} (${pctS(peor.shock)})` : ''}
        </span>
      </div>
    </div>
  )
}
