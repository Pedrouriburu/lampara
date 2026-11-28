// Pantalla "Mi cartera": subir los reportes de Inviu y ver las posiciones reales.
//
// Inviu no tiene API, así que los datos entran por los dos Excel que exporta:
// Reportes > Portfolio (tenencias) y Reportes > Cuenta corriente (movimientos).
// El archivo se lee acá, en el navegador: a la base suben solo las filas leídas.

import { useCallback, useEffect, useState } from 'react'
import { accionDe } from '../acciones/universo'
import { claseSigno } from '../componentes/basicos'
import { cargarTenencias, esEfectivo, guardarMovimientos, guardarTenencias, listarImportaciones, type Importacion, type Posicion } from '../datos/inviu'
import { useSesion } from '../datos/sesion'
import { supabase } from '../datos/supabase'
import { useEstado } from '../estado/almacen'
import { decimal1, entero, fechaCorta, pctS } from '../util/formato'

type Estado = { tipo: 'quieto' } | { tipo: 'leyendo'; archivo: string } | { tipo: 'listo'; mensajes: string[] } | { tipo: 'error'; mensaje: string }

/** Monto de Inviu en la moneda que el usuario eligió ver. Son los números del broker, sin reconvertir. */
const montoDe = (p: Posicion, moneda: 'ARS' | 'USD') => (moneda === 'ARS' ? p.montoArs : p.montoUsd)
const simboloDe = (moneda: 'ARS' | 'USD') => (moneda === 'ARS' ? '$' : 'US$')
const signoMonto = (v: number, moneda: 'ARS' | 'USD') => (v > 0 ? '+' : v < 0 ? '−' : '') + simboloDe(moneda) + ' ' + entero(Math.abs(v))

