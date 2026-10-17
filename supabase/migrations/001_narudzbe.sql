-- =====================================================================
-- Vinum Academicum – sustav narudžbi (Supabase PostgreSQL)
-- Pokrenite cijelu datoteku u Supabase > SQL Editor (ili `supabase db push`).
-- =====================================================================

-- ---------- Proizvodi (JEDINI izvor istine za nazive i cijene) ----------
create table if not exists public.products (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null,
  price       numeric(10,2) check (price is null or price >= 0),   -- NULL = cijena se dogovara u ponudi
  currency    text not null default 'EUR',
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Administratori (samo oni koje ručno dodate) ----------
create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Narudžbe ----------
create sequence if not exists public.order_number_seq start 1;

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null unique default (
                        'VA-' || to_char(now() at time zone 'Europe/Zagreb', 'YYYY') || '-' ||
                        lpad(nextval('public.order_number_seq')::text, 5, '0')),
  idempotency_key     text unique,
  customer_type       text not null check (customer_type in ('individual','company')),
  first_name          text,
  last_name           text,
  company_name        text,
  oib                 text,
  street_address      text,
  postal_code         text,
  city                text,
  contact_first_name  text,
  contact_last_name   text,
  email               text not null,
  phone               text not null,
  pickup_method       text not null check (pickup_method in ('ftrr','delivery')),
  customer_note       text,
  status              text not null default 'pending'
                        check (status in ('pending','contacted','confirmed','rejected','completed')),
  total_amount        numeric(10,2),
  currency            text not null default 'EUR',
  admin_note          text,
  final_message       text,           -- poruka kupcu uz potvrdu
  rejection_reason    text,           -- poruka kupcu uz odbijanje
  gdpr_consent        boolean not null default false,
  gdpr_consent_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  contacted_at        timestamptz,
  confirmed_at        timestamptz,
  confirmed_by        uuid references auth.users(id) on delete set null,
  rejected_at         timestamptz,
  fulfilled_at        timestamptz,
  constraint orders_individual_chk check (customer_type <> 'individual' or (first_name is not null and last_name is not null)),
  constraint orders_company_chk check (customer_type <> 'company' or (
      company_name is not null and oib ~ '^[0-9]{11}$' and street_address is not null and postal_code is not null
      and city is not null and contact_first_name is not null and contact_last_name is not null))
);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    text references public.products(id) on delete set null,
  product_name  text not null,
  quantity      int  not null check (quantity between 1 and 1200),
  unit_price    numeric(10,2) check (unit_price is null or unit_price >= 0),
  line_total    numeric(10,2) generated always as (case when unit_price is null then null else round(quantity * unit_price, 2) end) stored
);

create table if not exists public.order_status_history (
  id               bigint generated always as identity primary key,
  order_id         uuid not null references public.orders(id) on delete cascade,
  from_status      text,
  to_status        text not null,
  changed_by       uuid references auth.users(id) on delete set null,
  changed_by_email text,
  note             text,
  created_at       timestamptz not null default now()
);

create table if not exists public.email_log (
  id                  bigint generated always as identity primary key,
  order_id            uuid not null references public.orders(id) on delete cascade,
  kind                text not null check (kind in ('admin_notification','customer_receipt','customer_confirmation','customer_rejection')),
  recipient           text not null,
  status              text not null check (status in ('sent','failed')),
  provider_message_id text,
  error               text,
  created_at          timestamptz not null default now()
);

create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_created_idx    on public.orders (created_at desc);
create index if not exists orders_email_idx      on public.orders (lower(email));
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists history_order_idx     on public.order_status_history (order_id, created_at);
create index if not exists email_log_order_idx   on public.email_log (order_id, created_at);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists orders_updated on public.orders;
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists products_updated on public.products;
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

-- ---------- Provjera administratora ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------- Row Level Security ----------
alter table public.products             enable row level security;
alter table public.admins               enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.email_log            enable row level security;

-- posjetitelji smiju vidjeti samo aktivna vina i cijene (za prikaz u košarici)
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon, authenticated using (active);
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins for select to authenticated using (user_id = (select auth.uid()));

