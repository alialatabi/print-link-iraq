-- Add 'reseller' (print shop / office) role to the app_role enum.
-- NOTE: ALTER TYPE ... ADD VALUE must run in its own migration; the new value
-- cannot be used in the same transaction it is added in. Tables/policies that
-- reference 'reseller' live in the next migration.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reseller';
