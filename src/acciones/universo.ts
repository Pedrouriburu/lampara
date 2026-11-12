// Universo inicial de acciones (tabla `universo_acciones`).
// Las sensibilidades son aproximaciones por sector, NO estimadas con datos de cada empresa.
//   rp:    % de suba por cada 100 pb que BAJA el riesgo país
//   beta:  % por cada 1% del S&P 500
//   tasas: % por cada 100 pb que SUBEN las tasas de EE.UU.
//   oil:   elasticidad al Brent
//   dolar: % por cada 10% de devaluación del peso

export type Grupo = 'merval' | 'cedears'

export interface Accion {
  ticker: string
  nombre: string
  grupo: Grupo
  sector: string
  rp: number
  beta: number
  tasas: number
  oil: number
  dolar: number
}

const CSV = `GGAL,Grupo Financiero Galicia,merval,Bancos,11,0.5,0,0,-7
BMA,Banco Macro,merval,Bancos,10,0.5,0,0,-7
SUPV,Grupo Supervielle,merval,Bancos,13,0.6,0,0,-8
BBAR,BBVA Argentina,merval,Bancos,9,0.5,0,0,-6
YPFD,YPF,merval,Petróleo y gas,8,0.6,-1,0.45,-2
PAMP,Pampa Energía,merval,Energía,7,0.5,-1,0.25,-2
TGSU2,Transportadora de Gas del Sur,merval,Gas,7,0.5,-1,0.2,-1
CEPU,Central Puerto,merval,Generación eléctrica,7,0.4,-1,0.05,-4
EDN,Edenor,merval,Distribución eléctrica,12,0.3,-1,0,-9
TECO2,Telecom Argentina,merval,Telecomunicaciones,7,0.4,-1,0,-6
TXAR,Ternium Argentina,merval,Acero,4,0.7,-1,0,1
ALUA,Aluar,merval,Aluminio (exportadora),3,0.6,-1,0.05,3
LOMA,Loma Negra,merval,Cemento,8,0.4,-1,0,-5
CRES,Cresud,merval,Agro e inmuebles,6,0.4,-1,0,1
BYMA,Bolsas y Mercados Argentinos,merval,Mercado de capitales,9,0.4,0,0,-5
SPY,S&P 500 (ETF),cedears,Índice EE.UU.,0,1,-4,0,0
QQQ,Nasdaq 100 (ETF),cedears,Índice tecnológico,0,1.2,-7,0,0
AAPL,Apple,cedears,Tecnología,0,1.1,-5,0,0
MSFT,Microsoft,cedears,Tecnología,0,1.05,-5,0,0
NVDA,Nvidia,cedears,Semiconductores,0,1.6,-9,0,0
GOOGL,Alphabet,cedears,Tecnología,0,1.1,-5,0,0
AMZN,Amazon,cedears,Consumo y nube,0,1.2,-6,0,0
MELI,MercadoLibre,cedears,Comercio electrónico (región),2,1.3,-7,0,-1
JPM,JPMorgan,cedears,Bancos EE.UU.,0,1,3,0,0
BRKB,Berkshire Hathaway,cedears,Holding diversificado,0,0.85,0,0.05,0
KO,Coca-Cola,cedears,Consumo defensivo,0,0.6,-2,0,0
WMT,Walmart,cedears,Consumo defensivo,0,0.6,-2,0,0
JNJ,Johnson & Johnson,cedears,Salud,0,0.5,-2,0,0
XOM,ExxonMobil,cedears,Petróleo,0,0.8,-1,0.5,0
VIST,Vista Energy,cedears,Petróleo (Vaca Muerta),5,0.9,-2,0.7,0
GLD,Oro (ETF),cedears,Refugio,0,0.05,-4,0.1,0`

export const UNIVERSO_BASE: readonly Accion[] = CSV.split('\n').map((linea) => {
  const [ticker, nombre, grupo, sector, rp, beta, tasas, oil, dolar] = linea.split(',')
  return { ticker, nombre, grupo: grupo as Grupo, sector, rp: +rp, beta: +beta, tasas: +tasas, oil: +oil, dolar: +dolar }
})

export const copiaUniverso = (): Accion[] => UNIVERSO_BASE.map((a) => ({ ...a }))
export const nombreGrupo = (g: Grupo) => (g === 'merval' ? 'Merval' : 'CEDEARs')
