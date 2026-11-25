// Panel del agente de noticias: edición del día, impacto sobre la cartera y análisis a pedido.
import { useRef, useState, type ReactNode } from 'react'
import { BarraDivergente, claseSigno, MarcaEjemplo } from '../componentes/basicos'
import { useClaude } from '../datos/claude'
import { useEstado } from '../estado/almacen'
import { useEdiciones } from '../noticias/ediciones'
import { impactoNoticia, masGolpeado } from '../noticias/impacto'
import { urlSegura, type Noticia } from '../noticias/tipos'
import { numero } from '../riesgo'
import { enDolares, fechaLarga, horaCorta, pct, pctS } from '../util/formato'
import type { PropsNoticias } from './CarteraRiesgo'

/** Composición de la cartera en texto, para mandarle al modelo. */
// oxlint-disable-next-line react/only-export-components
export function useComposicionTexto(): string {
  const { estado, montos } = useEstado()
  const total = estado.rubros.reduce((s, a) => s + Math.max(0, montos[a.id] || 0), 0) || 1
  return estado.rubros
    .filter((a) => montos[a.id] > 0)
    .map((a) => `- ${a.nombre}: ${pct(montos[a.id] / total)} (${enDolares(montos[a.id])})`)
    .join('\n')
}

export function PanelNoticias({ llevarAFactores }: PropsNoticias) {
  const { estado, montos, fm } = useEstado()
  const { ediciones, seleccionada: e, elegir, origen, nota } = useEdiciones()
  const claude = useClaude()

  if (origen === 'cargando' || !e) {
    return (
      <section className="panel news" aria-labelledby="h-news">
        <Encabezado />
        <p className="small muted" role="status">
          Buscando la última edición del agente…
        </p>
      </section>
    )
  }

  const items = Array.isArray(e.items) ? e.items : []
  const esc = e.escenario || {}
  const combinado = impactoNoticia(montos, estado.rubros, { factorAR: esc.factorAR, factorGlobal: esc.factorGlobal })
  const mx = Math.max(0.05, ...items.map((n) => Math.abs(impactoNoticia(montos, estado.rubros, n).pct)))
  const fuentes = (e.fuentes ?? []).filter((f) => urlSegura(f.url))

  return (
    <section className="panel news" aria-labelledby="h-news">
      <Encabezado>
        {ediciones.length > 1 && (
          <label className="ctl small">
            Edición
            <select value={e.fecha} onChange={(ev) => elegir(ev.target.value)}>
              {ediciones.map((x) => (
                <option key={x.fecha} value={x.fecha}>
                  {fechaLarga(x.fecha)}
                </option>
              ))}
            </select>
          </label>
        )}
      </Encabezado>

      {e.esEjemplo ? (
        <p className="aviso-ej">
          <MarcaEjemplo>Edición de ejemplo</MarcaEjemplo> {nota ?? 'Noticias inventadas para mostrar cómo funciona el panel.'} Los impactos sí se calculan con tu cartera.
        </p>
      ) : (
        <p className="small muted">
          Edición del {fechaLarga(e.fecha)}
          {e.generada ? ` · leída por el agente ${horaCorta(e.generada)} h` : ''} · {items.length} noticias
        </p>
      )}

      <div className="pano">
        <p>{e.panorama}</p>
        <div className="pano-imp">
          <span className="eyebrow">Si se confirma el tono de hoy, en un mes</span>
          <span className={'big num ' + claseSigno(combinado.pct)}>{pctS(combinado.pct)}</span>
          <span className="small muted">
            {fm.montoS(combinado.pnl)} sobre {fm.monto(combinado.total)} · {masGolpeado(combinado, estado.rubros)}
            {esc.explicacion ? '. ' + esc.explicacion : ''}
          </span>
          <button
            type="button"
            className="link"
            onClick={() => llevarAFactores(numero(esc.factorAR, -3, 3), numero(esc.factorGlobal, -3, 3), e.esEjemplo ? 'tono de la edición de ejemplo' : 'tono de las noticias del ' + fechaLarga(e.fecha))}
          >
            Llevar al escenario por factores
          </button>
        </div>
      </div>

      <div className="items">
        {items.map((n, i) => (
          <Tarjeta key={e.fecha + ':' + (n.id ?? i)} n={n} maximo={mx} llevarAFactores={llevarAFactores} />
        ))}
      </div>

      {fuentes.length > 0 && !e.esEjemplo && (
        <details className="fuentes">
          <summary>Fuentes de esta edición ({fuentes.length})</summary>
          <ul>
            {fuentes.map((f) => (
              <li key={f.url}>
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  {f.portal}
                </a>{' '}
                <span className="muted small">{new URL(f.url).hostname.replace(/^www\./, '')}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {claude.disponible ? <AnalizarOtra llevarAFactores={llevarAFactores} /> : claude.motivo && <p className="small muted">{claude.motivo}</p>}

      <p className="small muted">El agente traduce titulares a movimientos de dos factores. Es una lectura posible para pensar escenarios, no un pronóstico ni una recomendación.</p>
    </section>
  )
}

function Encabezado({ children }: { children?: ReactNode }) {
  return (
    <div className="panel-head">
      <div>
        <div className="eyebrow">Agente de noticias</div>
        <h2 id="h-news">Qué dicen las noticias de tu cartera</h2>
      </div>
      {children}
    </div>
  )
}

function Tarjeta({ n, maximo, llevarAFactores, explicacionInicial }: { n: Noticia; maximo: number; llevarAFactores: PropsNoticias['llevarAFactores']; explicacionInicial?: string }) {
  const { estado, montos, fm } = useEstado()
  const claude = useClaude()
  const cartera = useComposicionTexto()
  const [explicacion, setExplicacion] = useState<string | null>(explicacionInicial ?? null)
  const [pensando, setPensando] = useState(false)
  const r = impactoNoticia(montos, estado.rubros, n)
  const url = urlSegura(n.url)
  const ambito = n.ambito === 'Mundo' ? 'Mundo' : 'Argentina'

  const explicar = async () => {
    setPensando(true)
    setExplicacion('Pensando…')
    const porRubro = r.detalle
      .filter((d) => d.monto > 0)
      .map((d) => `${estado.rubros.find((a) => a.id === d.id)?.corto} ${pctS(d.shock)}`)
      .join(', ')
    try {
      const texto = await claude.explicar({
        noticia: { titulo: n.titulo, resumen: n.resumen, canal: n.canal, factorAR: numero(n.factorAR, -3, 3), factorGlobal: numero(n.factorGlobal, -3, 3) },
        cartera,
        impacto: `${pctS(r.pct)} (US$ ${Math.round(r.pnl)}); por rubro: ${porRubro}`,
      })
      setExplicacion(texto)
    } catch (err) {
      setExplicacion(err instanceof Error ? err.message : 'No se pudo completar la explicación. Probá de nuevo.')
    } finally {
      setPensando(false)
    }
  }

  return (
    <article className="item">
      <div className="item-top">
        <span className={'tag ' + (ambito === 'Argentina' ? 'ar' : '')}>{ambito}</span>
        {n.fuente && <span className="small muted">{n.fuente}</span>}
        {n.horizonte && <span className="small muted">· horizonte: {n.horizonte}</span>}
        {n.confianza && <span className="small muted">· confianza {n.confianza}</span>}
      </div>
      <h3>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {n.titulo}
          </a>
        ) : (
          n.titulo
        )}
      </h3>
      {n.resumen && <p className="small">{n.resumen}</p>}
      {n.canal && (
        <p className="canal">
          <strong>Cómo llega a tu cartera:</strong> {n.canal}
        </p>
      )}
      <div className="imp">
        <span className={'num ' + claseSigno(r.pct)}>{pctS(r.pct)}</span>
        <BarraDivergente valor={r.pct} maximo={maximo} />
      </div>
      <p className="small muted">
        {fm.montoS(r.pnl)} · {masGolpeado(r, estado.rubros)}
      </p>
      <div className="item-act">
        {claude.disponible && (
          <button type="button" className="link" onClick={() => void explicar()} disabled={pensando}>
            Explicar para mi cartera
          </button>
        )}
        <button type="button" className="link" onClick={() => llevarAFactores(numero(n.factorAR, -3, 3), numero(n.factorGlobal, -3, 3), n.titulo)}>
          Probar en escenario
        </button>
      </div>
      {explicacion && (
        <div className="expl" aria-live="polite">
          {explicacion}
        </div>
      )}
    </article>
  )
}

function AnalizarOtra({ llevarAFactores }: { llevarAFactores: PropsNoticias['llevarAFactores'] }) {
  const { estado, montos } = useEstado()
  const claude = useClaude()
  const cartera = useComposicionTexto()
  const [texto, setTexto] = useState('')
  const [estadoTxt, setEstadoTxt] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [analizada, setAnalizada] = useState<Noticia | null>(null)
  const ctl = useRef<AbortController | null>(null)

  const analizar = async () => {
    const t = texto.trim().slice(0, 4000)
    if (t.length < 15) {
      setEstadoTxt('Escribí o pegá al menos una oración.')
      return
    }
    ctl.current = new AbortController()
    setOcupado(true)
    setEstadoTxt('Analizando…')
    try {
      setAnalizada(await claude.analizar({ texto: t, cartera }, ctl.current.signal))
      setEstadoTxt('')
    } catch (err) {
      setEstadoTxt(ctl.current.signal.aborted ? 'Análisis detenido.' : err instanceof Error ? err.message : 'No se pudo completar el análisis. Probá de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="pegar">
      <h3>Analizar otra noticia</h3>
      <p className="small muted">Pegá un titular o un párrafo. El analista lo traduce a los dos factores del modelo y calcula el efecto sobre tu cartera.</p>
      <label htmlFor="pegarTxt" className="sr">
        Texto de la noticia
      </label>
      <textarea id="pegarTxt" rows={3} maxLength={4000} placeholder="Ej.: El BCRA vuelve a comprar dólares y baja el riesgo país" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="pegar-act">
        <button type="button" className="act" onClick={() => void analizar()} disabled={ocupado}>
          Analizar impacto
        </button>
        {ocupado && (
          <button type="button" className="link" onClick={() => ctl.current?.abort()}>
            Detener
          </button>
        )}
        <span className="small muted" role="status">
          {estadoTxt}
        </span>
      </div>
      {analizada && (
        <div className="items">
          <Tarjeta
            key={analizada.titulo}
            n={analizada}
            maximo={Math.max(0.05, Math.abs(impactoNoticia(montos, estado.rubros, analizada).pct))}
            llevarAFactores={llevarAFactores}
            explicacionInicial={analizada.explicacion}
          />
        </div>
      )}
    </div>
  )
}
