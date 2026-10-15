# Flowdesk — Treatment Proposal Register

Next.js 16 App Router application migrated from the original HTML register, preserving all 152 historical proposal rows.

## Local development

Use Node.js 22.18 or newer. Run `npm install`, then `npm run dev` and open http://localhost:3000.

Login uses Supabase Auth and approved usernames in `register_members`. There are no hardcoded credentials or development fallback accounts. Configure `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-server-only-secret-key
```

Run **supabase/install.sql** in your Supabase SQL Editor to install everything at once. Alternatively, run these files **in order**:

1. `supabase/setup.sql` — tables, settings, membership policies.
2. `supabase/cloud-storage.sql` — database form options and transactional save/import functions.
3. `supabase/seed.sql` — inserts all 152 historical proposal rows and advances the sequence.

Follow [supabase/README.md](supabase/README.md) to create an account with `npm run seed:user`. The account script generates a password if none is provided; passwords are stored by Supabase Auth. The server secret enables username lookup; email login works without it. Never expose the server secret to client code or commit `.env` files.

Supabase validates passwords, manages session cookies and applies its Auth rate limits. `proxy.ts` refreshes sessions; protected pages verify the user and database membership. The former custom `flowdesk_session` cookie is ignored. Public registration and password recovery screens are not included. Set environment variables on your hosting service, then run `npm run build` and `npm start` behind HTTPS.

## File structure

```text
app/
  layout.tsx              Root metadata, styles, Suspense boundary
  login/                  Login screen and authentication Server Actions
  (workspace)/
    layout.tsx            Authenticated shell with initial database records
    actions.ts            Authorized database reads and writes
    page.tsx              Dashboard
    register/page.tsx     Search, filters, pagination, history, exports
    new/page.tsx          New proposal and revision entry
    settings/page.tsx     Shared numbering and JSON backup/import
components/               Forms, table, workspace shell and icons
lib/auth.ts               Supabase user and workspace membership checks
lib/supabase/             Server-only session and admin clients
proxy.ts                  Supabase session refresh
supabase/                 SQL schema, historical imports and setup instructions
scripts/seed-user.mjs     Create an Auth account and database membership
lib/proposals.ts          Types, validation, numbering and export helpers
lib/register-data.ts      Database reads with pagination
supabase/seed.sql         Historical inserts with original source metadata
```

## Records and migration

The database is the source of truth for proposals, numbering, usernames, treatment types, and locations. The app has no bundled proposal dataset or browser-storage fallback. The first render reads Supabase on the server; the client refreshes after writes, on navigation/focus, and every 30 seconds while visible. An empty database shows an empty register; connection and permission errors are surfaced instead of replaced with demo data.

Original browser storage is left untouched but no longer read by the app. Import an original JSON backup under **Settings & backup** to migrate any additional browser records. Imports add missing records, skip identical rows, and reject conflicts without changing existing history. They never replace or delete database records. Downloaded backups and CSV/Excel exports contain the currently loaded database records.

New projects and revisions are numbered in database transactions using a shared row lock. The form shows a preview; the database assigns the final number. Revisions retain project code, treatment code, financial year and sequence, incrementing only the final two digits (maximum 99). Stale settings updates are rejected. Dashboard totals use the latest revision per project. Exports include all history and original Excel metadata; Excel uses the original XML Spreadsheet `.xls` format.

## Validation

Run `npm run lint`, `npm run build`, and `npm test`. Auth/data reader tests simulate Supabase responses. Database tests execute the schema, historical imports, access policies and transaction functions against a local PostgreSQL engine (PGlite), without changing your live project.
