-- Add last_seen column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT NULL;
