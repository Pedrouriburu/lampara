// Pestaña Acciones por escenario: escenarios del día, mejores por escenario, tabla de colores y tu selección.
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { filasGrupo, mejoresEnEscenario, normalizarEscenarios, pesosIguales, resultadoSeleccion, seleccionEquilibrada, type FilaAccion } from '../acciones/calculo'
import { ESCENARIOS_RESPALDO } from '../acciones/escenarios'
import { nombreGrupo, type Grupo } from '../acciones/universo'
import { BarraDivergente, CampoNumero, Chip, claseSigno, MarcaEjemplo, Seg } from '../componentes/basicos'
import { useEstado } from '../estado/almacen'
import type { Edicion } from '../noticias/tipos'
import { ajustarA100 } from '../riesgo'
import { decimal1, entero, fechaLarga, pct, pctS } from '../util/formato'

type Escenario = ReturnType<typeof normalizarEscenarios>[number]

export interface ContextoLectura {
  grupo: Grupo
  escenarios: Escenario[]
  filas: FilaAccion[]
  equilibrada: FilaAccion[]
  seleccion: ReturnType<typeof resultadoSeleccion>
}

interface Props {
  /** Edición elegida en el panel de noticias; si no trae escenarios se usan los de respaldo. */
  edicion: Edicion | null
  /** Botón "Pedir lectura a Claude"; no se muestra si no hay clave. */
  lectura?: (ctx: ContextoLectura) => ReactNode
}

const fmtMov = (v: number, suf: string) => (v > 0 ? '+' : v < 0 ? '−' : '±') + entero(Math.abs(v)) + suf
const r1 = (v: number) => Math.round(v * 10) / 10

function tono(v: number): CSSProperties | undefined {
  if (v === 0) return undefined
  const k = Math.min(1, Math.abs(v) / 0.3)
  return { background: `color-mix(in srgb, var(${v > 0 ? '--gain' : '--loss'}) ${Math.round(8 + k * 42)}%, transparent)` }
}

