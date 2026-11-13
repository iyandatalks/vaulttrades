create or replace function public.vt_member_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid() and role = 'admin'
  );
$$;
grant execute on function public.vt_member_is_admin() to authenticated, service_role;

create or replace function public.vt_member_has_active_membership()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.vt_member_is_admin() or exists (
    select 1
    from public.users u
    join public.product_licenses p on p.user_id = u.id
    where u.auth_user_id = auth.uid()
      and p.status = 'active'
      and p.start_at <= now()
      and (p.end_at is null or p.end_at > now())
      and lower(p.entitlement_code) in (
        'nexus','vaulttrades_nexus','nexus_plus','vaulttrades_nexus_plus','vortex','vaulttrades_vortex'
      )
  );
$$;
grant execute on function public.vt_member_has_active_membership() to authenticated, service_role;

grant select on public.users to authenticated;
drop policy if exists users_admin_select on public.users;
create policy users_admin_select on public.users
for select to authenticated using (public.vt_member_is_admin());

grant select, insert, update on public.member_ea_licensing_requests to authenticated;
drop policy if exists member_ea_request_select_own_or_admin on public.member_ea_licensing_requests;
create policy member_ea_request_select_own_or_admin on public.member_ea_licensing_requests
for select to authenticated using (
  public.vt_member_is_admin() or auth_user_id = auth.uid()
);
drop policy if exists member_ea_request_insert_own on public.member_ea_licensing_requests;
create policy member_ea_request_insert_own on public.member_ea_licensing_requests
for insert to authenticated with check (
  auth_user_id = auth.uid()
  and exists (select 1 from public.users u where u.id = user_id and u.auth_user_id = auth.uid())
);
drop policy if exists member_ea_request_update_admin on public.member_ea_licensing_requests;
create policy member_ea_request_update_admin on public.member_ea_licensing_requests
for update to authenticated using (public.vt_member_is_admin()) with check (public.vt_member_is_admin());

grant select, insert, update, delete on public.member_knowledge_resources to authenticated;
drop policy if exists member_knowledge_resources_read_members on public.member_knowledge_resources;
create policy member_knowledge_resources_read_members on public.member_knowledge_resources
for select to authenticated using (is_published and public.vt_member_has_active_membership());
drop policy if exists member_knowledge_resources_admin_manage on public.member_knowledge_resources;
create policy member_knowledge_resources_admin_manage on public.member_knowledge_resources
for all to authenticated using (public.vt_member_is_admin()) with check (public.vt_member_is_admin());

grant select, insert, update, delete on public.member_community_events to authenticated;
drop policy if exists member_community_events_read_members on public.member_community_events;
create policy member_community_events_read_members on public.member_community_events
for select to authenticated using (is_published and public.vt_member_has_active_membership());
drop policy if exists member_community_events_admin_manage on public.member_community_events;
create policy member_community_events_admin_manage on public.member_community_events
for all to authenticated using (public.vt_member_is_admin()) with check (public.vt_member_is_admin());

grant select, insert, update on public.member_portal_settings to authenticated;
drop policy if exists member_portal_settings_read_whatsapp on public.member_portal_settings;
create policy member_portal_settings_read_whatsapp on public.member_portal_settings
for select to authenticated using (setting_key = 'admin_whatsapp_number' or public.vt_member_is_admin());
drop policy if exists member_portal_settings_admin_manage on public.member_portal_settings;
create policy member_portal_settings_admin_manage on public.member_portal_settings
for all to authenticated using (public.vt_member_is_admin()) with check (public.vt_member_is_admin());
