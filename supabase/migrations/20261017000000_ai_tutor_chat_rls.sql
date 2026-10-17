-- Keep AI Tutor conversations private to their authenticated owner.
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;

drop policy if exists "Users can view own chat sessions" on public.chat_sessions;
create policy "Users can view own chat sessions"
  on public.chat_sessions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own chat sessions" on public.chat_sessions;
create policy "Users can create own chat sessions"
  on public.chat_sessions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own chat sessions" on public.chat_sessions;
create policy "Users can update own chat sessions"
  on public.chat_sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own chat sessions" on public.chat_sessions;
create policy "Users can delete own chat sessions"
  on public.chat_sessions for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view messages in own chat sessions" on public.chat_messages;
create policy "Users can view messages in own chat sessions"
  on public.chat_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "Users can add messages to own chat sessions" on public.chat_messages;
create policy "Users can add messages to own chat sessions"
  on public.chat_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete messages in own chat sessions" on public.chat_messages;
create policy "Users can delete messages in own chat sessions"
  on public.chat_messages for delete to authenticated
  using (
    exists (
      select 1 from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.user_id = auth.uid()
    )
  );

create or replace function public.update_chat_session_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chat_sessions_updated_at on public.chat_sessions;
create trigger trg_chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.update_chat_session_timestamp();
