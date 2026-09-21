-- Executive coverage review mode.
-- Allows an active executive to approve/reject documents assigned to another
-- active executive without changing portfolio ownership.
-- Every cross-portfolio decision is recorded atomically in public.audit_log.

create or replace function public.enforce_subcontractor_review_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer_profile_id uuid;
  reviewer_email text;
  reviewer_role text;
  reviewer_name text;
  reviewer_full_name text;
  reviewer_first_name text;
  assigned_id uuid;
  assigned_email text;
  assigned_name text;
  assigned_full_name text;
  assigned_first_name text;
  legacy_assigned_name text;
  is_coverage boolean := false;
begin
  if new.status not in ('approved', 'rejected') then
    return new;
  end if;

  reviewer_email := lower(trim(coalesce(new.reviewed_by_ejecutiva, '')));
  if reviewer_email = '' then
    raise exception using errcode = '42501', message = 'Reviewer identity is required for approved/rejected subcontractor documents';
  end if;

  select p.id, lower(trim(p.role)), p.full_name
    into reviewer_profile_id, reviewer_role, reviewer_name
  from public.profiles p
  where lower(trim(p.email)) = reviewer_email
    and coalesce(p.is_active, true) = true
  limit 1;

  if reviewer_role is null then
    raise exception using errcode = '42501', message = 'Active reviewer profile not found';
  end if;

  if reviewer_role = 'super_admin' then
    return new;
  end if;

  if reviewer_role <> 'ejecutiva' then
    raise exception using errcode = '42501', message = 'Only active executives or super_admin may approve/reject subcontractor documents';
  end if;

  select coalesce(t.assigned_executive_id, t.ejecutivo_asignado), t.ejecutivo_nombre
    into assigned_id, legacy_assigned_name
  from public.transportistas t
  where t.id = new.subcontractor_id
    and coalesce(t.is_active, true) = true;

  if not found then
    raise exception using errcode = '42501', message = 'Active transportista assignment could not be resolved';
  end if;

  reviewer_full_name := lower(trim(coalesce(reviewer_name, '')));
  reviewer_first_name := lower(split_part(trim(coalesce(reviewer_name, '')), ' ', 1));

  if assigned_id is not null then
    select lower(trim(es.email)), es.full_name
      into assigned_email, assigned_name
    from public.executive_staff es
    where es.id = assigned_id
      and coalesce(es.is_active, true) = true
    limit 1;

    if assigned_email is null and assigned_name is null then
      raise exception using errcode = '42501', message = 'Assigned executive is missing or inactive';
    end if;

    assigned_full_name := lower(trim(coalesce(assigned_name, '')));
    is_coverage := reviewer_email <> coalesce(assigned_email, '')
      and (reviewer_full_name = '' or reviewer_full_name <> assigned_full_name);
  elsif trim(coalesce(legacy_assigned_name, '')) <> '' then
    assigned_first_name := lower(split_part(trim(legacy_assigned_name), ' ', 1));
    is_coverage := reviewer_first_name = '' or reviewer_first_name <> assigned_first_name;
    assigned_name := legacy_assigned_name;
  else
    raise exception using errcode = '42501', message = 'Transportista has no assigned executive';
  end if;

  if is_coverage
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.reviewed_by_ejecutiva is distinct from new.reviewed_by_ejecutiva
     ) then
    insert into public.audit_log (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values,
      created_at
    ) values (
      reviewer_profile_id,
      'document_review_coverage',
      'subcontractor_documents',
      new.id,
      jsonb_build_object(
        'status', case when tg_op = 'UPDATE' then old.status else null end,
        'assigned_executive_id', assigned_id,
        'assigned_executive_name', assigned_name
      ),
      jsonb_build_object(
        'status', new.status,
        'reviewed_by', reviewer_email,
        'reviewer_name', reviewer_name,
        'coverage_review', true,
        'assigned_executive_id', assigned_id,
        'assigned_executive_name', assigned_name
      ),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_subcontractor_review_assignment
  on public.subcontractor_documents;

create trigger trg_enforce_subcontractor_review_assignment
before insert or update of status, reviewed_by_ejecutiva
on public.subcontractor_documents
for each row
execute function public.enforce_subcontractor_review_assignment();


create or replace function public.audit_uploaded_document_coverage_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer_profile_id uuid;
  reviewer_email text;
  reviewer_role text;
  reviewer_name text;
  reviewer_full_name text;
  assigned_id uuid;
  assigned_email text;
  assigned_name text;
  assigned_full_name text;
  company_id uuid;
  provider_rut text;
begin
  if new.validation_status not in ('approved', 'rejected') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.validation_status is not distinct from new.validation_status
     and old.ejecutiva is not distinct from new.ejecutiva then
    return new;
  end if;

  reviewer_email := lower(trim(coalesce(new.ejecutiva, '')));
  if reviewer_email = '' then
    return new;
  end if;

  select p.id, lower(trim(p.role)), p.full_name
    into reviewer_profile_id, reviewer_role, reviewer_name
  from public.profiles p
  where lower(trim(p.email)) = reviewer_email
    and coalesce(p.is_active, true) = true
  limit 1;

  if reviewer_role <> 'ejecutiva' then
    return new;
  end if;

  company_id := new.transportista_id;

  if company_id is null and new.conductor_id is not null then
    select c.transportista_id, c.rut_proveedor
      into company_id, provider_rut
    from public.conductores c
    where c.id = new.conductor_id
    limit 1;
  end if;

  if company_id is not null then
    select coalesce(t.assigned_executive_id, t.ejecutivo_asignado)
      into assigned_id
    from public.transportistas t
    where t.id = company_id
      and coalesce(t.is_active, true) = true;
  elsif trim(coalesce(provider_rut, '')) <> '' then
    select t.id, coalesce(t.assigned_executive_id, t.ejecutivo_asignado)
      into company_id, assigned_id
    from public.transportistas t
    where t.rut = provider_rut
      and coalesce(t.is_active, true) = true
    limit 1;
  end if;

  if assigned_id is null then
    return new;
  end if;

  select lower(trim(es.email)), es.full_name
    into assigned_email, assigned_name
  from public.executive_staff es
  where es.id = assigned_id
    and coalesce(es.is_active, true) = true
  limit 1;

  if assigned_email is null and assigned_name is null then
    return new;
  end if;

  reviewer_full_name := lower(trim(coalesce(reviewer_name, '')));
  assigned_full_name := lower(trim(coalesce(assigned_name, '')));

  if reviewer_email = coalesce(assigned_email, '')
     or (reviewer_full_name <> '' and reviewer_full_name = assigned_full_name) then
    return new;
  end if;

  insert into public.audit_log (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    created_at
  ) values (
    reviewer_profile_id,
    'document_review_coverage',
    'uploaded_documents',
    new.id,
    jsonb_build_object(
      'status', case when tg_op = 'UPDATE' then old.validation_status else null end,
      'assigned_executive_id', assigned_id,
      'assigned_executive_name', assigned_name,
      'transportista_id', company_id
    ),
    jsonb_build_object(
      'status', new.validation_status,
      'reviewed_by', reviewer_email,
      'reviewer_name', reviewer_name,
      'coverage_review', true,
      'assigned_executive_id', assigned_id,
      'assigned_executive_name', assigned_name,
      'transportista_id', company_id
    ),
    now()
  );

  return new;
end;
$$;

drop trigger if exists trg_audit_uploaded_document_coverage_review
  on public.uploaded_documents;

create trigger trg_audit_uploaded_document_coverage_review
after update of validation_status, ejecutiva
on public.uploaded_documents
for each row
execute function public.audit_uploaded_document_coverage_review();
