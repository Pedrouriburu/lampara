// Corre la migración de Supabase en un Postgres en memoria (PGlite) y prueba la seguridad por filas.
// `auth.users`, `auth.uid()` y los roles de Supabase se simulan con lo mínimo necesario.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { UNIVERSO_BASE } from '../acciones/universo'
import { RUBROS_BASE } from '../riesgo/supuestos'

// Todas las migraciones, en orden: así se prueba la cadena entera y no solo la primera.
const CARPETA = new URL('../../supabase/migrations/', import.meta.url)
const SQL = readdirSync(CARPETA)
  .filter((n) => n.endsWith('.sql'))
  .sort()
  .map((n) => readFileSync(new URL(n, CARPETA), 'utf8'))
  .join('\n;\n')
const ANA = '11111111-1111-1111-1111-111111111111'
const BETO = '22222222-2222-2222-2222-222222222222'

let db: PGlite

async function como(rol: 'anon' | 'authenticated' | 'service_role', usuario?: string) {
  await db.exec(`reset role; set request.jwt.claim.sub = '${usuario ?? ''}'; set role ${rol};`)
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema auth to anon, authenticated, service_role;
    insert into auth.users (id) values ('${ANA}'), ('${BETO}');
  `)
  await db.exec(SQL)
})

describe('migración de Supabase', () => {
  it('se puede correr dos veces sin romper nada', async () => {
    await db.exec('reset role')
    await db.exec(SQL)
    const r = await db.query<{ n: number }>('select count(*)::int as n from public.universo_acciones')
    expect(r.rows[0].n).toBe(UNIVERSO_BASE.length)
  })

  it('la carga inicial coincide con los supuestos del código', async () => {
    await db.exec('reset role')
    const rubros = await db.query<Record<string, string>>('select * from public.supuestos_rubros order by orden')
    expect(rubros.rows.map((r) => r.id)).toEqual(RUBROS_BASE.map((r) => r.id))
    for (const fila of rubros.rows) {
      const r = RUBROS_BASE.find((x) => x.id === fila.id)!
      expect([fila.nombre, fila.corto, +fila.ret, +fila.vol, +fila.beta_ar, +fila.beta_global, +fila.golpe_crisis]).toEqual([r.nombre, r.corto, r.ret, r.vol, r.betaAr, r.betaGlobal, r.golpeCrisis])
    }
    const acciones = await db.query<Record<string, string>>('select * from public.universo_acciones')
    expect(acciones.rows).toHaveLength(UNIVERSO_BASE.length)
    for (const a of UNIVERSO_BASE) {
      const f = acciones.rows.find((x) => x.ticker === a.ticker)!
      expect([f.nombre, f.grupo, f.sector, +f.rp, +f.beta, +f.tasas, +f.oil, +f.dolar]).toEqual([a.nombre, a.grupo, a.sector, a.rp, a.beta, a.tasas, a.oil, a.dolar])
    }
  })

  it('un usuario guarda y recupera su cartera, sus selecciones y sus corridas', async () => {
    await como('authenticated', ANA)
    const c = await db.query<{ id: string; user_id: string }>(
      `insert into public.carteras (total_usd, pct, moneda_vista) values (20000, '{"pesos":10,"cedears":90}', 'ARS') returning id, user_id`,
    )
    expect(c.rows[0].user_id).toBe(ANA)
    const id = c.rows[0].id
    await db.query(`insert into public.selecciones (cartera_id, grupo, pesos) values ($1, 'merval', '{"GGAL":100}')`, [id])
    await db.query(`insert into public.corridas (cartera_id, opciones, resultados) values ($1, '{"anios":3}', '{"var95":1290}')`, [id])
    await db.query(`update public.carteras set total_usd = 25000 where id = $1`, [id])

    const leida = await db.query<{ total_usd: string; pct: Record<string, number> }>('select total_usd, pct from public.carteras')
    expect(leida.rows).toHaveLength(1)
    expect(+leida.rows[0].total_usd).toBe(25000)
    expect(leida.rows[0].pct).toEqual({ pesos: 10, cedears: 90 })
    expect((await db.query('select * from public.selecciones')).rows).toHaveLength(1)
    expect((await db.query('select * from public.corridas')).rows).toHaveLength(1)
  })

  it('otro usuario no ve ni puede tocar la cartera ajena', async () => {
    await como('authenticated', BETO)
    expect((await db.query('select * from public.carteras')).rows).toHaveLength(0)
    expect((await db.query('select * from public.selecciones')).rows).toHaveLength(0)
    expect((await db.query('select * from public.corridas')).rows).toHaveLength(0)
    const upd = await db.query('update public.carteras set total_usd = 1')
    expect(upd.affectedRows).toBe(0)
    const del = await db.query('delete from public.carteras')
    expect(del.affectedRows).toBe(0)
    // No puede crear una cartera a nombre de otro ni colgar corridas de una cartera ajena.
    await expect(db.query(`insert into public.carteras (user_id, total_usd) values ('${ANA}', 5)`)).rejects.toThrow()
    await como('service_role')
    const ajena = (await db.query<{ id: string }>('select id from public.carteras')).rows[0].id
    await como('authenticated', BETO)
    await expect(db.query(`insert into public.corridas (cartera_id) values ($1)`, [ajena])).rejects.toThrow()
    // La cartera de Ana sigue intacta.
    await como('authenticated', ANA)
    expect(+(await db.query<{ total_usd: string }>('select total_usd from public.carteras')).rows[0].total_usd).toBe(25000)
  })

  it('sin cuenta no se ven carteras, pero sí las ediciones, cotizaciones y tablas de referencia', async () => {
    await como('service_role')
    await db.exec(`
      insert into public.ediciones (fecha, panorama) values ('2026-11-12', 'Edición de prueba');
      insert into public.cotizaciones (fecha, mep, fuente) values ('2026-11-12', 1500, 'prueba');
    `)
    await como('anon')
    await expect(db.query('select * from public.carteras')).rejects.toThrow()
    expect((await db.query('select * from public.ediciones')).rows).toHaveLength(1)
    expect((await db.query('select * from public.cotizaciones')).rows).toHaveLength(1)
    expect((await db.query('select * from public.supuestos_rubros')).rows).toHaveLength(7)
    expect((await db.query('select * from public.universo_acciones')).rows).toHaveLength(32)
  })

  it('solo la clave de servicio escribe ediciones, cotizaciones y tablas de referencia', async () => {
    for (const rol of ['anon', 'authenticated'] as const) {
      await como(rol, rol === 'authenticated' ? ANA : undefined)
      await expect(db.query(`insert into public.ediciones (fecha) values ('2026-11-13')`)).rejects.toThrow()
      await expect(db.query(`update public.cotizaciones set mep = 1`)).rejects.toThrow()
      await expect(db.query(`delete from public.universo_acciones`)).rejects.toThrow()
      await expect(db.query(`update public.supuestos_rubros set ret = 9`)).rejects.toThrow()
      await expect(db.query(`select * from public.uso_explicar`)).rejects.toThrow()
    }
    await como('service_role')
    // El agente reemplaza la edición del día y borra las viejas.
    await db.exec(`
      insert into public.ediciones (fecha, panorama) values ('2026-11-12', 'Reemplazada')
        on conflict (fecha) do update set panorama = excluded.panorama;
      insert into public.ediciones (fecha, panorama) values ('2026-08-01', 'Vieja');
      delete from public.ediciones where fecha < date '2026-11-12' - 60;
    `)
    const e = await db.query<{ panorama: string }>('select panorama from public.ediciones')
    expect(e.rows.map((x) => x.panorama)).toEqual(['Reemplazada'])
  })

  it('al borrar un usuario se borran su cartera, sus selecciones y sus corridas', async () => {
    await db.exec('reset role')
    await db.exec(`delete from auth.users where id = '${ANA}'`)
    expect((await db.query('select * from public.carteras')).rows).toHaveLength(0)
    expect((await db.query('select * from public.selecciones')).rows).toHaveLength(0)
    expect((await db.query('select * from public.corridas')).rows).toHaveLength(0)
  })
})
