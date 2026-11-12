// Ediciones anteriores del agente, con el impacto combinado recalculado sobre la cartera de hoy.
import { claseSigno, MarcaEjemplo } from '../componentes/basicos'
import { useEstado } from '../estado/almacen'
import { useEdiciones } from '../noticias/ediciones'
import { impactoNoticia } from '../noticias/impacto'
import { fechaLarga, horaCorta, pctS } from '../util/formato'

export function EdicionesAnteriores() {
  const { estado, montos, fm } = useEstado()
  const { ediciones, seleccionada, elegir, origen } = useEdiciones()
  return (
    <section className="panel" aria-labelledby="h-eds">
      <div className="panel-head">
        <h2 id="h-eds">Ediciones del agente</h2>
        <span className="small muted">se guardan los últimos 60 días</span>
      </div>
      {origen === 'cargando' ? (
        <p className="small muted" role="status">
          Buscando ediciones…
        </p>
      ) : (
        <div className="eds">
          {ediciones.map((e) => {
            const imp = impactoNoticia(montos, estado.rubros, { factorAR: e.escenario?.factorAR, factorGlobal: e.escenario?.factorGlobal })
            return (
              <article className="ed" key={e.fecha}>
                <div>
                  <h3>
                    {e.esEjemplo ? <MarcaEjemplo>Edición de ejemplo</MarcaEjemplo> : fechaLarga(e.fecha)}
                    {seleccionada?.fecha === e.fecha && <span className="small muted"> · en pantalla</span>}
                  </h3>
                  <p className="small muted">
                    {e.items.length} noticias{e.generada && !e.esEjemplo ? ` · leída ${horaCorta(e.generada)} h` : ''}
                  </p>
                  <p className="small">{e.panorama}</p>
                </div>
                <div className="ed-lado">
                  <span className={'num ed-imp ' + claseSigno(imp.pct)}>{pctS(imp.pct)}</span>
                  <span className="small muted">{fm.montoS(imp.pnl)} sobre tu cartera de hoy</span>
                  <a
                    className="small"
                    href="#riesgo"
                    onClick={() => {
                      elegir(e.fecha)
                    }}
                  >
                    Ver esta edición
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
