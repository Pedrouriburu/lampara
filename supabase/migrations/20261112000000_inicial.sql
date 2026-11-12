-- Lámpara · esquema inicial
-- ---------------------------------------------------------------------------
-- Cómo aplicarlo sin programar: panel de Supabase > SQL Editor > New query,
-- pegar TODO este archivo y apretar "Run". Se puede correr más de una vez:
-- no borra datos y vuelve a dejar los supuestos y el universo en sus valores
-- iniciales.
--
-- Quién puede qué (Row Level Security):
--   · carteras, selecciones, corridas: cada usuario lee y escribe solo lo suyo.
--   · cotizaciones, ediciones, universo_acciones, supuestos_rubros: lectura
--     pública; escribe solo la clave de servicio (la que usa el agente).
--   · uso_explicar: solo la clave de servicio (cuenta las consultas a Claude).

-- ============================ Tablas del usuario ============================

create table if not exists public.carteras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null default 'Mi cartera',
  -- El monto total se guarda siempre en dólares.
  total_usd numeric not null default 0 check (total_usd >= 0),
  -- Porcentaje por rubro: {"pesos": 10, "mep": 15, ...}
  pct jsonb not null default '{}'::jsonb,
  moneda_vista text not null default 'ARS' check (moneda_vista in ('ARS', 'USD')),
  -- Horizonte, crisis, semilla, MEP cargado a mano y supuestos editados por el usuario.
  opciones jsonb not null default '{}'::jsonb,
  actualizada timestamptz not null default now(),
  unique (user_id, nombre)
);

create table if not exists public.selecciones (
  cartera_id uuid not null references public.carteras (id) on delete cascade,
  grupo text not null check (grupo in ('merval', 'cedears')),
  -- Porcentaje por ticker dentro del rubro: {"GGAL": 30, "YPFD": 40, ...}
  pesos jsonb not null default '{}'::jsonb,
  primary key (cartera_id, grupo)
);

create table if not exists public.corridas (
  id uuid primary key default gen_random_uuid(),
  cartera_id uuid not null references public.carteras (id) on delete cascade,
  fecha timestamptz not null default now(),
  opciones jsonb not null default '{}'::jsonb,
  resultados jsonb not null default '{}'::jsonb
);
create index if not exists corridas_cartera_fecha on public.corridas (cartera_id, fecha desc);

-- ============================ Tablas del agente =============================

create table if not exists public.cotizaciones (
  fecha date primary key,
  mep numeric,
  ccl numeric,
  oficial numeric,
  riesgo_pais numeric,
  fuente text,
  actualizada timestamptz not null default now()
);

create table if not exists public.ediciones (
  fecha date primary key,
  generada timestamptz not null default now(),
  panorama text not null default '',
  escenario jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  escenarios_acciones jsonb not null default '[]'::jsonb,
  fuentes jsonb not null default '[]'::jsonb
);

-- ============================ Tablas de referencia ==========================

create table if not exists public.universo_acciones (
  ticker text primary key,
  nombre text not null,
  grupo text not null check (grupo in ('merval', 'cedears')),
  sector text not null,
  rp numeric not null,
  beta numeric not null,
  tasas numeric not null,
  oil numeric not null,
  dolar numeric not null
);

create table if not exists public.supuestos_rubros (
  id text primary key,
  nombre text not null,
  corto text not null,
  ret numeric not null,
  vol numeric not null check (vol >= 0),
  beta_ar numeric not null,
  beta_global numeric not null,
  golpe_crisis numeric not null,
  orden int not null default 0,
  -- beta_ar² + beta_global² no puede superar 1 (si no, la correlación implícita pasa de 1).
  check (beta_ar * beta_ar + beta_global * beta_global <= 1)
);

create table if not exists public.uso_explicar (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  cantidad int not null default 0,
  primary key (user_id, dia)
);

-- ============================ Row Level Security ============================

alter table public.carteras enable row level security;
alter table public.selecciones enable row level security;
alter table public.corridas enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.ediciones enable row level security;
alter table public.universo_acciones enable row level security;
alter table public.supuestos_rubros enable row level security;
alter table public.uso_explicar enable row level security;

