// Escenarios a uno a tres meses. Si no hay edición del agente se usan los de respaldo.

export interface EscenarioAcciones {
  id: string
  nombre: string
  /** Probabilidad en puntos (0 a 100). */
  prob: number
  /** Riesgo país, en puntos básicos. */
  riesgoPais: number
  /** S&P 500, en %. */
  spx: number
  /** Tasas de EE.UU., en puntos básicos. */
  tasas: number
  /** Brent, en %. */
  petroleo: number
  /** Devaluación del peso, en %. */
  dolar: number
  descripcion: string
  senales: string[]
}

/** Escenarios de respaldo (ejemplo). La interfaz los marca como ejemplo. */
export const ESCENARIOS_RESPALDO: readonly EscenarioAcciones[] = [
  {
    id: 'base',
    nombre: 'Sigue la tensión',
    prob: 35,
    riesgoPais: 50,
    spx: -2,
    tasas: 25,
    petroleo: 0,
    dolar: 4,
    descripcion: 'El riesgo país se mantiene alto, la Fed sube 0,25 y el dólar oficial se desliza.',
    senales: ['Riesgo país sin bajar varias semanas', 'La Fed sube 0,25 en su próxima reunión'],
  },
  {
    id: 'calma',
    nombre: 'Se calma el riesgo país',
    prob: 25,
    riesgoPais: -200,
    spx: 3,
    tasas: 25,
    petroleo: -5,
    dolar: 2,
    descripcion: 'Aparece financiamiento para los vencimientos o vuelve la compra de reservas, y el riesgo país baja.',
    senales: ['El BCRA vuelve a comprar dólares', 'Acuerdo de financiamiento o recompra de deuda'],
  },
  {
    id: 'salto',
    nombre: 'Salto cambiario',
    prob: 15,
    riesgoPais: 250,
    spx: -2,
    tasas: 25,
    petroleo: 0,
    dolar: 15,
    descripcion: 'Sin compras de reservas y con la brecha en aumento, el Gobierno corrige el tipo de cambio de golpe.',
    senales: ['Brecha con el CCL por encima de 15%', 'Reservas cayendo varias semanas seguidas'],
  },
  {
    id: 'fed',
    nombre: 'Fed más dura',
    prob: 15,
    riesgoPais: 100,
    spx: -8,
    tasas: 60,
    petroleo: -5,
    dolar: 5,
    descripcion: 'La inflación de EE.UU. sigue alta, la Fed sube 0,50 y anticipa más subas; caen las tecnológicas y los emergentes.',
    senales: ['Inflación mensual de EE.UU. de 0,4% o más', 'Bono del Tesoro a 2 años en alza'],
  },
  {
    id: 'iran',
    nombre: 'Vuelve la tensión con Irán',
    prob: 10,
    riesgoPais: 50,
    spx: -5,
    tasas: 15,
    petroleo: 20,
    dolar: 3,
    descripcion: 'Se reaviva el conflicto en Medio Oriente y el Brent salta.',
    senales: ['Brent en fuerte suba', 'Amenazas sobre el estrecho de Ormuz'],
  },
]
