-- Migration to update tickets table schema
-- This script safely updates the tickets table to use structured fields.

-- 1. Add new columns
ALTER TABLE public.tickets
ADD COLUMN type TEXT CHECK (type IN ('technical', 'doubts', 'supervisor')),
ADD COLUMN reason TEXT,
ADD COLUMN description TEXT;

-- 2. Update existing rows if necessary (if there were any rows, this ensures they have safe defaults)
-- But since the table is cleaned, we can skip complex backfills and just set defaults in case some rows exist:
UPDATE public.tickets SET type = 'technical', reason = 'legacy_issue' WHERE type IS NULL;

-- 3. Apply NOT NULL constraints now that rows have valid data (if any)
ALTER TABLE public.tickets
ALTER COLUMN type SET NOT NULL,
ALTER COLUMN reason SET NOT NULL;

-- 4. Drop the priority column
ALTER TABLE public.tickets
DROP COLUMN priority;

-- 5. Make issue nullable to support legacy display but not require it anymore
ALTER TABLE public.tickets
ALTER COLUMN issue DROP NOT NULL;