drop policy if exists "carteras: cada uno la suya" on public.carteras;
create policy "carteras: cada uno la suya" on public.carteras
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "selecciones: de mis carteras" on public.selecciones;
create policy "selecciones: de mis carteras" on public.selecciones
  for all to authenticated
  using (exists (select 1 from public.carteras c where c.id = cartera_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carteras c where c.id = cartera_id and c.user_id = (select auth.uid())));

drop policy if exists "corridas: de mis carteras" on public.corridas;
create policy "corridas: de mis carteras" on public.corridas
  for all to authenticated
  using (exists (select 1 from public.carteras c where c.id = cartera_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carteras c where c.id = cartera_id and c.user_id = (select auth.uid())));

drop policy if exists "cotizaciones: lectura pública" on public.cotizaciones;
create policy "cotizaciones: lectura pública" on public.cotizaciones for select to anon, authenticated using (true);

drop policy if exists "ediciones: lectura pública" on public.ediciones;
create policy "ediciones: lectura pública" on public.ediciones for select to anon, authenticated using (true);

drop policy if exists "universo: lectura pública" on public.universo_acciones;
create policy "universo: lectura pública" on public.universo_acciones for select to anon, authenticated using (true);

drop policy if exists "supuestos: lectura pública" on public.supuestos_rubros;
create policy "supuestos: lectura pública" on public.supuestos_rubros for select to anon, authenticated using (true);

-- uso_explicar no tiene políticas a propósito: solo entra la clave de servicio.

-- Permisos explícitos (RLS decide las filas; esto decide las operaciones).
grant usage on schema public to anon, authenticated, service_role;
grant select on public.cotizaciones, public.ediciones, public.universo_acciones, public.supuestos_rubros to anon, authenticated;
grant select, insert, update, delete on public.carteras, public.selecciones, public.corridas to authenticated;
revoke all on public.carteras, public.selecciones, public.corridas, public.uso_explicar from anon;
revoke insert, update, delete, truncate on public.cotizaciones, public.ediciones, public.universo_acciones, public.supuestos_rubros from anon, authenticated;
revoke all on public.uso_explicar from authenticated;
grant all on public.carteras, public.selecciones, public.corridas, public.cotizaciones, public.ediciones, public.universo_acciones, public.supuestos_rubros, public.uso_explicar to service_role;

-- ============================ Carga inicial =================================
-- Supuestos de los rubros (aproximaciones ilustrativas, no pronósticos).

insert into public.supuestos_rubros (id, nombre, corto, ret, vol, beta_ar, beta_global, golpe_crisis, orden) values
  ('pesos',     'Pesos (plazo fijo / caución)',        'Pesos',     0.04, 0.28, 0.60, 0.10, -0.45, 1),
  ('mep',       'Dólar MEP / billete',                 'Dólares',   0.00, 0.01, 0.00, 0.00,  0.00, 2),
  ('soberanos', 'Bonos soberanos en USD (AL30, GD30)', 'Soberanos', 0.11, 0.24, 0.85, 0.20, -0.45, 3),
  ('ons',       'Obligaciones negociables en USD',     'ONs',       0.07, 0.09, 0.60, 0.30, -0.15, 4),
  ('cer',       'Bonos CER (pesos ajustados)',         'Bonos CER', 0.06, 0.22, 0.70, 0.10, -0.40, 5),
  ('merval',    'Acciones argentinas (Merval)',        'Merval',    0.12, 0.42, 0.80, 0.30, -0.50, 6),
  ('cedears',   'CEDEARs (S&P 500)',                   'CEDEARs',   0.08, 0.17, 0.10, 0.95, -0.05, 7)
on conflict (id) do update set
  nombre = excluded.nombre, corto = excluded.corto, ret = excluded.ret, vol = excluded.vol,
  beta_ar = excluded.beta_ar, beta_global = excluded.beta_global, golpe_crisis = excluded.golpe_crisis, orden = excluded.orden;

