-- Migration to add external ticket references and internal ticket numbers

-- 1. Add ticket_number as a SERIAL column automatically generating sequence
ALTER TABLE public.tickets
ADD COLUMN ticket_number SERIAL;

-- 2. Add external_ticket_id column, nullable initially to handle existing data safely
ALTER TABLE public.tickets
ADD COLUMN external_ticket_id TEXT;

-- 3. Backfill existing records with a placeholder if they exist
UPDATE public.tickets SET external_ticket_id = '000000' WHERE external_ticket_id IS NULL;

-- 4. Apply NOT NULL constraint to external_ticket_id
ALTER TABLE public.tickets
ALTER COLUMN external_ticket_id SET NOT NULL;
