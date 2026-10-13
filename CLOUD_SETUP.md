# PixelForge Cloud setup

PixelForge supports two real account sign-in methods, **Google** and **email/password**, through Supabase Auth. Private editable projects use Supabase Storage and a PostgreSQL project index. Until a Supabase project is connected, the sign-in controls explain that cloud accounts are not configured; the existing local editor and browser library keep working.

## 1. Create the backend

Create a Supabase project, or connect the Supabase app in ChatGPT so the setup can be completed through the connected project. Keep the database password, Google OAuth client secret, and Supabase service role key **private**. None of those belong in PixelForge's public GitHub repository.

Run the following SQL in the Supabase SQL Editor. It creates a private storage bucket, a project index, and explicit row-level security policies. These are **essential** because the app runs in a public browser.

```sql
create table if not exists public.pixelforge_projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  thumbnail text,
  storage_path text not null unique,
  updated_at timestamptz not null default now(),
  constraint pixelforge_owner_path check (
    storage_path = user_id::text || '/' || id::text || '.pforge'
  )
);

alter table public.pixelforge_projects enable row level security;
grant select, insert, update, delete on public.pixelforge_projects to authenticated;

create policy "PixelForge read own projects"
on public.pixelforge_projects for select to authenticated
using (user_id = (select auth.uid()));

create policy "PixelForge insert own projects"
on public.pixelforge_projects for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "PixelForge update own projects"
on public.pixelforge_projects for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "PixelForge delete own projects"
on public.pixelforge_projects for delete to authenticated
using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pixelforge-projects', 'pixelforge-projects', false, 31457280, array['application/json'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "PixelForge read own storage"
on storage.objects for select to authenticated
using (
  bucket_id = 'pixelforge-projects'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "PixelForge upload own storage"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pixelforge-projects'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "PixelForge replace own storage"
on storage.objects for update to authenticated
using (
  bucket_id = 'pixelforge-projects'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'pixelforge-projects'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "PixelForge delete own storage"
on storage.objects for delete to authenticated
using (
  bucket_id = 'pixelforge-projects'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
```

The script is intended to run once in a new project. If a policy already exists, inspect that policy before modifying it. Never remove RLS or make the `pixelforge-projects` bucket public.

## 2. Enable authentication

In Supabase Authentication, enable the **Email** provider, including password sign-in. Turn on email confirmation for account verification and configure SMTP delivery for production use.

For **Google**, create OAuth credentials using Google Cloud's OAuth configuration. Add the callback URL displayed by Supabase (usually `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) as an authorized redirect URI in Google Cloud. Enter the Google client ID and **client secret only in Supabase's Google provider settings**. Do not put that secret into GitHub.

In Supabase Authentication > URL Configuration set:

* Site URL: `https://theimposter1000.github.io/PixelForge/`
* Allowed redirect URL: `https://theimposter1000.github.io/PixelForge/`

The PixelForge browser app uses the current origin and path after email confirmation or Google sign-in. If a custom domain is added later, add its URL to the allow list.

## 3. Configure the public browser client

Edit `cloud-config.js` in GitHub:

```javascript
window.PIXELFORGE_CLOUD_CONFIG = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'YOUR_SB_PUBLISHABLE_KEY'
};
```

Only the project's **publishable / anon** key is allowed. This is not a secret, but its security depends on the row-level security policies above. **Never use a service role key** or database password in public source.

Commit that file to `main` and let GitHub Pages redeploy. Verify that the browser loads the updated file.

## 4. Test real save and authentication behavior

1. Create an account with email/password, follow any confirmation email, then sign in.
2. Sign out and sign in with Google (the same Google email may link to the same Supabase user if supported by Supabase's account-linking rules).
3. In PixelForge, make a document and use **File > Save As > My Cloud**. This saves the native editable `.pforge` data to a private cloud bucket.
4. Edit that document, press **Ctrl + S**, and confirm it updates the same cloud entry.
5. Refresh and reopen the document under **Home > My cloud projects**.
6. Sign in as a *different user* and verify the first account's project cannot be listed, downloaded, overwritten or deleted.
7. Confirm **Save to PixelForge Library** still saves locally and **This computer** still downloads files.

The cloud feature currently stores up to 30 MB per project. The browser-based IndexedDB library and recovery snapshots are independent and not automatically uploaded. File transfer between the local library and a cloud account is an explicit Save As operation.

## Notes

* Account sign-in requires an online connection; the existing editor and local project library remain usable offline.
* Large `.pforge` files contain per-layer raster data. Check Supabase quotas before broad deployment.
* A cloud upload and its metadata index use separate API requests; if a request fails, verify the project is present before assuming it was saved.
* Sign-up and Google OAuth do not become operational merely from adding the client code. All Supabase and Google settings above must be configured.

Documentation: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/storage/security/access-control.
