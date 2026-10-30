-- Drop all existing policies
drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can insert own notifications" on public.notifications;
drop policy if exists "Service role can insert notifications" on public.notifications;
drop policy if exists "Allow anonymous insert" on public.notifications;

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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create policy: allow authenticated users to insert notifications
create policy "Users can insert own notifications"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() = user_id);
