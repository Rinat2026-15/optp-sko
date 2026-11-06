-- Apply manually in Supabase SQL Editor after a backup and staging verification.
-- No automatic assignment: all existing objects retain NULL (unassigned).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE public.optp_fire_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.optp_fire_units ENABLE ROW LEVEL SECURITY;
-- Names are public, matching the existing guest object catalogue.
GRANT SELECT ON public.optp_fire_units TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.optp_fire_units FROM anon, authenticated;
CREATE POLICY optp_fire_units_read ON public.optp_fire_units
  FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE public.optp_objects ADD COLUMN fire_unit_id uuid;
ALTER TABLE public.optp_objects ADD CONSTRAINT optp_objects_fire_unit_id_fkey
  FOREIGN KEY (fire_unit_id) REFERENCES public.optp_fire_units(id) ON DELETE RESTRICT;
CREATE INDEX optp_objects_fire_unit_id_idx ON public.optp_objects(fire_unit_id);
COMMENT ON COLUMN public.optp_objects.fire_unit_id IS
  'Responsible DChS SKO fire unit; NULL means unassigned. Existing object RLS governs writes.';
-- Existing optp_objects RLS, file tables, storage and authentication are untouched.
-- Intentionally no IF NOT EXISTS: incompatible pre-existing schema fails atomically.
COMMIT;
