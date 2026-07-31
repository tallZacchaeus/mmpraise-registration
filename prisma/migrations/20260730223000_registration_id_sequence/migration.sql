-- Gapless, race-free registration numbers.
-- A sequence is used rather than COUNT(*)+1 so two concurrent submissions can
-- never be issued the same registration ID.
CREATE SEQUENCE IF NOT EXISTS registration_id_seq START WITH 1 INCREMENT BY 1;
