// Lectura de Claude sobre la selección de acciones del usuario.
import { useRef, useState } from 'react'
import { nombreGrupo } from '../acciones/universo'
import { useClaude } from '../datos/claude'
import { pctS } from '../util/formato'
import type { ContextoLectura } from './Acciones'

export function Lectura({ ctx }: { ctx: ContextoLectura }) {
  const claude = useClaude()
  const [texto, setTexto] = useState<string | null>(null)
  const [estado, setEstado] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const ctl = useRef<AbortController | null>(null)

  if (!claude.disponible) return claude.motivo ? <p className="small muted">{claude.motivo}</p> : null

  const pedir = async () => {
    const { escenarios, filas, equilibrada, seleccion, grupo } = ctx
    ctl.current = new AbortController()
    setOcupado(true)
    setEstado('')
    setTexto('Pensando…')
    try {
      const t = await claude.lectura(
        {
          grupo: nombreGrupo(grupo),
          escenarios: escenarios.map((e) => `- ${e.nombre} (${e.prob}%): ${e.riesgoPais}, ${e.spx}, ${e.tasas}, ${e.petroleo}, ${e.dolar}. ${e.descripcion}`).join('\n'),
          resultados: filas.map((f) => `${f.a.ticker} (${f.a.nombre}, ${f.a.sector}): ${escenarios.map((e, i) => e.nombre + ' ' + pctS(f.rets[i])).join('; ')}`).join('\n'),
          equilibrada: equilibrada.map((f) => f.a.ticker).join(', '),
          seleccion: seleccion
            ? `Selección del usuario: ${seleccion.pesos.map((x) => x.a.ticker + ' ' + Math.round(x.w * 100) + '%').join(', ')}; esperado ${pctS(seleccion.esperado)}, peor escenario ${pctS(seleccion.peor)}.`
            : 'El usuario todavía no eligió acciones.',
        },
        ctl.current.signal,
      )
      setTexto(t)
    } catch (err) {
      setTexto(null)
      setEstado(ctl.current.signal.aborted ? 'Lectura detenida.' : err instanceof Error ? err.message : 'No se pudo completar la lectura. Probá de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <div className="pegar-act">
        <button type="button" className="act" onClick={() => void pedir()} disabled={ocupado}>
          Pedir lectura a Claude
        </button>
        {ocupado && (
          <button type="button" className="link" onClick={() => ctl.current?.abort()}>
            Detener
          </button>
        )}
        <span className="small muted" role="status">
          {estado}
        </span>
      </div>
      {texto && (
        <div className="expl" aria-live="polite">
          {texto}
        </div>
      )}
    </>
  )
}