export function MiCartera() {
  const { modo, referencia, irAIngreso } = useSesion()
  const { estado: app } = useEstado()
  const [posiciones, setPosiciones] = useState<Posicion[]>([])
  const [importaciones, setImportaciones] = useState<Importacion[]>([])
  const [estado, setEstado] = useState<Estado>({ tipo: 'quieto' })

  const refrescar = useCallback(async () => {
    if (!supabase) return
    const [p, i] = await Promise.all([cargarTenencias(supabase), listarImportaciones(supabase)])
    setPosiciones(p)
    setImportaciones(i)
  }, [])

  useEffect(() => {
    if (modo === 'cuenta') void refrescar().catch(() => setEstado({ tipo: 'error', mensaje: 'No pude leer tus posiciones guardadas.' }))
  }, [modo, refrescar])

  async function subir(archivos: FileList | null) {
    if (!archivos?.length || !supabase) return
    const mensajes: string[] = []
    try {
      // La librería que abre el .xlsx se descarga recién acá, no al abrir la app.
      const { leerReporte } = await import('../inviu/leer')
      for (const archivo of Array.from(archivos)) {
        setEstado({ tipo: 'leyendo', archivo: archivo.name })
        const r = await leerReporte(archivo)
        if (r.tipo === 'tenencias') {
          const n = await guardarTenencias(supabase, r.datos, archivo.name)
          mensajes.push(`Tenencias al ${fechaCorta(r.datos.fecha)}: ${n} líneas. Dólar MEP del archivo: $ ${entero(r.datos.tcMep)}.`)
        } else {
          const n = await guardarMovimientos(supabase, r.datos, archivo.name)
          mensajes.push(`Movimientos hasta ${fechaCorta(r.datos.fecha)}: ${n} líneas.`)
        }
      }
      await refrescar()
      setEstado({ tipo: 'listo', mensajes })
    } catch (e) {
      setEstado({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No pude leer el archivo.' })
    }
  }

  if (modo !== 'cuenta') {
    return (
      <div className="vista">
        <section className="panel">
          <h2>Mi cartera</h2>
          <p className="vacio">
            Tus posiciones son privadas, así que para cargarlas hace falta entrar con tu mail: quedan guardadas en tu cuenta y nadie más las ve.{' '}
            <button type="button" className="link" onClick={irAIngreso}>
              Entrar
            </button>
          </p>
        </section>
      </div>
    )
  }

  const instrumentos = posiciones.filter((p) => !esEfectivo(p))
  const efectivo = posiciones.filter(esEfectivo)
  const universo = referencia?.universo ?? []
  const moneda = app.moneda
  // Tipo de cambio implícito del propio archivo, para mostrar en dólares sin traer otra fuente.
  const conDolares = instrumentos.find((p) => p.montoUsd > 0)
  const tc = conDolares ? conDolares.montoArs / conDolares.montoUsd : 0
  const enVista = (ars: number) => (moneda === 'ARS' ? ars : tc ? ars / tc : 0)
  const total = instrumentos.reduce((s, p) => s + montoDe(p, moneda), 0)
  const resultado = instrumentos.reduce((s, p) => s + enVista(p.resultadoArs), 0)

  return (
    <div className="vista">
      <section className="panel" aria-labelledby="h-subir">
        <div className="panel-head">
          <h2 id="h-subir">Traer mi cartera de Inviu</h2>
          {importaciones[0] && <span className="small muted">última subida {fechaCorta(importaciones[0].subida)}</span>}
        </div>
        <p className="small muted">
          En Inviu, menú de la izquierda, sección <strong>Reportes</strong>. <strong>Portfolio</strong> baja tus tenencias; <strong>Cuenta corriente</strong> baja tus movimientos y se descarga con el
          nombre <span className="num">inviu-voucher-…xlsx</span>. Podés subir los dos juntos: reconozco cuál es cuál por el contenido.
        </p>
        <p>
          {/* El campo va adentro de la etiqueta para que el foco del teclado se vea (ver .act:focus-within). */}
          <label className="act">
            Elegir archivos
            <input
              type="file"
              accept=".xlsx"
              multiple
              className="sr"
              onChange={(e) => {
                const archivos = e.target.files
                // Se limpia para que elegir el mismo archivo otra vez vuelva a disparar la carga.
                e.target.value = ''
                void subir(archivos)
              }}
            />
          </label>
        </p>
        {estado.tipo === 'leyendo' && (
          <p className="small" role="status">
            Leyendo {estado.archivo}…
          </p>
        )}
        {estado.tipo === 'listo' && (
          <div role="status">
            {estado.mensajes.map((m) => (
              <p key={m} className="small gain">
                {m}
              </p>
            ))}
          </div>
        )}
        {estado.tipo === 'error' && (
          <p className="small loss" role="alert">
            {estado.mensaje}
          </p>
        )}
        <p className="small muted">El archivo se lee en tu navegador. A tu cuenta suben solo las posiciones, nunca el archivo.</p>
      </section>

      {instrumentos.length > 0 && (
        <section className="panel" aria-labelledby="h-pos">
          <div className="panel-head">
            <h2 id="h-pos">Mis posiciones</h2>
            <span className="small muted">al {fechaCorta(posiciones[0].fecha)} · según Inviu</span>
          </div>
          <div className="tbl-scroll">
            <table className="tabla-hist">
              <thead>
                <tr>
                  <th>Activo</th>
                  <th className="r">Cantidad</th>
                  <th className="r">Precio</th>
                  <th className="r">Costo</th>
                  <th className="r">Valor</th>
                  <th className="r">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {instrumentos.map((p) => {
                  const a = accionDe(universo, p.ticker, p.nombre, p.clase)
                  return (
                    <tr key={p.ticker}>
                      <td>
                        <span className="num">{p.ticker}</span> <span className="small muted">{p.nombre}</span>
                        {a.estimada && (
                          <>
                            {' '}
                            <span className="small muted" title={`Sin calibrar: se usa el perfil típico de ${a.sector}.`}>
                              (sensibilidad estimada)
                            </span>
                          </>
                        )}
                      </td>
                      <td className="r num">{decimal1(p.cantidad)}</td>
                      <td className="r num">{entero(p.precio)}</td>
                      <td className="r num">{entero(p.costo)}</td>
                      <td className="r num">
                        {simboloDe(moneda)} {entero(montoDe(p, moneda))}
                      </td>
                      <td className={'r num ' + claseSigno(p.resultadoArs)}>
                        {signoMonto(enVista(p.resultadoArs), moneda)} <span className="small">{pctS(p.varPct / 100)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total en instrumentos</td>
                  <td className="r num">
                    {simboloDe(moneda)} {entero(total)}
                  </td>
                  <td className={'r num ' + claseSigno(resultado)}>{signoMonto(resultado, moneda)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {efectivo.length > 0 && (
            <p className="small muted">
              Más efectivo en la cuenta:{' '}
              {efectivo.map((p) => `${p.moneda} ${entero(p.cantidad)}`).join(' · ')}.
            </p>
          )}
          <p className="small muted">
            Los montos son los de Inviu, con el dólar MEP que traía el archivo. No los recalculo con otra fuente para que coincidan con lo que ves en tu broker.
          </p>
        </section>
      )}
    </div>
  )
}
