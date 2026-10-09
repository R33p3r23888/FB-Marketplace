-- Bazaar real marketplace schema for Supabase.
-- Run once in Supabase Dashboard -> SQL Editor. This creates no sample listings or fake profiles.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member' check (char_length(display_name) between 2 and 60),
  city text not null default '' check (char_length(city) <= 80),
  bio text not null default '' check (char_length(bio) <= 240),
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.create_bazaar_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, city)
  values (
    new.id,
    case
      when char_length(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Member')) < 2 then 'Member'
      else coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Member')
    end,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'city'), ''), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists bazaar_auth_user_profile on auth.users;
create trigger bazaar_auth_user_profile
after insert on auth.users
for each row execute procedure public.create_bazaar_profile();

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 110),
  description text not null check (char_length(trim(description)) between 5 and 2500),
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'INR',
  category text not null check (category in ('Cars & Vehicles','Electronics','Home & Garden','Fashion','Sports & Outdoors','Property','Hobbies & Collectibles','Baby & Kids','Free Stuff','Other')),
  condition text not null check (condition in ('New','Like new','Good','Fair','For parts')),
  city text not null check (char_length(trim(city)) between 1 and 80),
  locality text check (locality is null or char_length(locality) <= 80),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) between 1 and 6),
  status text not null default 'active' check (status in ('active','sold','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (coalesce(title, '') || ' ' || coalesce(description, '')) stored,
  location_text text generated always as (coalesce(locality, '') || ' ' || coalesce(city, '')) stored
);

create index if not exists listings_bazaar_browse_idx on public.listings (status, created_at desc);
create index if not exists listings_bazaar_seller_idx on public.listings (seller_id, created_at desc);
create index if not exists listings_bazaar_category_idx on public.listings (category, status);
create index if not exists listings_bazaar_price_idx on public.listings (price);
create index if not exists listings_bazaar_search_idx on public.listings using gin (to_tsvector('simple', search_text));
create index if not exists listings_bazaar_location_idx on public.listings (location_text);

create or replace function public.touch_bazaar_listing()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists bazaar_listing_touch on public.listings;
create trigger bazaar_listing_touch before update on public.listings
for each row execute procedure public.touch_bazaar_listing();

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists favorites_bazaar_user_idx on public.favorites(user_id, created_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint bazaar_conversation_distinct_people check (buyer_id <> seller_id),
  constraint bazaar_conversation_unique_listing_people unique (listing_id, buyer_id, seller_id)
);
create index if not exists conversations_bazaar_buyer_idx on public.conversations(buyer_id, last_message_at desc);
create index if not exists conversations_bazaar_seller_idx on public.conversations(seller_id, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_bazaar_conversation_idx on public.messages(conversation_id, created_at asc);

create or replace function public.touch_bazaar_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists bazaar_message_touch_conversation on public.messages;
create trigger bazaar_message_touch_conversation
after insert on public.messages
for each row execute procedure public.touch_bazaar_conversation_after_message();

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('Misleading listing','Prohibited item','Suspected scam','Harassment','Other')),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','reviewed','closed'))
);
create index if not exists reports_bazaar_created_idx on public.reports(created_at desc);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Bazaar profiles public read" on public.profiles;
create policy "Bazaar profiles public read" on public.profiles for select using (true);
drop policy if exists "Bazaar profile insert own" on public.profiles;
create policy "Bazaar profile insert own" on public.profiles for insert with check (id = auth.uid());
drop policy if exists "Bazaar profile update own" on public.profiles;
create policy "Bazaar profile update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Bazaar active listings or own listings read" on public.listings;
create policy "Bazaar active listings or own listings read" on public.listings for select using (status = 'active' or seller_id = auth.uid());
drop policy if exists "Bazaar sellers create own listings" on public.listings;
create policy "Bazaar sellers create own listings" on public.listings for insert with check (seller_id = auth.uid());
drop policy if exists "Bazaar sellers update own listings" on public.listings;
create policy "Bazaar sellers update own listings" on public.listings for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists "Bazaar sellers remove own listings" on public.listings;
create policy "Bazaar sellers remove own listings" on public.listings for delete using (seller_id = auth.uid());

drop policy if exists "Bazaar favorites private to owner" on public.favorites;
create policy "Bazaar favorites private to owner" on public.favorites for select using (user_id = auth.uid());
drop policy if exists "Bazaar add own favorites" on public.favorites;
create policy "Bazaar add own favorites" on public.favorites for insert with check (user_id = auth.uid());
drop policy if exists "Bazaar remove own favorites" on public.favorites;
create policy "Bazaar remove own favorites" on public.favorites for delete using (user_id = auth.uid());

drop policy if exists "Bazaar conversation members read" on public.conversations;
create policy "Bazaar conversation members read" on public.conversations for select using (buyer_id = auth.uid() or seller_id = auth.uid());
drop policy if exists "Bazaar buyers start listing conversations" on public.conversations;
create policy "Bazaar buyers start listing conversations" on public.conversations for insert with check (
  buyer_id = auth.uid() and buyer_id <> seller_id and exists (
    select 1 from public.listings l
    where l.id = conversations.listing_id
      and l.seller_id = conversations.seller_id
      and l.status = 'active'
  )
);

drop policy if exists "Bazaar conversation members read messages" on public.messages;
create policy "Bazaar conversation members read messages" on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid()))
);
drop policy if exists "Bazaar members send their own messages" on public.messages;
create policy "Bazaar members send their own messages" on public.messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversations c where c.id = messages.conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "Bazaar reporters can create reports" on public.reports;
create policy "Bazaar reporters can create reports" on public.reports for insert with check (reporter_id = auth.uid());
drop policy if exists "Bazaar reporters can view their own reports" on public.reports;
create policy "Bazaar reporters can view their own reports" on public.reports for select using (reporter_id = auth.uid());

-- Listing photos are public marketplace images. Uploads/changes are restricted to the owner's UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Bazaar public listing photos read" on storage.objects;
create policy "Bazaar public listing photos read" on storage.objects for select using (bucket_id = 'listing-photos');
drop policy if exists "Bazaar users upload their listing photos" on storage.objects;
create policy "Bazaar users upload their listing photos" on storage.objects for insert to authenticated with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Bazaar users update their listing photos" on storage.objects;
create policy "Bazaar users update their listing photos" on storage.objects for update to authenticated using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Bazaar users delete their listing photos" on storage.objects;
create policy "Bazaar users delete their listing photos" on storage.objects for delete to authenticated using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Enable realtime updates for actual messages and inbox ordering, if Supabase Realtime is available.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
      execute 'alter publication supabase_realtime add table public.conversations';
    end if;
  end if;
end $$;
