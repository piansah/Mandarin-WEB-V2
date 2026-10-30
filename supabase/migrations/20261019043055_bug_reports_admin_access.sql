-- Report owners can create and read their own submissions.
-- Admins can review all reports and update their workflow status.
alter table public.bug_reports enable row level security;

grant select, insert, update on table public.bug_reports to authenticated;
grant usage, select on sequence public.bug_reports_id_seq to authenticated;

drop policy if exists "Users can view own bug reports" on public.bug_reports;
create policy "Users can view own bug reports"
  on public.bug_reports
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can submit own bug reports" on public.bug_reports;
create policy "Users can submit own bug reports"
  on public.bug_reports
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Admins can view all bug reports" on public.bug_reports;
create policy "Admins can view all bug reports"
  on public.bug_reports
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profile as profile
      where profile.user_id = (select auth.uid())
        and profile.role in ('admin', 'superadmin')
    )
  );

drop policy if exists "Admins can update bug reports" on public.bug_reports;
create policy "Admins can update bug reports"
  on public.bug_reports
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_profile as profile
      where profile.user_id = (select auth.uid())
        and profile.role in ('admin', 'superadmin')
    )
  )
  with check (
    exists (
      select 1
      from public.user_profile as profile
      where profile.user_id = (select auth.uid())
        and profile.role in ('admin', 'superadmin')
    )
  );;
