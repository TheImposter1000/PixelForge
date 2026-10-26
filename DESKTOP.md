# PixelForge Studio — Windows desktop app

The Windows edition reuses the existing PixelForge editor. It runs entirely from installed local files, so editing, .pforge projects, and exported images work without an internet connection. Supabase account login and cloud saving still need internet access.

## Install a built EXE

Visit the [latest PixelForge Desktop release](https://github.com/TheImposter1000/PixelForge/releases/latest), download its `PixelForge-Setup-*.exe` installer, and run it to install PixelForge Studio. Release installers now have unique versions and an accompanying `latest.yml` updater manifest.

This initial Windows installer is **unsigned**, which means Windows SmartScreen may display an "Unknown publisher" warning. Only obtain installers from this repository's release page.

## Build locally (Windows 10/11)

1. Install Node.js 22 or later.
2. Clone this repository and run `npm install`.
3. Run `npm run build:win` to create an NSIS Windows installer in `dist/`.
4. Run `npm start` during development (desktop SDK is prepared automatically by the Windows packaging script; to run locally, run `npm run desktop:prepare` first).

The repository's `Windows Desktop EXE` GitHub Actions workflow builds the installer on every Windows-related change to main and uploads it as a build artifact. It automatically publishes a **new, versioned, latest GitHub Release** containing the installer, its checksum-bearing `latest.yml` manifest and any differential-update data.

## Automatic updates (Windows)

PixelForge Desktop checks for updates when it starts and every six hours while running. The Home screen shows the installed version, update availability, download progress, and a **Check for Updates** button. Open the native **Updates** menu to:

- **Check for Updates…** at any time.
- Turn **Check automatically** on or off (enabled initially).
- Turn **Download updates automatically** on or off (enabled initially).

When a downloaded update is ready, PixelForge shows a notification and **installs the update automatically when you close the PixelForge application**. There is **no Windows or PC reboot**. You can finish editing and close PixelForge whenever convenient; the new version will launch the next time you open it. Save your documents before closing. The updater changes only the application files, not your account or user documents. Update downloads require internet access, but normal editing does not.

**One-time transition:** `PixelForge-Setup-0.1.0.exe` from the old `desktop-preview` release does not contain this updater. Install a newer version once from the [latest release](https://github.com/TheImposter1000/PixelForge/releases/latest); subsequent releases can update from within the installed app. If automatic updates fail, download the latest installer from that page.

**Security note:** These early Windows installers are unsigned, so Windows may display SmartScreen warnings. Windows Authenticode verification of the downloaded installer is disabled until the project has a code-signing certificate; the updater uses GitHub over HTTPS and verifies downloaded file hashes through the release metadata. This is a preview-level trust model, not a substitute for code signing. Installers and update metadata are published together from the repository's own GitHub Actions workflow.

## Google sign-in on the desktop

Google sign-in must run in your default system browser; Google does not allow sign-in within embedded Electron browser windows. The desktop app uses the `pixelforge://auth/callback` URL scheme so that Google can send the completed login back to the EXE.

**One-time setup required:** In your PixelForge Supabase project, open **Authentication > URL Configuration > Redirect URLs** and add exactly:

`pixelforge://auth/callback`

Keep the website's existing `https://theimposter1000.github.io/PixelForge/` URL in the list too. The Google OAuth client's authorized redirect URI in Google Cloud **remains** your Supabase `https://mqxstxdhggpoyichmisd.supabase.co/auth/v1/callback` URL, with no change needed.

The app contains only the Supabase **publishable** key. OAuth client secrets and service-role keys stay in Supabase and are never bundled into the EXE.

## Safety and current limits

- The app prevents renderer access to Node.js APIs and intercepts external navigation.
- Windows file-open selection is native via **File → Open from Computer**, **Ctrl+O**, or **Home → Open from computer**. The **Place Image as Layer** action has a native image picker. Downloads prompt for a save location.
- PixelForge starts on the **Home screen every time**, with a **Continue editing** option to reopen documents recovered from the previous session.
- The installed EXE, taskbar window, and installer use the same purple **P ✦** brand mark as the website.
- Open documents are recovered using the app's local profile and not shared with the web edition.
- This is an early unsigned installer, not a Microsoft Store package.
- To avoid losing work, save .pforge backups before uninstalling or clearing app data.

## High-quality embedded image placement

**Place Image as Layer** now keeps the image at its original pixel dimensions, using
non-destructive layer scale and position values to fit it within the document.
For example, a 1254 × 1254 PNG placed into a 150 × 150 document is shown at
150 × 150 with position X=0, Y=0, without a 3-pixel inset or loss of source pixels.
Placed image layers display **Embedded image** and their original dimensions in
the layer inspector. Resize handles and X/Y/width/height fields change the
transform, not the original image pixels. Changing the canvas size and cropping
the document also preserve off-canvas layer source pixels.

A placed image is **not** yet a native Photoshop Smart Object. Its full-resolution
pixels are preserved in PixelForge .pforge projects. To paint on one or use
destructive filters, right-click the layer and choose **Rasterize embedded image**.
Rasterization intentionally converts it to the current document resolution.

The adjustments-preview renderer now prevents old previews from another layer
or document from replacing the current canvas, including after tab switches.

## Open files directly from Windows Explorer

The NSIS installer registers **Open with PixelForge Studio** for .pforge files,
common image formats and .psd files. You may need to select PixelForge as the
default app in Windows for double-click file launching; registration does not
force a new default for images. Opening files when the application is running
reuses the existing instance, and passes the selected file to the editor after
it has loaded. Normal launches still open on the Home screen.

## Photo and GIF export quality

For photographic portraits, export at **100% image dimensions**, use **256 GIF palette colors**, and leave optional Floyd–Steinberg dithering off for clean skin tones. Enable the dithering option only if smooth gradients show visible banding. PixelForge's GIF exporter uses an image-adaptive palette and finer 6-bit/channel color matching. **PNG or WebP** remains preferable when you need full-color detail because GIF cannot store more than 256 palette entries. The Windows build tests both transparent GIF decoding and quantitative pixel fidelity before publishing.
