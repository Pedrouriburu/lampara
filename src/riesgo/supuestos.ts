// Supuestos iniciales del modelo. Son aproximaciones ilustrativas, no pronósticos.
// La misma tabla se carga en Supabase (`supuestos_rubros`) y se puede editar en la app.
import type { EscenarioHistorico, Montos, Rubro, RubroId } from './tipos'

export const RUBRO_IDS: RubroId[] = ['pesos', 'mep', 'soberanos', 'ons', 'cer', 'merval', 'cedears']

export const RUBROS_BASE: readonly Rubro[] = [
  { id: 'pesos', nombre: 'Pesos (plazo fijo / caución)', corto: 'Pesos', ret: 0.04, vol: 0.28, betaAr: 0.6, betaGlobal: 0.1, golpeCrisis: -0.45 },
  { id: 'mep', nombre: 'Dólar MEP / billete', corto: 'Dólares', ret: 0.0, vol: 0.01, betaAr: 0.0, betaGlobal: 0.0, golpeCrisis: 0.0 },
  { id: 'soberanos', nombre: 'Bonos soberanos en USD (AL30, GD30)', corto: 'Soberanos', ret: 0.11, vol: 0.24, betaAr: 0.85, betaGlobal: 0.2, golpeCrisis: -0.45 },
  { id: 'ons', nombre: 'Obligaciones negociables en USD', corto: 'ONs', ret: 0.07, vol: 0.09, betaAr: 0.6, betaGlobal: 0.3, golpeCrisis: -0.15 },
  { id: 'cer', nombre: 'Bonos CER (pesos ajustados)', corto: 'Bonos CER', ret: 0.06, vol: 0.22, betaAr: 0.7, betaGlobal: 0.1, golpeCrisis: -0.4 },
  { id: 'merval', nombre: 'Acciones argentinas (Merval)', corto: 'Merval', ret: 0.12, vol: 0.42, betaAr: 0.8, betaGlobal: 0.3, golpeCrisis: -0.5 },
  { id: 'cedears', nombre: 'CEDEARs (S&P 500)', corto: 'CEDEARs', ret: 0.08, vol: 0.17, betaAr: 0.1, betaGlobal: 0.95, golpeCrisis: -0.05 },
]

export const copiaRubros = (): Rubro[] => RUBROS_BASE.map((r) => ({ ...r }))

/** Cartera de ejemplo, en dólares. La interfaz la marca como ejemplo. */
export const CARTERA_EJEMPLO: Montos = { pesos: 2000, mep: 3000, soberanos: 4000, ons: 3000, cer: 1000, merval: 2000, cedears: 5000 }

/**
 * Dólar MEP de referencia: cierre de $ 1.584,76 del 4/11/2026 (Rava Bursátil).
 * Solo se usa hasta que llega la cotización del día o el usuario carga la suya.
 */
export const MEP_REFERENCIA = 1585
export const MEP_REFERENCIA_NOTA = 'cierre de $ 1.584,76 del 4/11/2026, Rava Bursátil'

/** Variaciones aproximadas en dólares de cada rubro en episodios históricos. */
export const ESCENARIOS_HISTORICOS: readonly EscenarioHistorico[] = [
  {
    id: 'paso2019',
    nombre: 'PASO 2019',
    desc: 'Sorpresa electoral de agosto de 2019: salto del dólar y desplome de bonos y acciones en días.',
    shocks: { pesos: -0.2, mep: 0, soberanos: -0.45, ons: -0.15, cer: -0.35, merval: -0.55, cedears: 0.0 },
  },
  {
    id: 'corrida2018',
    nombre: 'Corrida cambiaria 2018',
    desc: 'Abril a septiembre de 2018: el peso pierde la mitad de su valor y vuelve el FMI.',
    shocks: { pesos: -0.5, mep: 0, soberanos: -0.2, ons: -0.1, cer: -0.35, merval: -0.5, cedears: 0.05 },
  },
  {
    id: 'crisis2001',
    nombre: 'Default y devaluación 2001-02',
    desc: 'Fin de la convertibilidad, default de la deuda y corralito. Los dólares dentro de bancos fueron pesificados; acá se asume dólar fuera del sistema.',
    shocks: { pesos: -0.7, mep: 0, soberanos: -0.7, ons: -0.4, cer: -0.6, merval: -0.6, cedears: -0.15 },
  },
  {
    id: 'global2008',
    nombre: 'Crisis global 2008',
    desc: 'Quiebra de Lehman: caen las bolsas del mundo y el riesgo emergente.',
    shocks: { pesos: -0.1, mep: 0, soberanos: -0.5, ons: -0.25, cer: -0.4, merval: -0.55, cedears: -0.45 },
  },
  {
    id: 'tasas2022',
    nombre: 'Suba de tasas en EE.UU. 2022',
    desc: 'La Reserva Federal sube tasas con rapidez; caen acciones y bonos globales.',
    shocks: { pesos: -0.1, mep: 0, soberanos: -0.15, ons: -0.08, cer: -0.1, merval: -0.05, cedears: -0.2 },
  },
  {
    id: 'rally2024',
    nombre: 'Normalización 2023-24',
    desc: 'Episodio favorable: baja el riesgo país, suben bonos y acciones locales.',
    shocks: { pesos: -0.05, mep: 0, soberanos: 0.8, ons: 0.1, cer: 0.2, merval: 1.0, cedears: 0.2 },
  },
]
