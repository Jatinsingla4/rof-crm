-- The booking flow stores a new booking's allocation as 'booked' (booking.ts, allocations.ts) but the enum never had that value,
-- so completing a booking failed with a server error. Safe to run again.
ALTER TYPE public.allocation_status ADD VALUE IF NOT EXISTS 'booked';
