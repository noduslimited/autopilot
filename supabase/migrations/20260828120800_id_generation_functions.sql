-- ID generation functions and org sequence initialisation
-- Source: Database Schema Document section 4; ID and Reference System Specification

create or replace function generate_client_ref(
  p_org_id uuid,
  p_first_name text,
  p_last_name text
) returns text as $$
declare
  v_org_code text;
  v_seq integer;
  v_name1 text;
  v_name2 text;
  v_ref text;
  v_exists boolean;
  v_suffix integer := 0;
begin
  select org_code into v_org_code from organisations where id = p_org_id;

  if length(p_first_name) <= 4 then
    v_name1 := upper(p_first_name);
  else
    v_name1 := upper(substring(p_first_name from 1 for 3));
  end if;

  if length(p_last_name) <= 4 then
    v_name2 := upper(p_last_name);
  else
    v_name2 := upper(substring(p_last_name from 1 for 3));
  end if;

  update id_sequences
  set next_sequence = next_sequence + 1, updated_at = now()
  where org_id = p_org_id and record_type = 'client'
  returning next_sequence - 1 into v_seq;

  v_ref := v_org_code || '-CLT-' || v_name1 || '-' || v_name2 || '-' || lpad(v_seq::text, 3, '0');

  loop
    select exists(select 1 from clients where client_ref = v_ref) into v_exists;
    exit when not v_exists;
    v_suffix := v_suffix + 1;
    v_ref := v_org_code || '-CLT-' || v_name1 || '-' || v_name2 || v_suffix::text || '-' || lpad(v_seq::text, 3, '0');
  end loop;

  return v_ref;
end;
$$ language plpgsql security definer;

-- Staff ID generation — same pattern as client, with STF type prefix
create or replace function generate_staff_ref(
  p_org_id uuid,
  p_first_name text,
  p_last_name text
) returns text as $$
declare
  v_org_code text;
  v_seq integer;
  v_name1 text;
  v_name2 text;
  v_ref text;
  v_exists boolean;
  v_suffix integer := 0;
begin
  select org_code into v_org_code from organisations where id = p_org_id;

  if length(p_first_name) <= 4 then
    v_name1 := upper(p_first_name);
  else
    v_name1 := upper(substring(p_first_name from 1 for 3));
  end if;

  if length(p_last_name) <= 4 then
    v_name2 := upper(p_last_name);
  else
    v_name2 := upper(substring(p_last_name from 1 for 3));
  end if;

  update id_sequences
  set next_sequence = next_sequence + 1, updated_at = now()
  where org_id = p_org_id and record_type = 'staff'
  returning next_sequence - 1 into v_seq;

  v_ref := v_org_code || '-STF-' || v_name1 || '-' || v_name2 || '-' || lpad(v_seq::text, 3, '0');

  loop
    select exists(select 1 from staff where staff_ref = v_ref) into v_exists;
    exit when not v_exists;
    v_suffix := v_suffix + 1;
    v_ref := v_org_code || '-STF-' || v_name1 || '-' || v_name2 || v_suffix::text || '-' || lpad(v_seq::text, 3, '0');
  end loop;

  return v_ref;
end;
$$ language plpgsql security definer;

-- Incident ID generation — sequential only, no name code
create or replace function generate_incident_ref(p_org_id uuid) returns text as $$
declare
  v_org_code text;
  v_seq integer;
begin
  select org_code into v_org_code from organisations where id = p_org_id;
  update id_sequences
  set next_sequence = next_sequence + 1, updated_at = now()
  where org_id = p_org_id and record_type = 'incident'
  returning next_sequence - 1 into v_seq;
  return v_org_code || '-INC-' || lpad(v_seq::text, 5, '0');
end;
$$ language plpgsql security definer;

-- Invoice ID generation — same pattern as incident, with INV prefix
create or replace function generate_invoice_ref(p_org_id uuid) returns text as $$
declare
  v_org_code text;
  v_seq integer;
begin
  select org_code into v_org_code from organisations where id = p_org_id;
  update id_sequences
  set next_sequence = next_sequence + 1, updated_at = now()
  where org_id = p_org_id and record_type = 'invoice'
  returning next_sequence - 1 into v_seq;
  return v_org_code || '-INV-' || lpad(v_seq::text, 5, '0');
end;
$$ language plpgsql security definer;

-- Initialise the four sequence counters whenever a new organisation is created
create or replace function initialise_org_sequences()
returns trigger as $$
begin
  insert into id_sequences (org_id, record_type, next_sequence)
  values
    (new.id, 'client', 1),
    (new.id, 'staff', 1),
    (new.id, 'incident', 1),
    (new.id, 'invoice', 1);
  return new;
end;
$$ language plpgsql;

create trigger on_org_created
  after insert on organisations
  for each row execute function initialise_org_sequences();
