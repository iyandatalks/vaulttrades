grant select, insert, update on public.member_ea_licensing_requests to authenticated;
drop policy if exists member_ea_request_select_own_or_admin on public.member_ea_licensing_requests;
create policy member_ea_request_select_own_or_admin on public.member_ea_licensing_requests
for select to authenticated using (private.vt_member_is_admin() or auth_user_id = auth.uid());
drop policy if exists member_ea_request_update_admin on public.member_ea_licensing_requests;
create policy member_ea_request_update_admin on public.member_ea_licensing_requests
for update to authenticated using (private.vt_member_is_admin()) with check (private.vt_member_is_admin());
