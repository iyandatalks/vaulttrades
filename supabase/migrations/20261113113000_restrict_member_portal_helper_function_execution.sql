revoke all on function public.vt_member_is_admin() from public, anon, authenticated;
revoke all on function public.vt_member_has_active_membership() from public, anon, authenticated;
grant execute on function public.vt_member_is_admin() to authenticated, service_role;
grant execute on function public.vt_member_has_active_membership() to authenticated, service_role;
