CREATE OR REPLACE FUNCTION public.is_email_whitelisted(candidate_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  normalized_email TEXT := lower(trim(candidate_email));
BEGIN
  RETURN normalized_email = 'runekamprolf@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.whitelist
      WHERE lower(pattern) = normalized_email
         OR (
           left(pattern, 1) = '@'
           AND normalized_email LIKE '%' || lower(pattern)
         )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(TEXT)
TO anon, authenticated;
