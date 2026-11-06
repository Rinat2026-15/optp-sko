-- ОПТП СКО: безопасное полное удаление одного объекта через RPC.
-- Выполнить вручную в Supabase SQL Editor (после резервной копии).
-- Вызывать может только авторизованный пользователь с ролью admin в optp_users.
-- Данные в таблицах удаляются атомарно. Файлы Storage удаляет клиент после успешного RPC.
BEGIN;
CREATE OR REPLACE FUNCTION public.optp_admin_delete_object(p_object_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_files text[];
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.optp_users u
      WHERE u.user_id = auth.uid() AND u.role = 'admin'
    )
  THEN
    RAISE EXCEPTION 'Удалять объекты может только администратор'
      USING ERRCODE = '42501';
  END IF;

  IF p_object_id IS NULL THEN
    RAISE EXCEPTION 'Не указан объект';
  END IF;
  PERFORM 1 FROM public.optp_objects
    WHERE id = p_object_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Объект не найден';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT p.file_path), ARRAY[]::text[])
  INTO v_files
  FROM (
    SELECT file_path FROM public.optp_floor_plans WHERE object_id = p_object_id
    UNION ALL
    SELECT file_path FROM public.optp_documents WHERE object_id = p_object_id
  ) AS p
  WHERE p.file_path IS NOT NULL AND p.file_path <> '';

  DELETE FROM public.optp_floor_plans WHERE object_id = p_object_id;
  DELETE FROM public.optp_documents WHERE object_id = p_object_id;
  DELETE FROM public.optp_objects WHERE id = p_object_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'Удаление объекта не удалось';
  END IF;
  RETURN v_files;
END
$function$;
REVOKE ALL ON FUNCTION public.optp_admin_delete_object(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.optp_admin_delete_object(uuid) TO authenticated;
COMMIT;
