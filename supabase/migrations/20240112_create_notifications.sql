-- Create notifications table
create table public.notifications (
  id bigserial not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  metadata jsonb null,
  read boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint notifications_pkey primary key (id)
) TABLESPACE pg_default;

-- Create index for faster queries
create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_user_read_idx on public.notifications(user_id, read);
create index notifications_created_at_idx on public.notifications(created_at desc);

-- Create trigger for updated_at
create trigger trg_notifications_updated_at
  before update on public.notifications
  for each row
  execute function set_updated_at();

-- Enable RLS
alter table public.notifications enable row level security;

-- Create policy: users can only see their own notifications
create policy "Users can view own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

-- Create policy: users can update their own notifications (mark as read)
create policy "Users can update own notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id);

-- Create policy: users can insert their own notifications
create policy "Users can insert own notifications"
  on public.notifications
  for insert
  with check (auth.uid() = user_id);