-- Universo de acciones. Sensibilidades aproximadas por sector, no estimadas con datos de cada empresa.
insert into public.universo_acciones (ticker, nombre, grupo, sector, rp, beta, tasas, oil, dolar) values
  ('GGAL',  'Grupo Financiero Galicia',      'merval',  'Bancos',                        11, 0.5,   0, 0,    -7),
  ('BMA',   'Banco Macro',                   'merval',  'Bancos',                        10, 0.5,   0, 0,    -7),
  ('SUPV',  'Grupo Supervielle',             'merval',  'Bancos',                        13, 0.6,   0, 0,    -8),
  ('BBAR',  'BBVA Argentina',                'merval',  'Bancos',                         9, 0.5,   0, 0,    -6),
  ('YPFD',  'YPF',                           'merval',  'Petróleo y gas',                 8, 0.6,  -1, 0.45, -2),
  ('PAMP',  'Pampa Energía',                 'merval',  'Energía',                        7, 0.5,  -1, 0.25, -2),
  ('TGSU2', 'Transportadora de Gas del Sur', 'merval',  'Gas',                            7, 0.5,  -1, 0.2,  -1),
  ('CEPU',  'Central Puerto',                'merval',  'Generación eléctrica',           7, 0.4,  -1, 0.05, -4),
  ('EDN',   'Edenor',                        'merval',  'Distribución eléctrica',        12, 0.3,  -1, 0,    -9),
  ('TECO2', 'Telecom Argentina',             'merval',  'Telecomunicaciones',             7, 0.4,  -1, 0,    -6),
  ('TXAR',  'Ternium Argentina',             'merval',  'Acero',                          4, 0.7,  -1, 0,     1),
  ('ALUA',  'Aluar',                         'merval',  'Aluminio (exportadora)',         3, 0.6,  -1, 0.05,  3),
  ('LOMA',  'Loma Negra',                    'merval',  'Cemento',                        8, 0.4,  -1, 0,    -5),
  ('CRES',  'Cresud',                        'merval',  'Agro e inmuebles',               6, 0.4,  -1, 0,     1),
  ('BYMA',  'Bolsas y Mercados Argentinos',  'merval',  'Mercado de capitales',           9, 0.4,   0, 0,    -5),
  ('SPY',   'S&P 500 (ETF)',                 'cedears', 'Índice EE.UU.',                  0, 1,    -4, 0,     0),
  ('QQQ',   'Nasdaq 100 (ETF)',              'cedears', 'Índice tecnológico',             0, 1.2,  -7, 0,     0),
  ('AAPL',  'Apple',                         'cedears', 'Tecnología',                     0, 1.1,  -5, 0,     0),
  ('MSFT',  'Microsoft',                     'cedears', 'Tecnología',                     0, 1.05, -5, 0,     0),
  ('NVDA',  'Nvidia',                        'cedears', 'Semiconductores',                0, 1.6,  -9, 0,     0),
  ('GOOGL', 'Alphabet',                      'cedears', 'Tecnología',                     0, 1.1,  -5, 0,     0),
  ('AMZN',  'Amazon',                        'cedears', 'Consumo y nube',                 0, 1.2,  -6, 0,     0),
  ('MELI',  'MercadoLibre',                  'cedears', 'Comercio electrónico (región)',  2, 1.3,  -7, 0,    -1),
  ('JPM',   'JPMorgan',                      'cedears', 'Bancos EE.UU.',                  0, 1,     3, 0,     0),
  ('BRKB',  'Berkshire Hathaway',            'cedears', 'Holding diversificado',          0, 0.85,  0, 0.05,  0),
  ('KO',    'Coca-Cola',                     'cedears', 'Consumo defensivo',              0, 0.6,  -2, 0,     0),
  ('WMT',   'Walmart',                       'cedears', 'Consumo defensivo',              0, 0.6,  -2, 0,     0),
  ('JNJ',   'Johnson & Johnson',             'cedears', 'Salud',                          0, 0.5,  -2, 0,     0),
  ('XOM',   'ExxonMobil',                    'cedears', 'Petróleo',                       0, 0.8,  -1, 0.5,   0),
  ('VIST',  'Vista Energy',                  'cedears', 'Petróleo (Vaca Muerta)',         5, 0.9,  -2, 0.7,   0),
  ('GLD',   'Oro (ETF)',                     'cedears', 'Refugio',                        0, 0.05, -4, 0.1,   0)
on conflict (ticker) do update set
  nombre = excluded.nombre, grupo = excluded.grupo, sector = excluded.sector, rp = excluded.rp,
  beta = excluded.beta, tasas = excluded.tasas, oil = excluded.oil, dolar = excluded.dolar;
