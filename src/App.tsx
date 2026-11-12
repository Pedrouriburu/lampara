import { useEffect, useState } from 'react'
import { AVISO, CampoNumero, MarcaEjemplo, Seg } from './componentes/basicos'
import { ProveedorClaude } from './datos/claude'
import { armarCorrida } from './datos/corridas'
import { traerMepDelDia } from './datos/cotizaciones'
import { ultimaCotizacion } from './datos/nube'
import { ProveedorSesion, useSesion } from './datos/sesion'
import { hayNube, supabase } from './datos/supabase'
import { ProveedorEstado, useEstado } from './estado/almacen'
import { ProveedorEdiciones, useEdiciones } from './noticias/ediciones'
import { Acciones } from './pantallas/Acciones'
import { CarteraRiesgo } from './pantallas/CarteraRiesgo'
import { EdicionesAnteriores } from './pantallas/EdicionesAnteriores'
import { Historial } from './pantallas/Historial'
import { Ingreso } from './pantallas/Ingreso'
import { PanelNoticias } from './pantallas/PanelNoticias'
import { Supuestos } from './pantallas/Supuestos'
import { MEP_REFERENCIA, MEP_REFERENCIA_NOTA, type OpcionesSimulacion, type ResultadoSimulacion } from './riesgo'
import { entero, horaCorta } from './util/formato'
import { aplicarTema, leerTema, useRuta, type Ruta, type Tema } from './util/ruta'

const PESTANAS: { ruta: Ruta; texto: string; corto: string }[] = [
  { ruta: 'riesgo', texto: 'Cartera y riesgo', corto: 'Cartera' },
  { ruta: 'acciones', texto: 'Acciones por escenario', corto: 'Acciones' },
  { ruta: 'historial', texto: 'Historial', corto: 'Historial' },
  { ruta: 'supuestos', texto: 'Supuestos', corto: 'Supuestos' },
]

export default function App() {
  return (
    <ProveedorEstado>
      <ProveedorSesion>
        <ProveedorEdiciones>
          <ProveedorClaude>
            <Entrada />
          </ProveedorClaude>
        </ProveedorEdiciones>
      </ProveedorSesion>
    </ProveedorEstado>
  )
}

function Entrada() {
  const { listo, modo } = useSesion()
  if (!listo) {
    return (
      <div className="wrap">
        <p className="small muted" role="status">
          Abriendo Lámpara…
        </p>
      </div>
    )
  }
  return modo === 'ingreso' ? <Ingreso /> : <Carcasa />
}

function Carcasa() {
  const ruta = useRuta()
  const { seleccionada } = useEdiciones()
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
          <Cuenta />
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

      {ruta === 'riesgo' && <CarteraRiesgo noticias={(p) => <PanelNoticias {...p} />} acciones={(r, o) => <BotonGuardarCorrida resultado={r} opciones={o} />} />}
      {ruta === 'acciones' && <Acciones edicion={seleccionada} />}
      {ruta === 'historial' && <Historial ediciones={<EdicionesAnteriores />} />}
      {ruta === 'supuestos' && <Supuestos />}

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
    void (async () => {
      const delDia = await traerMepDelDia()
      // Respaldo: la última cotización que guardó el agente en la base.
      const c = delDia ?? (supabase ? await ultimaCotizacion(supabase) : null)
      if (c && vigente) cambiar((e) => (e.mepOrigen === 'manual' ? {} : { mep: c.mep, mepOrigen: delDia ? 'api' : 'agente', mepFecha: c.fecha }), true)
    })()
    return () => {
      vigente = false
    }
  }, [manual, cambiar])
}

function Cuenta() {
  const { modo, usuario, sync, salir, irAIngreso } = useSesion()
  if (modo === 'cuenta' && usuario) {
    const estado = { inactivo: '', cargando: 'Trayendo tu cartera…', guardando: 'Guardando…', guardado: 'Guardado en tu cuenta', error: 'No se pudo guardar; se reintenta con el próximo cambio' }[sync]
    return (
      <p className="small cuenta">
        <span className="num">{usuario.email}</span>
        {estado && (
          <span className={sync === 'error' ? 'loss' : 'muted'} role="status">
            {' · '}
            {estado}
          </span>
        )}
        {' · '}
        <button type="button" className="link" onClick={() => void salir()}>
          Salir
        </button>
      </p>
    )
  }
  return (
    <p className="small cuenta">
      <MarcaEjemplo>Modo de demostración</MarcaEjemplo> <span className="muted">Tus cambios se guardan solo en este navegador.</span>{' '}
      <button type="button" className="link" onClick={irAIngreso}>
        {hayNube ? 'Entrar con mi mail' : 'Volver al inicio'}
      </button>
    </p>
  )
}

function BotonGuardarCorrida({ resultado, opciones }: { resultado: ResultadoSimulacion | null; opciones: OpcionesSimulacion }) {
  const { estado } = useEstado()
  const { guardarCorrida } = useSesion()
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])
  return (
    <>
      <button
        type="button"
        className="act"
        disabled={!resultado}
        onClick={async () => {
          if (!resultado) return
          const ok = await guardarCorrida(armarCorrida(resultado, opciones, { totalUsd: estado.totalUsd, pct: estado.pct, mep: estado.mep, moneda: estado.moneda }))
          setAviso(ok ? 'Corrida guardada' : 'No se pudo guardar la corrida')
        }}
      >
        Guardar corrida
      </button>
      {aviso && (
        <span className="small" role="status">
          {aviso}
          {aviso === 'Corrida guardada' && (
            <>
              {' · '}
              <a href="#historial">ver historial</a>
            </>
          )}
        </span>
      )}
    </>
  )
}

function ControlesMoneda() {
  const { estado, cambiar } = useEstado()
  const origen =
    estado.mepOrigen === 'api'
      ? `del día · dolarapi.com${estado.mepFecha ? ' ' + horaCorta(estado.mepFecha) + ' h' : ''}`
      : estado.mepOrigen === 'agente'
        ? 'último que guardó el agente'
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
