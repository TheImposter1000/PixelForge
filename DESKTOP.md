# PixelForge Studio — Windows desktop app

The Windows edition reuses the existing PixelForge editor. It runs entirely from installed local files, so editing, .pforge projects, and exported images work without an internet connection. Supabase account login and cloud saving still need internet access.

## Install a built EXE

Visit [PixelForge Desktop Releases](https://github.com/TheImposter1000/PixelForge/releases/tag/desktop-preview) and download the latest `PixelForge-Setup-0.1.0.exe`. Run it to install PixelForge Studio.

This initial Windows installer is **unsigned**, which means Windows SmartScreen may display an "Unknown publisher" warning. Only obtain installers from this repository's release page.

## Build locally (Windows 10/11)

1. Install Node.js 22 or later.
2. Clone this repository and run `npm install`.
3. Run `npm run build:win` to create an NSIS Windows installer in `dist/`.
4. Run `npm start` during development (desktop SDK is prepared automatically by the Windows packaging script; to run locally, run `npm run desktop:prepare` first).

The repository's `Windows Desktop EXE` GitHub Actions workflow builds the installer on every Windows-related change to main and uploads it as a build artifact. It also updates the desktop-preview GitHub Release.

## Google sign-in on the desktop

Google sign-in must run in your default system browser; Google does not allow sign-in within embedded Electron browser windows. The desktop app uses the `pixelforge://auth/callback` URL scheme so that Google can send the completed login back to the EXE.

**One-time setup required:** In your PixelForge Supabase project, open **Authentication > URL Configuration > Redirect URLs** and add exactly:

`pixelforge://auth/callback`

Keep the website's existing `https://theimposter1000.github.io/PixelForge/` URL in the list too. The Google OAuth client's authorized redirect URI in Google Cloud **remains** your Supabase `https://mqxstxdhggpoyichmisd.supabase.co/auth/v1/callback` URL, with no change needed.

The app contains only the Supabase **publishable** key. OAuth client secrets and service-role keys stay in Supabase and are never bundled into the EXE.

## Safety and current limits

- The app prevents renderer access to Node.js APIs and intercepts external navigation.
- Windows file-open selection is native; downloads prompt for a save location.
- Open documents are recovered using the app's local profile and not shared with the web edition.
- This is an early unsigned installer, not a Microsoft Store package.
- To avoid losing work, save .pforge backups before uninstalling or clearing app data.
