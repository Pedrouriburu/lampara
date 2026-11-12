// Pantalla de ingreso: enlace mágico por mail (Supabase) o "Probar sin cuenta" con datos de ejemplo.
import { useState, type FormEvent } from 'react'
import { AVISO } from '../componentes/basicos'
import { useSesion } from '../datos/sesion'
import { hayNube } from '../datos/supabase'

export function Ingreso() {
  const { pedirEnlace, verificarCodigo, entrarDemo, errorIngreso } = useSesion()
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(errorIngreso)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const mail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError('Escribí un mail válido, por ejemplo nombre@gmail.com.')
      return
    }
    setOcupado(true)
    setError(null)
    const err = await pedirEnlace(mail)
    setOcupado(false)
    if (err) setError(err)
    else setEnviado(true)
  }

  const entrarConCodigo = async (e: FormEvent) => {
    e.preventDefault()
    if (codigo.trim().length < 6) {
      setError('El código tiene al menos 6 números.')
      return
    }
    setOcupado(true)
    setError(null)
    const err = await verificarCodigo(email.trim(), codigo)
    setOcupado(false)
    if (err) setError(err)
  }

  return (
    <div className="wrap ingreso">
      <header className="top">
        <div>
          <div className="eyebrow">Mesa de riesgo · cartera argentina</div>
          <h1>Lámpara</h1>
          <p className="lead">
            Simulador de riesgo para una cartera argentina en pesos y dólares: proyecta miles de escenarios, lee las noticias de cada día y muestra qué acciones salen mejor en cada escenario.
          </p>
        </div>
        <p className="warn">{AVISO}</p>
      </header>

      <div className="ingreso-grid">
        <section className="panel" aria-labelledby="h-entrar">
          <h2 id="h-entrar">Entrar con tu mail</h2>
          {hayNube ? (
            !enviado ? (
              <form className="form" onSubmit={enviar} noValidate>
                <p className="small muted">Te mandamos un enlace para entrar, sin contraseña. Tu cartera queda guardada en tu cuenta y la ves igual en el celular y en la computadora.</p>
                <label htmlFor="mail">Mail</label>
                <input id="mail" type="email" autoComplete="email" inputMode="email" placeholder="nombre@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <button type="submit" className="act primario" disabled={ocupado}>
                  {ocupado ? 'Enviando…' : 'Enviarme el enlace'}
                </button>
              </form>
            ) : (
              <form className="form" onSubmit={entrarConCodigo} noValidate>
                <p>
                  Te mandamos un mail a <strong>{email.trim()}</strong>. Abrilo y tocá el enlace para entrar.
                </p>
                <p className="small muted">Si el mail trae un código, también podés escribirlo acá (útil si tenés la app instalada en el celular).</p>
                <label htmlFor="codigo">Código del mail</label>
                <input id="codigo" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                <div className="pegar-act">
                  <button type="submit" className="act primario" disabled={ocupado}>
                    {ocupado ? 'Verificando…' : 'Entrar con el código'}
                  </button>
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setEnviado(false)
                      setCodigo('')
                      setError(null)
                    }}
                  >
                    Usar otro mail
                  </button>
                </div>
              </form>
            )
          ) : (
            <p className="vacio">
              El ingreso con mail se activa cuando se cargan las claves de Supabase (los pasos están en el archivo PENDIENTES.md del proyecto). Mientras tanto podés usar todo en modo de demostración.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="panel" aria-labelledby="h-probar">
          <h2 id="h-probar">Probar sin cuenta</h2>
          <p className="small muted">
            Entrás directo con una cartera de ejemplo. Lo que cambies se guarda solo en este navegador. {hayNube ? 'Las noticias y la cotización del dólar son las del día.' : 'Las noticias son una edición de ejemplo, marcada como tal.'}
          </p>
          <div>
            <button type="button" className="act" onClick={entrarDemo}>
              Probar sin cuenta
            </button>
          </div>
        </section>
      </div>

      <footer>Lámpara es una herramienta educativa. No es asesoramiento financiero ni una recomendación de inversión.</footer>
    </div>
  )
}
