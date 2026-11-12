// Abanico de proyección: percentiles 5-95 y 25-75 del valor de la cartera, y la mediana.
import { useEffect, useRef, useState } from 'react'
import type { ResultadoSimulacion } from '../riesgo'
import { compacto, type FormatoMoneda } from '../util/formato'

function ticksLindos(min: number, max: number, n: number): number[] {
  const paso0 = (max - min) / n
  if (!(paso0 > 0)) return [min]
  const mag = Math.pow(10, Math.floor(Math.log10(paso0)))
  const f = paso0 / mag
  const paso = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(v)
  return out
}

export function Abanico({ r, fm, anios }: { r: ResultadoSimulacion; fm: FormatoMoneda; anios: number }) {
  const cont = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(600)

  useEffect(() => {
    const el = cont.current
    if (!el) return
    const medir = () => {
      const w = el.clientWidth
      if (w > 0) setAncho((a) => (Math.abs(w - a) > 8 ? w : a))
    }
    medir()
    window.addEventListener('resize', medir)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    ro?.observe(el)
    return () => {
      window.removeEventListener('resize', medir)
      ro?.disconnect()
    }
  }, [])

  const W = Math.max(300, ancho)
  const estrecho = W < 520
  const H = estrecho ? 260 : 320
  const mL = estrecho ? 52 : 66
  const mR = estrecho ? 70 : 92
  const mT = 14
  const mB = 30
  const k = fm.k
  const t0 = r.total0 * k
  const b = r.bandas.map((x) => ({ p5: x.p5 * k, p25: x.p25 * k, p50: x.p50 * k, p75: x.p75 * k, p95: x.p95 * k }))
  const n = b.length - 1
  let lo = Math.min(...b.map((x) => x.p5), t0)
  let hi = Math.max(...b.map((x) => x.p95), t0)
  const pad = (hi - lo) * 0.06 || hi * 0.05 || 1
  lo = Math.max(0, lo - pad)
  hi += pad
  const X = (t: number) => mL + (t / (n || 1)) * (W - mL - mR)
  const Y = (v: number) => mT + (1 - (v - lo) / (hi - lo)) * (H - mT - mB)
  type Clave = keyof (typeof b)[number]
  const punto = (t: number, c: Clave) => `${X(t).toFixed(1)},${Y(b[t][c]).toFixed(1)}`
  const area = (arriba: Clave, abajo: Clave) =>
    'M' + b.map((_, t) => punto(t, arriba)).join('L') + 'L' + b.map((_, t) => punto(n - t, abajo)).join('L') + 'Z'
  const linea = (c: Clave) => 'M' + b.map((_, t) => punto(t, c)).join('L')
  const yt = ticksLindos(lo, hi, estrecho ? 4 : 5)
  const fin = b[n]
  const etiquetas = (
    [
      ['p95', 'P95'],
      ['p50', 'Mediana'],
      ['p5', 'P5'],
    ] as [Clave, string][]
  ).map(([c, nm]) => ({ c, nm, y: Y(fin[c]), v: fin[c] }))
  // Separa las etiquetas del final para que no se pisen.
  for (let i = 1; i < etiquetas.length; i++) if (etiquetas[i].y - etiquetas[i - 1].y < 26) etiquetas[i].y = etiquetas[i - 1].y + 26
  const aniosEje = Array.from({ length: Math.floor(n / 12) + 1 }, (_, a) => a)

  return (
    <div
      id="fan"
      ref={cont}
      role="img"
      aria-label={`Abanico de valores proyectados: mediana ${compacto(fin.p50)}, percentil 5 ${compacto(fin.p5)}, percentil 95 ${compacto(fin.p95)} en ${anios} ${anios === 1 ? 'año' : 'años'}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        {yt.map((v) => (
          <g key={v}>
            <line x1={mL} x2={W - mR} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" />
            <text x={mL - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {compacto(v)}
            </text>
          </g>
        ))}
        {aniosEje.map((a) => (
          <g key={a}>
            <text x={X(a * 12)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {a === 0 ? 'Hoy' : 'Año ' + a}
            </text>
            <line x1={X(a * 12)} x2={X(a * 12)} y1={H - mB} y2={H - mB + 4} stroke="var(--muted)" />
          </g>
        ))}
        <path d={area('p95', 'p5')} fill="var(--accent-soft)" />
        <path d={area('p75', 'p25')} fill="var(--accent-mid)" />
        <line x1={mL} x2={W - mR} y1={Y(t0)} y2={Y(t0)} stroke="var(--ink)" strokeDasharray="4 4" strokeWidth="1" />
        <text x={mL + 6} y={Y(t0) + 15} fontSize="11" fill="var(--ink)">
          Invertido: {fm.monto(r.total0)}
        </text>
        <path d={linea('p50')} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        {etiquetas.map((e) => {
          const medio = e.c === 'p50'
          return (
            <g key={e.c}>
              <circle cx={X(n)} cy={Y(fin[e.c])} r={medio ? 4 : 3} fill={medio ? 'var(--accent)' : 'var(--muted)'} />
              <text x={X(n) + 8} y={e.y - 2} fontSize="10.5" fill="var(--muted)">
                {e.nm}
              </text>
              <text x={X(n) + 8} y={e.y + 11} fontSize="11.5" fill={medio ? 'var(--ink)' : 'var(--muted)'} fontWeight={medio ? 600 : 400}>
                {compacto(e.v)}
              </text>
            </g>
          )
        })}
        <line x1={mL} x2={W - mR} y1={H - mB} y2={H - mB} stroke="var(--muted)" />
      </svg>
    </div>
  )
}
