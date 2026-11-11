-- 008_chat_agent_role.sql
-- Read-only login for the chat agent's execute_query (CHAT_DATABASE_URL).
-- Run as a superuser after `transactions` exists, then set the password:
--   psql -U postgres -c "\password parsel_agent"

CREATE ROLE parsel_agent LOGIN;
GRANT SELECT ON public.transactions TO parsel_agent;
ALTER ROLE parsel_agent SET default_transaction_read_only = on;
ALTER ROLE parsel_agent SET statement_timeout = '10s';
