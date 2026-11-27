-- Importación de los reportes de Inviu: tenencias y cuenta corriente.
--
-- Inviu no tiene API: el usuario baja dos Excel desde Reportes (Portfolio y Cuenta
-- corriente) y los sube a Lámpara. Estas tablas guardan lo que sale de esos archivos.
--
-- Todo es privado: cada usuario ve y escribe solo lo suyo (RLS más abajo).

-- Una fila por archivo subido, con los metadatos del encabezado.
create table if not exists public.importaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('tenencias', 'movimientos')),
  archivo text not null default '',
  cuenta text not null default '',
  -- Fecha de valuación (tenencias) o fin del rango pedido (movimientos).
  fecha date,
  -- Tipos de cambio que trae el propio archivo; con ellos los montos dan igual que en Inviu.
  tc_mep numeric check (tc_mep is null or tc_mep > 0),
  tc_ccl numeric check (tc_ccl is null or tc_ccl > 0),
  filas integer not null default 0 check (filas >= 0),
  subida timestamptz not null default now()
);

-- Foto de la cartera a una fecha. Volver a subir el mismo día reemplaza la foto.
create table if not exists public.tenencias (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null,
  ticker text not null,
  importacion_id uuid references public.importaciones (id) on delete set null,
  nombre text not null default '',
  -- "Acciones", "Cedear", "Moneda", "Titulos Publicos"... tal cual lo nombra Inviu.
  clase text not null default '',
  moneda text not null default 'ARS',
  cantidad numeric not null default 0,
  precio numeric not null default 0,
  -- Precio promedio de compra (PPC).
  costo numeric not null default 0,
  -- Calculados al importar, con las mismas fórmulas del Excel de Inviu.
  monto_ars numeric not null default 0,
  monto_usd numeric not null default 0,
  invertido_ars numeric not null default 0,
  resultado_ars numeric not null default 0,
  var_pct numeric not null default 0,
  primary key (user_id, fecha, ticker)
);

create index if not exists tenencias_por_fecha on public.tenencias (user_id, fecha desc);

-- Movimientos de la cuenta corriente. Se puede resubir un rango sin duplicar.
create table if not exists public.movimientos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Número de boleto o de recibo que trae la descripción.
  comprobante text not null,
  -- El mismo boleto aparece en la sección monetaria y en la de instrumentos.
  seccion text not null check (seccion in ('monetaria', 'instrumentos')),
  ticker text not null default '',
  importacion_id uuid references public.importaciones (id) on delete set null,
  concertacion date,
  liquidacion date,
  descripcion text not null default '',
  -- CPRA, VNTA, "Recibo de Cobro"...
  operacion text not null default '',
  moneda text not null default 'ARS',
  cantidad numeric,
  precio numeric,
  bruto numeric,
  neto numeric,
  saldo numeric,
  primary key (user_id, comprobante, seccion, ticker)
);

create index if not exists movimientos_por_fecha on public.movimientos (user_id, liquidacion desc);

alter table public.importaciones enable row level security;
alter table public.tenencias enable row level security;
alter table public.movimientos enable row level security;

drop policy if exists "importaciones: cada uno la suya" on public.importaciones;
create policy "importaciones: cada uno la suya" on public.importaciones
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "tenencias: cada uno la suya" on public.tenencias;
create policy "tenencias: cada uno la suya" on public.tenencias
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "movimientos: cada uno la suya" on public.movimientos;
create policy "movimientos: cada uno la suya" on public.movimientos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Nadie entra sin sesión.
revoke all on public.importaciones, public.tenencias, public.movimientos from anon;

-- El universo deja de ser una lista cerrada ------------------------------------
--
-- Una acción que el usuario tiene pero que no está calibrada se muestra igual, con
-- el perfil genérico de su grupo (la mediana del universo) y marcada como estimada,
-- para que la app pueda decirlo en pantalla en vez de hacerla pasar por medida.
alter table public.universo_acciones add column if not exists estimada boolean not null default false;

-- ASML, que es un CEDEAR que no estaba. Fabricante de equipos de litografía para
-- semiconductores: más cíclico que una tecnológica grande y menos que Nvidia, y
-- con la misma sensibilidad alta a las tasas que el resto del sector.
insert into public.universo_acciones (ticker, nombre, grupo, sector, rp, beta, tasas, oil, dolar, estimada)
values ('ASML', 'ASML Holding', 'cedears', 'Equipos para semiconductores', 0, 1.35, -8, 0, 0, false)
on conflict (ticker) do update set
  nombre = excluded.nombre, grupo = excluded.grupo, sector = excluded.sector,
  rp = excluded.rp, beta = excluded.beta, tasas = excluded.tasas, oil = excluded.oil,
  dolar = excluded.dolar, estimada = excluded.estimada;
