// Portales que el agente puede leer. La búsqueda web se limita a estos dominios
// y toda URL de la edición tiene que pertenecer a alguno de ellos.
// `pago: true` = solo titulares y resúmenes; las cifras salen de páginas abiertas.

export const PORTALES = [
  // --- Argentina ---
  { nombre: 'Infobae', dominio: 'infobae.com', ambito: 'Argentina', pago: false },
  { nombre: 'La Nación', dominio: 'lanacion.com.ar', ambito: 'Argentina', pago: false },
  { nombre: 'Clarín', dominio: 'clarin.com', ambito: 'Argentina', pago: false },
  { nombre: 'El Cronista', dominio: 'cronista.com', ambito: 'Argentina', pago: false },
  { nombre: 'Ámbito', dominio: 'ambito.com', ambito: 'Argentina', pago: false },
  { nombre: 'iProfesional', dominio: 'iprofesional.com', ambito: 'Argentina', pago: false },
  { nombre: 'Perfil', dominio: 'perfil.com', ambito: 'Argentina', pago: false },
  { nombre: 'BAE Negocios', dominio: 'baenegocios.com', ambito: 'Argentina', pago: false },
  { nombre: 'El Economista', dominio: 'eleconomista.com.ar', ambito: 'Argentina', pago: false },
  { nombre: 'Bloomberg Línea', dominio: 'bloomberglinea.com', ambito: 'Argentina', pago: false },
  { nombre: 'Rava Bursátil', dominio: 'rava.com', ambito: 'Argentina', pago: false },
  { nombre: 'BCRA', dominio: 'bcra.gob.ar', ambito: 'Argentina', pago: false },
  { nombre: 'INDEC', dominio: 'indec.gob.ar', ambito: 'Argentina', pago: false },
  { nombre: 'Ministerio de Economía', dominio: 'argentina.gob.ar', ambito: 'Argentina', pago: false },
  // --- Mundo ---
  { nombre: 'Reuters', dominio: 'reuters.com', ambito: 'Mundo', pago: false },
  { nombre: 'Bloomberg', dominio: 'bloomberg.com', ambito: 'Mundo', pago: true },
  { nombre: 'Financial Times', dominio: 'ft.com', ambito: 'Mundo', pago: true },
  { nombre: 'The Wall Street Journal', dominio: 'wsj.com', ambito: 'Mundo', pago: true },
  { nombre: 'CNBC', dominio: 'cnbc.com', ambito: 'Mundo', pago: false },
  { nombre: 'Associated Press', dominio: 'apnews.com', ambito: 'Mundo', pago: false },
  { nombre: 'MarketWatch', dominio: 'marketwatch.com', ambito: 'Mundo', pago: false },
  { nombre: 'FXStreet en español', dominio: 'fxstreet.es', ambito: 'Mundo', pago: false },
  { nombre: 'Investing.com en español', dominio: 'es.investing.com', ambito: 'Mundo', pago: false },
  { nombre: 'The Rio Times', dominio: 'riotimesonline.com', ambito: 'Mundo', pago: false },
  { nombre: 'Reserva Federal', dominio: 'federalreserve.gov', ambito: 'Mundo', pago: false },
  { nombre: 'Oficina de Estadísticas Laborales de EE.UU.', dominio: 'bls.gov', ambito: 'Mundo', pago: false },
]

export const DOMINIOS = PORTALES.map((p) => p.dominio)

/** Portal al que pertenece una URL https, o null si no es de un portal permitido. */
export function portalDe(url) {
  let u
  try {
    u = new URL(String(url))
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase()
  // Coincidencia exacta o subdominio: "bloomberglinea.com" no cuenta como "bloomberg.com".
  return PORTALES.find((p) => host === p.dominio || host.endsWith('.' + p.dominio)) ?? null
}
