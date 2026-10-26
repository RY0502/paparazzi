/*
# Create codes table for code-input push notifications

## Purpose
Stores numeric codes that a user enters on the Paparazzi web app after
receiving a "code-input" push notification. Each push notification carries an
`identifier`; when the user types a code on the resulting page and taps Send,
the app writes a row to this table containing the identifier, the entered code,
and the originating push_subscription id.

1. New Tables
- `codes`
  - `id` (uuid, primary key)
  - `identifier` (text, not null) — the identifier sent in the push payload
  - `code` (text, not null) — the numeric code the user entered on the page
  - `subscription_id` (uuid, nullable) — references push_subscriptions.id,
    identifies which device/subscription the push was sent to
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `codes`.
- This is a no-auth (single-tenant) app: the anon-key client must be able to
  insert and read, so policies target `anon, authenticated` with USING(true)
  because the data is intentionally shared/public (no sign-in screen).
- Grant SELECT, INSERT on `codes` to `anon, authenticated`. No UPDATE/DELETE
  from the client — codes are append-only from the user's device.
- Grant full CRUD to `service_role` because the sender edge function (which
  uses the service role key) may read codes, and admin/edge operations may
  need to manage rows.

3. Indexes
- Index on `identifier` for lookups by identifier.
- Index on `subscription_id` for device-scoped queries.
*/

CREATE TABLE IF NOT EXISTS codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  code text NOT NULL,
  subscription_id uuid REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON codes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON codes TO service_role;

DROP POLICY IF EXISTS "anon_select_codes" ON codes;
CREATE POLICY "anon_select_codes" ON codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_codes" ON codes;
CREATE POLICY "anon_insert_codes" ON codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_codes" ON codes;
CREATE POLICY "anon_update_codes" ON codes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_codes" ON codes;
CREATE POLICY "anon_delete_codes" ON codes FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_codes_identifier ON codes (identifier);
CREATE INDEX IF NOT EXISTS idx_codes_subscription_id ON codes (subscription_id);