-- narudžbe, stavke, povijest i log e-mailova: SAMO administrator, SAMO čitanje.
-- Sve upise obavlja serverska funkcija (service role) – anonimni korisnici ne mogu ništa upisati ni pročitati.
drop policy if exists orders_admin_read on public.orders;
create policy orders_admin_read on public.orders for select to authenticated using (public.is_admin());
drop policy if exists items_admin_read on public.order_items;
create policy items_admin_read on public.order_items for select to authenticated using (public.is_admin());
drop policy if exists history_admin_read on public.order_status_history;
create policy history_admin_read on public.order_status_history for select to authenticated using (public.is_admin());
drop policy if exists email_log_admin_read on public.email_log;
create policy email_log_admin_read on public.email_log for select to authenticated using (public.is_admin());

revoke all on public.orders, public.order_items, public.order_status_history, public.email_log, public.admins from anon;
revoke insert, update, delete on public.orders, public.order_items, public.order_status_history, public.email_log, public.admins from authenticated;
revoke insert, update, delete on public.products from anon;

-- ---------- Kreiranje narudžbe (atomarno; poziva ga SAMO Edge Function) ----------
-- Nazive i cijene uzima iz tablice products, ne iz podataka koje šalje preglednik.
create or replace function public.create_order(p jsonb)
returns table (o_id uuid, o_number text, existed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_num text;
  v_key text := nullif(p->>'idempotency_key','');
  v_email text := lower(coalesce(p->>'email',''));
  v_item jsonb; v_prod public.products%rowtype; v_qty int;
  v_total numeric(10,2) := 0; v_priced boolean := true;
begin
  if v_key is not null then
    select o.id, o.order_number into v_id, v_num from public.orders o where o.idempotency_key = v_key;
    if found then return query select v_id, v_num, true; return; end if;
  end if;

  if (select count(*) from public.orders o where lower(o.email) = v_email and o.created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.orders o where o.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'RATE_LIMIT';
  end if;

  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 40 then
    raise exception 'INVALID_ITEMS';
  end if;

  begin
    insert into public.orders (idempotency_key, customer_type, first_name, last_name, company_name, oib, street_address,
        postal_code, city, contact_first_name, contact_last_name, email, phone, pickup_method, customer_note,
        gdpr_consent, gdpr_consent_at)
    values (v_key, p->>'customer_type', nullif(p->>'first_name',''), nullif(p->>'last_name',''), nullif(p->>'company_name',''),
        nullif(p->>'oib',''), nullif(p->>'street_address',''), nullif(p->>'postal_code',''), nullif(p->>'city',''),
        nullif(p->>'contact_first_name',''), nullif(p->>'contact_last_name',''), p->>'email', p->>'phone',
        p->>'pickup_method', nullif(p->>'customer_note',''), true, now())
    returning id, order_number into v_id, v_num;
  exception when unique_violation then
    select o.id, o.order_number into v_id, v_num from public.orders o where o.idempotency_key = v_key;
    return query select v_id, v_num, true; return;
  end;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_qty := (v_item->>'quantity')::int;
    select * into v_prod from public.products pr where pr.id = v_item->>'product_id' and pr.active;
    if not found then raise exception 'INVALID_PRODUCT'; end if;
    if v_qty is null or v_qty < 1 or v_qty > 1200 then raise exception 'INVALID_ITEMS'; end if;
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
      values (v_id, v_prod.id, v_prod.name, v_qty, v_prod.price);
    if v_prod.price is null then v_priced := false; else v_total := v_total + round(v_qty * v_prod.price, 2); end if;
  end loop;

  update public.orders set total_amount = case when v_priced then v_total end where id = v_id;
  insert into public.order_status_history (order_id, from_status, to_status, note)
    values (v_id, null, 'pending', 'Narudžba zaprimljena putem web-stranice');

  return query select v_id, v_num, false;
end $$;

-- ---------- Admin akcije (poziva ih SAMO Edge Function nakon provjere administratora) ----------
-- p: order_id, action (contacted|confirm|reject|complete|save_note), actor_id, actor_email, note, message,
--    pickup_method (opcionalno), items (opcionalno, zamjenjuje stavke prije potvrde)
create or replace function public.admin_apply(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_action text := p->>'action';
  v_actor uuid := nullif(p->>'actor_id','')::uuid;
  v_actor_email text := p->>'actor_email';
  v_note text := nullif(btrim(coalesce(p->>'note','')),'');
  v_msg text := nullif(btrim(coalesce(p->>'message','')),'');
  v_target text; v_item jsonb; v_changes text := '';
  v_total numeric(10,2); v_priced boolean;
begin
  select * into o from public.orders where id = (p->>'order_id')::uuid for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if v_action = 'save_note' then
    update public.orders set admin_note = v_note where id = o.id;
    return jsonb_build_object('changed', true, 'status', o.status, 'order_number', o.order_number);
  end if;

  v_target := case v_action when 'contacted' then 'contacted' when 'confirm' then 'confirmed'
                            when 'reject' then 'rejected' when 'complete' then 'completed' end;
  if v_target is null then raise exception 'INVALID_ACTION'; end if;

  -- idempotentnost: ako je narudžba već u ciljnom statusu, ništa se ne mijenja i e-mail se ne šalje ponovno
  if o.status = v_target then
    return jsonb_build_object('changed', false, 'already', true, 'status', o.status, 'order_number', o.order_number);
  end if;
  if not ((v_action = 'contacted' and o.status = 'pending')
       or (v_action in ('confirm','reject') and o.status in ('pending','contacted'))
       or (v_action = 'complete' and o.status = 'confirmed')) then
    raise exception 'INVALID_TRANSITION';
  end if;

  if v_action = 'reject' and v_note is null then raise exception 'REASON_REQUIRED'; end if;

  -- izmjena stavki / načina preuzimanja prije potvrde
  if v_action = 'confirm' then
    if jsonb_typeof(p->'items') = 'array' then
      if jsonb_array_length(p->'items') not between 1 and 40 then raise exception 'INVALID_ITEMS'; end if;
      delete from public.order_items where order_id = o.id;
      v_total := 0; v_priced := true;
      for v_item in select * from jsonb_array_elements(p->'items') loop
        if coalesce(btrim(v_item->>'product_name'),'') = '' or (v_item->>'quantity')::int not between 1 and 1200
           or (nullif(v_item->>'unit_price','') is not null and (v_item->>'unit_price')::numeric < 0) then
          raise exception 'INVALID_ITEMS';
        end if;
        insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
          values (o.id, (select pr.id from public.products pr where pr.id = v_item->>'product_id'),
                  btrim(v_item->>'product_name'), (v_item->>'quantity')::int, nullif(v_item->>'unit_price','')::numeric);
        if nullif(v_item->>'unit_price','') is null then v_priced := false;
        else v_total := v_total + round((v_item->>'quantity')::int * (v_item->>'unit_price')::numeric, 2); end if;
      end loop;
      update public.orders set total_amount = case when v_priced then v_total end where id = o.id;
      v_changes := v_changes || ' Stavke narudžbe izmijenjene prije potvrde.';
    end if;
    if p->>'pickup_method' in ('ftrr','delivery') and p->>'pickup_method' <> o.pickup_method then
      update public.orders set pickup_method = p->>'pickup_method' where id = o.id;
      v_changes := v_changes || ' Način preuzimanja izmijenjen.';
    end if;
  end if;

  update public.orders set
      status          = v_target,
      contacted_at    = case when v_target = 'contacted' then now() else contacted_at end,
      confirmed_at    = case when v_target = 'confirmed' then now() else confirmed_at end,
      confirmed_by    = case when v_target = 'confirmed' then v_actor else confirmed_by end,
      rejected_at     = case when v_target = 'rejected'  then now() else rejected_at end,
      fulfilled_at    = case when v_target = 'completed' then now() else fulfilled_at end,
      final_message   = case when v_target = 'confirmed' then v_msg else final_message end,
      rejection_reason= case when v_target = 'rejected'  then v_note else rejection_reason end
    where id = o.id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, changed_by_email, note)
    values (o.id, o.status, v_target, v_actor, v_actor_email, nullif(btrim(coalesce(v_note,'') || v_changes), ''));

  return jsonb_build_object('changed', true, 'status', v_target, 'order_number', o.order_number);
end $$;

revoke all on function public.create_order(jsonb) from public, anon, authenticated;
revoke all on function public.admin_apply(jsonb)  from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
grant execute on function public.admin_apply(jsonb)  to service_role;

-- ---------- Zadržavanje podataka (GDPR) ----------
-- Briše narudžbe koje nisu realizirane (nova/kontaktirana/odbijena) starije od 24 mjeseca.
-- Realizirane narudžbe (potvrđene/izvršene) ostaju dulje zbog zakonskih obveza (računovodstvo).
create or replace function public.purge_old_orders() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.orders where status in ('pending','contacted','rejected') and created_at < now() - interval '24 months';
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.purge_old_orders() from public, anon, authenticated;
grant execute on function public.purge_old_orders() to service_role;
-- Opcionalno (Database > Extensions > pg_cron): 
-- select cron.schedule('brisanje-starih-narudzbi', '0 3 * * 0', $$select public.purge_old_orders()$$);
