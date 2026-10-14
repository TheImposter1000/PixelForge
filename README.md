# PixelForge Studio

PixelForge Studio is a Photoshop-inspired image editor for the web and Windows desktop.

Use [PixelForge in your browser](https://theimposter1000.github.io/PixelForge/) or install the [Windows desktop app (.exe)](https://github.com/TheImposter1000/PixelForge/releases/download/desktop-preview/PixelForge-Setup-0.1.0.exe). The latest installer is also listed on the [GitHub desktop releases page](https://github.com/TheImposter1000/PixelForge/releases/tag/desktop-preview).

## Development workflow

This repository is now the permanent source of truth for PixelForge. Future fixes and features should update this repository instead of creating separate downloadable HTML versions.

## Current capabilities

PixelForge currently includes canvas editing, layers and groups, common adjustments and filters, custom documents, image import, project saving, and PSD import/export support with known compatibility limitations for advanced Photoshop-only structures.

## Windows desktop

The Electron Windows installer is automatically built and published by GitHub Actions. See [DESKTOP.md](DESKTOP.md) for local builds, offline editing, the unsigned-installer notice, and the one-time Google sign-in deep-link setup (`pixelforge://auth/callback`).
