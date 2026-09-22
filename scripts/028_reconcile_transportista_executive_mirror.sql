-- Reconcile legacy executive display fields without changing canonical ownership.
-- Canonical source of truth: transportistas.assigned_executive_id -> executive_staff.id.
-- Apply only after explicit production authorization.

begin;

do $$
begin
  if exists (
    select 1
    from public.transportistas t
    left join public.executive_staff es on es.id = t.assigned_executive_id
    where coalesce(t.is_active, true) = true
      and (
        t.assigned_executive_id is null
        or es.id is null
        or coalesce(es.is_active, true) = false
      )
  ) then
    raise exception 'Canonical executive assignment integrity check failed';
  end if;
end
$$;

update public.transportistas t
set
  ejecutivo_nombre = split_part(trim(es.full_name), ' ', 1),
  ejecutivo_asignado = null
from public.executive_staff es
where t.assigned_executive_id = es.id
  and coalesce(t.is_active, true) = true
  and (
    trim(coalesce(t.ejecutivo_nombre, '')) is distinct from split_part(trim(es.full_name), ' ', 1)
    or t.ejecutivo_asignado is not null
  );

do $$
begin
  if exists (
    select 1
    from public.transportistas t
    join public.executive_staff es on es.id = t.assigned_executive_id
    where coalesce(t.is_active, true) = true
      and trim(coalesce(t.ejecutivo_nombre, '')) is distinct from split_part(trim(es.full_name), ' ', 1)
  ) then
    raise exception 'Executive mirror reconciliation failed';
  end if;
end
$$;

commit;
