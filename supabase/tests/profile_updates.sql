\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.server_operation','true',true);
INSERT INTO auth.users VALUES
  ('00000000-0000-0000-0000-000000000031'),
  ('00000000-0000-0000-0000-000000000032');
INSERT INTO public.profiles(id,auth_user_id,name,email,is_external,year_joined) VALUES
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000031',
    'External profile','profile@example.com',true,NULL),
  ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000032',
    'University profile','profile@law-school.de',false,2026);
SELECT set_config('app.server_operation','',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET name='External renamed'
      WHERE id='00000000-0000-0000-0000-000000000031';
    RAISE EXCEPTION 'Expected the original external profile regression';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid player details' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;

\ir ../migrations/20261104170000_fix_external_profile_updates.sql

BEGIN;
SELECT set_config('app.server_operation','true',true);
INSERT INTO auth.users VALUES
  ('00000000-0000-0000-0000-000000000031'),
  ('00000000-0000-0000-0000-000000000032');
INSERT INTO public.profiles(id,auth_user_id,name,email,is_external,year_joined) VALUES
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000031',
    'External profile','profile@example.com',true,NULL),
  ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000032',
    'University profile','profile@law-school.de',false,2026);
SELECT set_config('app.server_operation','',true);
SELECT public.test_assert(NOT has_table_privilege('authenticated','public.profiles','UPDATE')
  AND has_column_privilege('authenticated','public.profiles','name','UPDATE')
  AND has_column_privilege('authenticated','public.profiles','avatar','UPDATE')
  AND has_column_privilege('authenticated','public.profiles','bio','UPDATE')
  AND NOT has_column_privilege('anon','public.profiles','bio','UPDATE'),'profile field update grants');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET name='External renamed',avatar='A',bio=repeat('x',160)
  WHERE id='00000000-0000-0000-0000-000000000031';
SELECT public.test_assert((SELECT name='External renamed' AND avatar='A'
  AND length(bio)=160 AND year_joined IS NULL AND is_external
  FROM public.get_my_profile()),'external profile persists without year');
SELECT public.test_denied($q$UPDATE public.profiles SET bio=repeat('x',161)
  WHERE id='00000000-0000-0000-0000-000000000031'$q$);
SELECT public.test_denied($q$UPDATE public.profiles SET role='owner'
  WHERE id='00000000-0000-0000-0000-000000000031'$q$);
SELECT public.test_denied($q$UPDATE public.profiles SET xp=999
  WHERE id='00000000-0000-0000-0000-000000000031'$q$);
UPDATE public.profiles SET name='Must not change'
  WHERE id='00000000-0000-0000-0000-000000000032';
SELECT public.test_assert((SELECT name='University profile' FROM public.profiles
  WHERE id='00000000-0000-0000-0000-000000000032'),'other profile is unchanged');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000032',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET name='University renamed',avatar='B',bio='University bio'
  WHERE id='00000000-0000-0000-0000-000000000032';
SELECT public.test_assert((SELECT name='University renamed' AND avatar='B'
  AND bio='University bio' AND year_joined=2026 AND NOT is_external
  FROM public.get_my_profile()),'university profile persists with year');
UPDATE public.profiles SET bio='' WHERE id='00000000-0000-0000-0000-000000000032';
SELECT public.test_assert((SELECT bio='' FROM public.profiles
  WHERE id='00000000-0000-0000-0000-000000000032'),'bio can be cleared');
ROLLBACK;
