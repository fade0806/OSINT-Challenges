create table if not exists operators (
  user_id text primary key,
  email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists board_meta (
  key text primary key,
  value text not null
);

create table if not exists captures (
  slug text primary key,
  name text not null,
  category text not null,
  brief text not null default '',
  mime text not null default 'image/jpeg',
  image_b64 text not null,
  thumb_b64 text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
