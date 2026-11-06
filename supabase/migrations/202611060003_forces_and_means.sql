-- ОПТП СКО: текстовые сведения о привлекаемых силах и средствах.
-- Выполнить один раз в SQL Editor после резервного копирования.
-- Никаких существующих планов/документов не удаляет и не меняет.
begin;
set local lock_timeout='5s';
alter table public.optp_objects
  add column if not exists forces_and_means text;
comment on column public.optp_objects.forces_and_means
  is 'Силы и средства из проверенного Word ОПТП; существующие RLS-политики объекта сохраняются';
commit;
