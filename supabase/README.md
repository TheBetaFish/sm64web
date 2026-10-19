# SM64 Web save codes

The browser UI uses the Supabase project configured in `web/sm64web-ui.js` for online save codes.

## One-time database setup

Apply the migration in the Supabase SQL Editor for project `pjpnndbdbcoqvafklplb`:

- File: `supabase/migrations/20261019000000_sm64web_save_codes.sql`
- Open the SQL Editor in the Supabase dashboard.
- Paste the complete migration file into a new query and run it.

The migration creates a private save table and two narrowly scoped RPC functions. The table itself is not granted directly to anonymous users; the browser calls only the create/load functions. The browser uses a publishable key, never a service-role key.

## Save format

The game currently exports a 512-byte EEPROM buffer as 1,024 hexadecimal characters plus the active save slot. The numeric code is a shareable lookup key, not an account credential. Anyone with a code can load that save, so only share it with people you trust.

The static GitHub Pages site cannot apply database migrations automatically. Online save-code operations will report a backend error until the migration has been applied.
