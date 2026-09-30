-- Targeted, idempotent portfolio correction for two subcontractors reported by Carolina.
-- Canonical ownership is transportistas.assigned_executive_id -> executive_staff.id.
-- Production was corrected on 2026-09-30; this script preserves an auditable, reproducible record.

begin;

do $$
declare
  carolina_id uuid;
begin
  select id
    into carolina_id
  from public.executive_staff
  where lower(email) = 'carolina.sepulveda@labbe.cl'
    and coalesce(is_active, true) = true;

  if carolina_id is null then
    raise exception 'Active Carolina executive_staff record not found';
  end if;

  if (
    select count(*)
    from public.transportistas
    where id in (
      'c24d195d-58fa-463e-aaad-96753050116f',
      'd3fd017f-552c-4da2-bba3-5c0fb2d22ac0'
    )
      and rut in ('78115605-1', '78467983-7')
  ) <> 2 then
    raise exception 'Target transportista identity check failed';
  end if;

  update public.transportistas
  set assigned_executive_id = carolina_id,
      ejecutivo_nombre = split_part(trim('Carolina Pilar Sepulveda Contreras'), ' ', 1),
      ejecutivo_asignado = null,
      updated_at = now()
  where id in (
    'c24d195d-58fa-463e-aaad-96753050116f',
    'd3fd017f-552c-4da2-bba3-5c0fb2d22ac0'
  )
    and rut in ('78115605-1', '78467983-7');

  if (
    select count(*)
    from public.transportistas
    where id in (
      'c24d195d-58fa-463e-aaad-96753050116f',
      'd3fd017f-552c-4da2-bba3-5c0fb2d22ac0'
    )
      and assigned_executive_id = carolina_id
      and ejecutivo_nombre = 'Carolina'
      and ejecutivo_asignado is null
  ) <> 2 then
    raise exception 'Carolina assignment verification failed';
  end if;
end
$$;

commit;
