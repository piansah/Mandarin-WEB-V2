-- Create word_compounds table
create table public.word_compounds (
  id bigserial not null,
  hanzi text not null,
  pinyin text not null,
  arti text null,
  badge text not null default 'native'::text,
  frequency integer not null default 1,
  constraint word_compounds_pkey primary key (id),
  constraint word_compounds_hanzi_key unique (hanzi),
  constraint word_compounds_badge_check check (
    (
      badge = any (array['common'::text, 'native'::text])
    )
  )
) TABLESPACE pg_default;

-- Create GIN index for trigram search
create index IF not exists idx_word_compounds_hanzi_trgm on public.word_compounds using gin (hanzi gin_trgm_ops) TABLESPACE pg_default;

-- Enable pg_trgm extension if not exists
create extension IF not exists pg_trgm;
