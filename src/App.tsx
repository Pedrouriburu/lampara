import { useEffect, useState } from 'react'
import { AVISO, CampoNumero, Seg } from './componentes/basicos'
import { traerMepDelDia } from './datos/cotizaciones'
import { ProveedorEstado, useEstado } from './estado/almacen'
import { CarteraRiesgo } from './pantallas/CarteraRiesgo'
import { MEP_REFERENCIA, MEP_REFERENCIA_NOTA } from './riesgo'
import { entero, horaCorta } from './util/formato'
import { aplicarTema, leerTema, useRuta, type Ruta, type Tema } from './util/ruta'

const PESTANAS: { ruta: Ruta; texto: string; corto: string }[] = [{ ruta: 'riesgo', texto: 'Cartera y riesgo', corto: 'Cartera' }]

export default function App() {
  return (
    <ProveedorEstado>
      <Carcasa />
    </ProveedorEstado>
  )
}

function Carcasa() {
  const ruta = useRuta()
  useMepDelDia()

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">Mesa de riesgo · cartera argentina</div>
          <h1>Lámpara</h1>
          <p className="lead">Proyecta tu cartera con miles de escenarios, mide cuánto podrías perder y muestra qué activo pone el riesgo.</p>
        </div>
        <div className="top-lado">
          <p className="warn">{AVISO}</p>
          <SelectorTema />
        </div>
      </header>

      <nav className="vistas" aria-label="Secciones">
        <span className="seg tabs">
          {PESTANAS.map((p) => (
            <a key={p.ruta} href={'#' + p.ruta} aria-current={ruta === p.ruta ? 'page' : undefined}>
              <span className="solo-ancho">{p.texto}</span>
              <span className="solo-angosto">{p.corto}</span>
            </a>
          ))}
        </span>
        <ControlesMoneda />
      </nav>

      {ruta === 'riesgo' && <CarteraRiesgo />}

      <Pie />
    </div>
  )
}

/** Completa el MEP solo con la cotización del día, salvo que el usuario haya cargado el suyo. */
function useMepDelDia() {
  const { estado, cambiar } = useEstado()
  const manual = estado.mepOrigen === 'manual'
  useEffect(() => {
    if (manual) return
    let vigente = true
    void traerMepDelDia().then((c) => {
      if (c && vigente) cambiar((e) => (e.mepOrigen === 'manual' ? {} : { mep: c.mep, mepOrigen: 'api', mepFecha: c.fecha }), true)
    })
    return () => {
      vigente = false
    }
  }, [manual, cambiar])
}

function ControlesMoneda() {
  const { estado, cambiar } = useEstado()
  const origen =
    estado.mepOrigen === 'api'
      ? `del día · dolarapi.com${estado.mepFecha ? ' ' + horaCorta(estado.mepFecha) + ' h' : ''}`
      : estado.mepOrigen === 'agente'
        ? 'último del agente'
        : estado.mepOrigen === 'manual'
          ? 'cargado por vos'
          : 'de referencia (4/11/2026)'
  return (
    <span className="navctl">
      <span className="ctl">
        Ver en
        <Seg
          etiqueta="Moneda"
          valor={estado.moneda}
          onCambio={(moneda) => cambiar({ moneda })}
          opciones={[
            { valor: 'ARS', texto: 'Pesos' },
            { valor: 'USD', texto: 'Dólares' },
          ]}
        />
      </span>
      <span className="ctl mepctl">
        <label htmlFor="mepIn">Dólar MEP $</label>
        <CampoNumero
          id="mepIn"
          valor={estado.mep}
          onCambio={(v) => {
            if (v >= 100) cambiar({ mep: v, mepOrigen: 'manual', mepFecha: null })
          }}
          min={100}
          step={5}
        />
        <span className="small muted">
          {origen}
          {estado.mepOrigen === 'manual' && (
            <>
              {' · '}
              <button type="button" className="link" onClick={() => cambiar({ mep: MEP_REFERENCIA, mepOrigen: 'referencia', mepFecha: null })}>
                usar el del día
              </button>
            </>
          )}
        </span>
      </span>
    </span>
  )
}

function SelectorTema() {
  const [tema, setTema] = useState<Tema>(leerTema)
  const elegir = (t: Tema) => {
    setTema(t)
    aplicarTema(t)
  }
  return (
    <span className="ctl small">
      Tema
      <Seg
        etiqueta="Tema"
        valor={tema}
        onCambio={elegir}
        opciones={[
          { valor: 'auto', texto: 'Auto' },
          { valor: 'light', texto: 'Claro' },
          { valor: 'dark', texto: 'Oscuro' },
        ]}
      />
    </span>
  )
}

function Pie() {
  const { estado } = useEstado()
  return (
    <footer>
      El riesgo se calcula en dólares y se muestra en pesos al dólar MEP que elijas (hoy: $ {entero(estado.mep)}; referencia inicial: {MEP_REFERENCIA_NOTA}). Si el dólar sube, el valor en pesos de tus
      activos dolarizados sube aunque en dólares no cambie. Las cifras de escenarios históricos son aproximadas y los datos marcados como ejemplo no son reales. Lámpara es una herramienta educativa: no
      es asesoramiento financiero ni una recomendación de inversión.
    </footer>
  )
}
