-- Registration checks the whitelist internally; clients do not need this RPC.
REVOKE EXECUTE ON FUNCTION public.is_email_whitelisted(TEXT)
FROM PUBLIC, anon, authenticated;
