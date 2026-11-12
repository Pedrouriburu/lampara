// Números al azar reproducibles: misma semilla, misma simulación.

/** Generador uniforme en [0, 1) con semilla (mulberry32). */
export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normal estándar por Box-Muller; guarda el segundo valor de cada par. */
export function normalGen(rand: () => number): () => number {
  let repuesto: number | null = null
  return function () {
    if (repuesto !== null) {
      const s = repuesto
      repuesto = null
      return s
    }
    let u = 0
    while (u <= 1e-12) u = rand()
    const v = rand()
    const r = Math.sqrt(-2 * Math.log(u))
    repuesto = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }
}

/** Semilla siguiente para el botón "Nueva simulación". */
export const siguienteSemilla = (s: number) => (s * 48271 + 11) % 2147483647
