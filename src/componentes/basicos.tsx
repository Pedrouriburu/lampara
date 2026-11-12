// Piezas chicas de interfaz que se repiten en todas las pantallas.
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'

interface OpcionSeg<T> {
  valor: T
  texto: string
}

/** Botonera de opciones excluyentes (Pesos / Dólares, horizonte, grupo). */
export function Seg<T extends string | number>({ opciones, valor, onCambio, etiqueta }: { opciones: OpcionSeg<T>[]; valor: T; onCambio: (v: T) => void; etiqueta: string }) {
  return (
    <span className="seg" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button type="button" key={String(o.valor)} aria-pressed={o.valor === valor} onClick={() => onCambio(o.valor)}>
          {o.texto}
        </button>
      ))}
    </span>
  )
}

type PropsCampo = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  valor: number
  onCambio: (v: number) => void
}

/**
 * Campo numérico que no pelea con el usuario mientras escribe:
 * guarda el texto tal cual y solo avisa cuando hay un número válido.
 */
export function CampoNumero({ valor, onCambio, onBlur, onFocus, ...resto }: PropsCampo) {
  const [txt, setTxt] = useState(String(valor))
  const conFoco = useRef(false)
  useEffect(() => {
    if (!conFoco.current) setTxt(String(valor))
  }, [valor])
  return (
    <input
      type="number"
      inputMode="decimal"
      {...resto}
      value={txt}
      onFocus={(e) => {
        conFoco.current = true
        onFocus?.(e)
      }}
      onBlur={(e) => {
        conFoco.current = false
        setTxt(String(valor))
        onBlur?.(e)
      }}
      onChange={(e) => {
        setTxt(e.target.value)
        const v = parseFloat(e.target.value)
        if (Number.isFinite(v)) onCambio(v)
      }}
    />
  )
}

/** Barra que crece hacia la izquierda (pérdida) o la derecha (ganancia) desde el centro. */
export function BarraDivergente({ valor, maximo }: { valor: number; maximo: number }) {
  const w = Math.min(50, (Math.abs(valor) / (maximo || 1)) * 50)
  const neg = valor < 0
  return (
    <span className="dv" aria-hidden="true">
      <span style={{ [neg ? 'right' : 'left']: '50%', width: w.toFixed(1) + '%', background: `var(${neg ? '--loss' : '--gain'})` }} />
    </span>
  )
}

export const claseSigno = (x: number) => (x < 0 ? 'loss' : x > 0 ? 'gain' : '')

export function Chip({ ok, children, titulo }: { ok: boolean; children: ReactNode; titulo?: string }) {
  return (
    <span className={'chip ' + (ok ? 'ok' : 'alerta')} title={titulo}>
      {children}
    </span>
  )
}

/** Marca visible para todo dato que no es real. */
export function MarcaEjemplo({ children = 'Ejemplo' }: { children?: ReactNode }) {
  return <span className="tag ejemplo">{children}</span>
}

export const AVISO = 'Herramienta educativa. Los supuestos de rendimiento, volatilidad y crisis son aproximaciones ilustrativas, no pronósticos ni asesoramiento financiero.'
