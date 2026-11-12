// Pantalla Supuestos: parámetros de los rubros y sensibilidades de las acciones, editables con aviso.
import { useState } from 'react'
import { copiaUniverso, nombreGrupo, UNIVERSO_BASE, type Accion, type Grupo } from '../acciones/universo'
import { CampoNumero, Seg } from '../componentes/basicos'
import { useEstado } from '../estado/almacen'
import { copiaRubros, correlacion, RUBROS_BASE, type Rubro } from '../riesgo'

const acotar = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** Tope de una sensibilidad dado el valor de la otra. */
const limite = (otra: number) => Math.sqrt(Math.max(0, 1 - otra * otra))
const r1 = (v: number) => +v.toFixed(1)
const r2 = (v: number) => +v.toFixed(2)

export function Supuestos() {
  const { estado, cambiar } = useEstado()
  const [editar, setEditar] = useState(false)
  const [grupo, setGrupo] = useState<Grupo>('merval')

  const rubrosCambiados = JSON.stringify(estado.rubros) !== JSON.stringify(RUBROS_BASE)
  const universoCambiado = JSON.stringify(estado.universo) !== JSON.stringify(UNIVERSO_BASE)

  const fijarRubro = (id: Rubro['id'], campo: 'ret' | 'vol' | 'golpeCrisis' | 'betaAr' | 'betaGlobal', v: number) =>
    cambiar((e) => ({
      rubros: e.rubros.map((r) => {
        if (r.id !== id) return r
        const n = { ...r }
        if (campo === 'ret') n.ret = acotar(v, -90, 200) / 100
        if (campo === 'vol') n.vol = acotar(v, 0, 200) / 100
        if (campo === 'golpeCrisis') n.golpeCrisis = acotar(v, -95, 100) / 100
        // Las sensibilidades no pueden explicar más del 100% del movimiento: beta_ar² + beta_global² ≤ 1.
        if (campo === 'betaAr') n.betaAr = acotar(v, -limite(r.betaGlobal), limite(r.betaGlobal))
        if (campo === 'betaGlobal') n.betaGlobal = acotar(v, -limite(r.betaAr), limite(r.betaAr))
        return n
      }),
    }))

  const fijarAccion = (ticker: string, campo: 'rp' | 'beta' | 'tasas' | 'oil' | 'dolar', v: number) =>
    cambiar((e) => ({
      universo: e.universo.map((a): Accion => (a.ticker === ticker ? { ...a, [campo]: acotar(v, campo === 'beta' || campo === 'oil' ? -5 : -50, campo === 'beta' || campo === 'oil' ? 5 : 50) } : a)),
    }))

  const mayorCorrelacion = estado.rubros
    .flatMap((a, i) => estado.rubros.slice(i + 1).map((b) => ({ a, b, c: correlacion(a, b) })))
    .sort((x, y) => y.c - x.c)[0]

  return (
    <div className="vista">
      <section className="panel" aria-labelledby="h-sup-aviso">
        <h2 id="h-sup-aviso">Supuestos del modelo</h2>
        <p className="aviso-ej">
          Estos números no salen de datos de mercado: son aproximaciones ilustrativas elegidas a mano. Cambiarlos cambia todos los resultados de Lámpara (riesgo, stress tests, impacto de las noticias y
          ranking de acciones). Los cambios se guardan solo para vos y siempre podés restablecer los valores iniciales.
        </p>
        <label className="ctl">
          <input type="checkbox" checked={editar} onChange={(e) => setEditar(e.target.checked)} /> Entiendo, quiero editar los supuestos
        </label>
      </section>

      <section className="panel" aria-labelledby="h-sup-rubros">
        <div className="panel-head">
          <h2 id="h-sup-rubros">Rubros de la cartera</h2>
          <button type="button" className="link" disabled={!rubrosCambiados} onClick={() => cambiar({ rubros: copiaRubros() })}>
            Restablecer rubros
          </button>
        </div>
        <p className="small muted">
          Rendimiento y volatilidad anual esperados en dólares, golpe ante una crisis local y sensibilidad a cada factor. Las sensibilidades fijan las correlaciones entre rubros
          {mayorCorrelacion ? ` (la más alta hoy: ${mayorCorrelacion.a.corto} con ${mayorCorrelacion.b.corto}, ${r2(mayorCorrelacion.c).toString().replace('.', ',')})` : ''}.
        </p>
        <div className="tbl-scroll">
          <table className="tabla-sup">
            <thead>
              <tr>
                <th>Rubro</th>
                <th className="r">Rend. anual %</th>
                <th className="r">Volatilidad %</th>
                <th className="r">Golpe en crisis %</th>
                <th className="r">Sens. Argentina</th>
                <th className="r">Sens. global</th>
              </tr>
            </thead>
            <tbody>
              {estado.rubros.map((a) => (
                <tr key={a.id}>
                  <td>{a.corto}</td>
                  <td className="r">
                    <CampoNumero valor={r1(a.ret * 100)} onCambio={(v) => fijarRubro(a.id, 'ret', v)} step={1} disabled={!editar} aria-label={'Rendimiento anual de ' + a.corto} />
                  </td>
                  <td className="r">
                    <CampoNumero valor={r1(a.vol * 100)} onCambio={(v) => fijarRubro(a.id, 'vol', v)} step={1} min={0} disabled={!editar} aria-label={'Volatilidad de ' + a.corto} />
                  </td>
                  <td className="r">
                    <CampoNumero valor={r1(a.golpeCrisis * 100)} onCambio={(v) => fijarRubro(a.id, 'golpeCrisis', v)} step={1} disabled={!editar} aria-label={'Golpe en crisis de ' + a.corto} />
                  </td>
                  <td className="r">
                    <CampoNumero valor={r2(a.betaAr)} onCambio={(v) => fijarRubro(a.id, 'betaAr', v)} step={0.05} min={-1} max={1} disabled={!editar} aria-label={'Sensibilidad Argentina de ' + a.corto} />
                  </td>
                  <td className="r">
                    <CampoNumero
                      valor={r2(a.betaGlobal)}
                      onCambio={(v) => fijarRubro(a.id, 'betaGlobal', v)}
                      step={0.05}
                      min={-1}
                      max={1}
                      disabled={!editar}
                      aria-label={'Sensibilidad global de ' + a.corto}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Las dos sensibilidades de un rubro, elevadas al cuadrado, no pueden sumar más de 1: si te pasás, se recortan solas.</p>
      </section>

      <section className="panel" aria-labelledby="h-sup-acc">
        <div className="panel-head">
          <h2 id="h-sup-acc">Sensibilidades de las acciones</h2>
          <span className="sumrow">
            <Seg
              etiqueta="Grupo de acciones"
              valor={grupo}
              onCambio={setGrupo}
              opciones={[
                { valor: 'merval', texto: 'Merval' },
                { valor: 'cedears', texto: 'CEDEARs' },
              ]}
            />
            <button type="button" className="link" disabled={!universoCambiado} onClick={() => cambiar({ universo: copiaUniverso() })}>
              Restablecer acciones
            </button>
          </span>
        </div>
        <p className="small muted">
          Aproximaciones por sector para {nombreGrupo(grupo)}, no estimadas con datos de cada empresa. Riesgo país: % de suba por cada 100 pb que baja. S&amp;P 500: % por cada 1% del índice. Tasas: %
          por cada 100 pb que suben las de EE.UU. Brent: elasticidad al petróleo. Dólar: % por cada 10% de devaluación del peso.
        </p>
        <div className="tbl-scroll">
          <table className="tabla-sup">
            <thead>
              <tr>
                <th>Acción</th>
                <th className="r">Riesgo país</th>
                <th className="r">S&amp;P 500</th>
                <th className="r">Tasas</th>
                <th className="r">Brent</th>
                <th className="r">Dólar</th>
              </tr>
            </thead>
            <tbody>
              {estado.universo
                .filter((a) => a.grupo === grupo)
                .map((a) => (
                  <tr key={a.ticker}>
                    <td>
                      <span className="num">{a.ticker}</span> <span className="small muted">{a.sector}</span>
                    </td>
                    {(['rp', 'beta', 'tasas', 'oil', 'dolar'] as const).map((c) => (
                      <td className="r" key={c}>
                        <CampoNumero valor={a[c]} onCambio={(v) => fijarAccion(a.ticker, c, v)} step={c === 'beta' || c === 'oil' ? 0.05 : 1} disabled={!editar} aria-label={`${c} de ${a.nombre}`} />
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
