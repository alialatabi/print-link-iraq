-- Add payment tracking fields to orders
ALTER TABLE public.orders ADD COLUMN paid_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid'));