export function Acciones({ edicion, lectura }: Props) {
  const { estado, cambiar, montos, fm } = useEstado()
  const [orden, setOrden] = useState('esperado')
  const refSel = useRef<HTMLHeadingElement>(null)
  const grupo = estado.grupo

  const delAgente = !!edicion && !edicion.esEjemplo && Array.isArray(edicion.escenariosAcciones) && edicion.escenariosAcciones.length > 0
  const conEscenarios = !!edicion && Array.isArray(edicion.escenariosAcciones) && edicion.escenariosAcciones.length > 0
  const escs = useMemo(
    () => normalizarEscenarios(conEscenarios ? edicion!.escenariosAcciones! : [...ESCENARIOS_RESPALDO], conEscenarios ? edicion!.fecha : 'ejemplo', estado.probs),
    [conEscenarios, edicion, estado.probs],
  )
  const filas = useMemo(() => filasGrupo(estado.universo, grupo, escs), [estado.universo, grupo, escs])
  const equilibrada = useMemo(() => seleccionEquilibrada(filas), [filas])
  const sel = estado.sel[grupo]
  const resSel = useMemo(() => resultadoSeleccion(sel, estado.universo, escs), [sel, estado.universo, escs])

  const sumaProb = escs.reduce((t, e) => t + e.prob, 0)
  const probOk = Math.abs(sumaProb - 100) < 0.5

  const fijarSel = (nueva: Record<string, number>) => cambiar((e) => ({ sel: { ...e.sel, [grupo]: nueva }, selEjemplo: false }))
  const usar = (tickers: string[]) => {
    fijarSel(pesosIguales(tickers))
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    refSel.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' })
  }
  const alternar = (t: string, marcado: boolean) => {
    const nueva = { ...sel }
    if (marcado) {
      const w = 100 / (Object.keys(nueva).length + 1)
      for (const k in nueva) nueva[k] = r1((nueva[k] * (100 - w)) / 100)
      nueva[t] = r1(w)
    } else {
      delete nueva[t]
      const s = Object.values(nueva).reduce((a, b) => a + b, 0)
      if (s > 0) for (const k in nueva) nueva[k] = r1((nueva[k] / s) * 100)
    }
    fijarSel(nueva)
  }

  return (
    <div className="vista">
      <section className="panel" aria-labelledby="h-escs">
        <div className="panel-head">
          <div>
            <div className="eyebrow">{delAgente ? `Armados por el agente con las noticias del ${fechaLarga(edicion!.fecha)}` : 'Escenarios de ejemplo'}</div>
            <h2 id="h-escs">Escenarios para los próximos uno a tres meses</h2>
          </div>
          <span className="sumrow">
            <Chip ok={probOk} titulo={probOk ? undefined : 'Se usan en proporción aunque no sumen 100'}>
              Probabilidades <strong className="num">{entero(sumaProb)}%</strong>
            </Chip>
            <button type="button" className="link" onClick={() => cambiar({ probs: {} })}>
              Restablecer
            </button>
          </span>
        </div>
        {!delAgente && (
          <p className="aviso-ej">
            <MarcaEjemplo /> Estos escenarios son de ejemplo: sirven para probar la herramienta, no describen el mercado de hoy. Cuando el agente publique su edición del día, se reemplazan solos.
          </p>
        )}
        <p className="small muted">Cada escenario fija cinco variables. Las probabilidades son una opinión: cambialas según lo que creas y todo se recalcula.</p>
        <div className="esc-grid">
          {escs.map((e) => (
            <article className="esc-card" key={e.clave}>
              <div className="esc-top">
                <h3>{e.nombre}</h3>
                <label className="esc-prob">
                  <CampoNumero
                    valor={Math.round(e.prob)}
                    onCambio={(v) => cambiar((s) => ({ probs: { ...s.probs, [e.clave]: Math.max(0, Math.min(100, v)) } }))}
                    min={0}
                    max={100}
                    step={5}
                    aria-label={'Probabilidad de ' + e.nombre}
                  />
                  %
                </label>
              </div>
              <div className="movs">
                <span className={'mov ' + (e.riesgoPais > 0 ? 'bad' : e.riesgoPais < 0 ? 'good' : '')}>Riesgo país {fmtMov(e.riesgoPais, ' pb')}</span>
                <span className={'mov ' + (e.spx < 0 ? 'bad' : e.spx > 0 ? 'good' : '')}>S&amp;P 500 {fmtMov(e.spx, '%')}</span>
                <span className={'mov ' + (e.tasas > 0 ? 'bad' : e.tasas < 0 ? 'good' : '')}>Tasas EE.UU. {fmtMov(e.tasas, ' pb')}</span>
                <span className="mov">Brent {fmtMov(e.petroleo, '%')}</span>
                <span className={'mov ' + (e.dolar > 5 ? 'bad' : '')}>Dólar {fmtMov(e.dolar, '%')}</span>
              </div>
              {e.descripcion && <p>{e.descripcion}</p>}
              {e.senales.length > 0 && (
                <ul className="senales">
                  {e.senales.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="h-picks">
        <div className="panel-head">
          <h2 id="h-picks">Qué sale mejor en cada escenario</h2>
          <Seg
            etiqueta="Grupo de acciones"
            valor={grupo}
            onCambio={(g) => cambiar({ grupo: g })}
            opciones={[
              { valor: 'merval', texto: 'Merval' },
              { valor: 'cedears', texto: 'CEDEARs' },
            ]}
          />
        </div>
        <p className="small muted">
          Lo que mejor sale en cada escenario según el modelo. La selección equilibrada busca las que rinden razonable en todos y pierden menos en el peor. Las sensibilidades son aproximaciones por
          sector, no están estimadas con datos de cada empresa: es un ejercicio para pensar escenarios, no una recomendación de compra o venta.
        </p>
        <div className="picks">
          <div className="pick eq">
            <span className="ph">Selección equilibrada</span>
            <h3>Aguanta mejor entre escenarios</h3>
            <ListaPick filas={equilibrada} valor={(f) => f.esperado} />
            <span className="small muted">Esperado ponderado por probabilidad</span>
            <button type="button" className="link" onClick={() => usar(equilibrada.map((f) => f.a.ticker))}>
              Usar estas en mi selección
            </button>
          </div>
          {escs.map((e, i) => {
            const top = mejoresEnEscenario(filas, i)
            return (
              <div className="pick" key={e.clave}>
                <span className="ph">Si pasa · {entero(e.prob)}%</span>
                <h3>{e.nombre}</h3>
                <ListaPick filas={top} valor={(f) => f.rets[i]} />
                <button type="button" className="link" onClick={() => usar(top.map((f) => f.a.ticker))}>
                  Usar estas en mi selección
                </button>
              </div>
            )
          })}
        </div>
        <TablaColores escs={escs} filas={filas} orden={orden} setOrden={setOrden} sel={sel} alternar={alternar} />
        <p className="small muted">Variación estimada en dólares a uno a tres meses. Tildá una acción para sumarla a tu selección. Tocá el nombre de un escenario para ordenar por él.</p>
      </section>

      <section className="panel" aria-labelledby="h-sel">
        <div className="panel-head">
          <h2 id="h-sel" ref={refSel}>
            Tu selección
          </h2>
          <button type="button" className="link" onClick={() => fijarSel({})}>
            Vaciar
          </button>
        </div>
        <TuSeleccion escs={escs} equilibrada={equilibrada} presupuesto={montos[grupo] || 0} total={estado.totalUsd} fijarSel={fijarSel} resultado={resSel} />
        {lectura && <div className="lectura">{lectura({ grupo, escenarios: escs, filas, equilibrada, seleccion: resSel })}</div>}
      </section>

      <section className="panel" aria-labelledby="h-accmod">
        <h2 id="h-accmod">Cómo se calcula</h2>
        <div className="how">
          <div>
            <h3>Cinco palancas</h3>
            <p>
              Cada acción reacciona al riesgo país, al S&amp;P 500, a las tasas de EE.UU., al precio del petróleo y a la devaluación del peso. Un banco argentino sube mucho cuando baja el riesgo país;
              una exportadora como Aluar aguanta mejor una devaluación; una tecnológica sufre con tasas más altas.
            </p>
          </div>
          <div>
            <h3>Sensibilidades aproximadas</h3>
            <p>
              Los coeficientes son estimaciones razonables por sector, no medidas con datos de cada empresa. Sirven para comparar entre escenarios, no para predecir un precio. No incluyen balances,
              valuación ni noticias propias de cada compañía. Se pueden ver y cambiar en <a href="#supuestos">Supuestos</a>.
            </p>
          </div>
          <div>
            <h3>Esperado y peor caso</h3>
            <p>
              El esperado pondera cada escenario por su probabilidad. La selección equilibrada ordena por esperado menos la mitad de la pérdida en el peor escenario, para no depender de acertar uno
              solo.
            </p>
          </div>
          <div>
            <h3>Presupuesto</h3>
            <p>
              Tu selección reparte lo que asignaste a Merval o a CEDEARs en la pestaña <a href="#riesgo">Cartera y riesgo</a>. Para cambiar ese monto ({fm.simbolo}), cambiá los porcentajes allá.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function ListaPick({ filas, valor }: { filas: FilaAccion[]; valor: (f: FilaAccion) => number }) {
  return (
    <ol>
      {filas.map((f) => (
        <li key={f.a.ticker}>
          <span className="tk">{f.a.ticker}</span>
          <span className="sec">{f.a.sector}</span>
          <span className={'rv ' + (valor(f) < 0 ? 'loss' : 'gain')}>{pctS(valor(f))}</span>
        </li>
      ))}
    </ol>
  )
}

function TablaColores({
  escs,
  filas,
  orden,
  setOrden,
  sel,
  alternar,
}: {
  escs: Escenario[]
  filas: FilaAccion[]
  orden: string
  setOrden: (o: string) => void
  sel: Record<string, number>
  alternar: (t: string, marcado: boolean) => void
}) {
  const idx = escs.findIndex((e) => e.id === orden)
  const val = (f: FilaAccion) => (orden === 'peor' ? f.peor : idx >= 0 ? f.rets[idx] : f.esperado)
  const ordenadas = filas.slice().sort((x, y) => val(y) - val(x))
  const top3 = escs.map((_, i) => new Set(mejoresEnEscenario(filas, i).map((f) => f.a.ticker)))
  const activo = orden === 'peor' || idx >= 0 ? orden : 'esperado'
  const th = (id: string, txt: string) => (
    <th key={id} className={'r ' + (activo === id ? 'on' : '')} aria-sort={activo === id ? 'descending' : 'none'}>
      <button type="button" onClick={() => setOrden(id)}>
        {txt}
      </button>
    </th>
  )
  return (
    <div className="heat-wrap">
      <table className="heat">
        <thead>
          <tr>
            <th>
              <span className="sr">Elegir</span>
            </th>
            <th>Acción</th>
            {escs.map((e) => th(e.id, e.nombre))}
            {th('esperado', 'Esperado')}
            {th('peor', 'Peor caso')}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f) => {
            const elegida = sel[f.a.ticker] != null
            return (
              <tr key={f.a.ticker} className={elegida ? 'sel' : ''}>
                <td>
                  <input type="checkbox" checked={elegida} onChange={(e) => alternar(f.a.ticker, e.target.checked)} aria-label={`Sumar ${f.a.nombre} a mi selección`} />
                </td>
                <td>
                  <span className="nm">
                    <span className="tk">{f.a.ticker}</span>
                    <span className="sec">
                      {f.a.nombre} · {f.a.sector}
                    </span>
                  </span>
                </td>
                {f.rets.map((v, i) => (
                  <td key={escs[i].clave} className={'c ' + (top3[i].has(f.a.ticker) ? 'top' : '')} style={tono(v)}>
                    {pctS(v)}
                  </td>
                ))}
                <td className="c sum" style={tono(f.esperado)}>
                  {pctS(f.esperado)}
                </td>
                <td className="c" style={tono(f.peor)}>
                  {pctS(f.peor)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TuSeleccion({
  escs,
  equilibrada,
  presupuesto,
  total,
  fijarSel,
  resultado,
}: {
  escs: Escenario[]
  equilibrada: FilaAccion[]
  presupuesto: number
  total: number
  fijarSel: (s: Record<string, number>) => void
  resultado: ReturnType<typeof resultadoSeleccion>
}) {
  const { estado, fm } = useEstado()
  const grupo = estado.grupo
  const sel = estado.sel[grupo]
  const filasSel = Object.entries(sel)
    .map(([t, w]) => ({ t, w, a: estado.universo.find((x) => x.ticker === t) }))
    .filter((x) => x.a)
  const s = filasSel.reduce((a, b) => a + Math.max(0, b.w), 0)
  const ok = Math.abs(s - 100) < 0.05
  const eqEsp = equilibrada.length ? equilibrada.reduce((t, f) => t + f.esperado, 0) / equilibrada.length : 0
  const eqPeor = equilibrada.length ? Math.min(...escs.map((_, i) => equilibrada.reduce((t, f) => t + f.rets[i], 0) / equilibrada.length)) : 0
  const mx = resultado ? Math.max(0.05, ...resultado.rets.map(Math.abs)) : 1

  return (
    <>
      <p className="small">
        {presupuesto > 0 ? (
          <>
            Presupuesto en {nombreGrupo(grupo)}: <strong className="num">{fm.monto(presupuesto)}</strong>, el {pct(presupuesto / (total || 1))} de tu cartera. Se cambia en{' '}
            <a href="#riesgo">Cartera y riesgo</a>.
          </>
        ) : (
          <>
            No tenés monto asignado a {nombreGrupo(grupo)}. Asignale un porcentaje en <a href="#riesgo">Cartera y riesgo</a> para ver montos.
          </>
        )}{' '}
        {estado.selEjemplo && (
          <span className="muted">
            <MarcaEjemplo /> Selección de ejemplo.
          </span>
        )}
      </p>
      <div className="sel-grid">
        <div>
          <div className="rhead sel">
            <span>Acción</span>
            <span className="r">% del rubro</span>
            <span className="r">{fm.simbolo}</span>
          </div>
          <div>
            {filasSel.length ? (
              filasSel.map(({ t, w, a }) => (
                <div className="selrow" key={t}>
                  <span>
                    <span className="tk">{t}</span> <span className="sec">{a!.nombre}</span>
                  </span>
                  <span className="rpct">
                    <CampoNumero valor={r1(w)} onCambio={(v) => fijarSel({ ...sel, [t]: Math.max(0, Math.min(100, v)) })} min={0} max={100} step={5} aria-label={'Porcentaje en ' + a!.nombre} />
                    <span aria-hidden="true">%</span>
                  </span>
                  <span className="rmonto num">
                    {s > 0 ? fm.monto((presupuesto * Math.max(0, w)) / s) : '—'}{' '}
                    <button
                      type="button"
                      className="q"
                      aria-label={'Quitar ' + a!.nombre}
                      onClick={() => {
                        const nueva = { ...sel }
                        delete nueva[t]
                        fijarSel(nueva)
                      }}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <p className="vacio">Todavía no elegiste acciones de {nombreGrupo(grupo)}. Tildalas en la tabla o tocá "Usar estas" en algún escenario.</p>
            )}
          </div>
          <div className="sumrow" style={{ marginTop: 8 }}>
            <Chip ok={ok || !filasSel.length}>
              Suma <strong className="num">{decimal1(s)}%</strong>
            </Chip>
            {!ok && filasSel.length > 0 && s > 0 && (
              <button type="button" className="act small-act" onClick={() => fijarSel(ajustarA100(sel))}>
                Ajustar a 100%
              </button>
            )}
          </div>
        </div>
        <div>
          <h3>Cómo le iría en cada escenario</h3>
          {resultado ? (
            <>
              <div className="selres">
                {escs.map((e, i) => (
                  <div className="srr" key={e.clave}>
                    <span>
                      {e.nombre} <span className="muted small num">{entero(e.prob)}%</span>
                    </span>
                    <BarraDivergente valor={resultado.rets[i]} maximo={mx} />
                    <span className={'v ' + (resultado.rets[i] < 0 ? 'loss' : 'gain')}>
                      {pctS(resultado.rets[i])}
                      <br />
                      <span className="small">{fm.montoS(presupuesto * resultado.rets[i])}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="selkpi">
                <div>
                  <span className="eyebrow">Esperado</span>
                  <span className={'big ' + claseSigno(resultado.esperado)}>{pctS(resultado.esperado)}</span>
                  <span className="small muted">{fm.montoS(presupuesto * resultado.esperado)}</span>
                </div>
                <div>
                  <span className="eyebrow">Peor escenario</span>
                  <span className={'big ' + claseSigno(resultado.peor)}>{pctS(resultado.peor)}</span>
                  <span className="small muted">{fm.montoS(presupuesto * resultado.peor)}</span>
                </div>
                <div>
                  <span className="eyebrow">Equilibrada, para comparar</span>
                  <span className="big num">{pctS(eqEsp)}</span>
                  <span className="small muted">peor caso {pctS(eqPeor)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="vacio">Elegí al menos una acción para ver el resultado por escenario.</p>
          )}
        </div>
      </div>
    </>
  )
}
