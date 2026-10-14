'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell, session } = require('electron');

const SCHEME = 'pixelforge';
let mainWindow = null;
let pendingOAuthLink = null;

function isAuthCallback(value) {
  if (typeof value !== 'string' || value.length > 12000) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === SCHEME + ':' &&
      parsed.hostname === 'auth' && parsed.pathname === '/callback';
  } catch { return false; }
}

function isProviderAuthURL(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' &&
      /^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) &&
      parsed.pathname === '/auth/v1/authorize';
  } catch { return false; }
}

function deliverOAuthLink(value) {
  if (!isAuthCallback(value)) return;
  pendingOAuthLink = value;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('pixelforge:auth-callback', value);
  }
}

function parseCommandLine(commandLine) {
  const authURL = commandLine.find(arg => isAuthCallback(arg));
  if (authURL) deliverOAuthLink(authURL);
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(SCHEME);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => parseCommandLine(argv));
  app.on('open-url', (event, url) => {
    event.preventDefault();
    deliverOAuthLink(url);
  });

  ipcMain.handle('pixelforge:open-oauth', async (_event, url) => {
    if (!isProviderAuthURL(url)) throw new Error('Untrusted authentication URL blocked');
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle('pixelforge:pending-auth', () => {
    const value = pendingOAuthLink;
    pendingOAuthLink = null;
    return value;
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    const createWindow = () => {
      mainWindow = new BrowserWindow({
        width: 1440, height: 920, minWidth: 900, minHeight: 650,
        title: 'PixelForge Studio',
        backgroundColor: '#101118',
        show: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true
        }
      });
      mainWindow.once('ready-to-show', () => mainWindow.show());
      mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
      mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
        return {action:'deny'};
      });
      mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('file://')) {
          event.preventDefault(); // The installed application must not navigate to arbitrary files.
          return;
        }
        event.preventDefault();
        if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
      });
      mainWindow.webContents.session.on('will-download', (_event, item) => {
        item.setSaveDialogOptions({
          title: 'Save from PixelForge Studio',
          defaultPath: item.getFilename()
        });
      });
    };

    parseCommandLine(process.argv);
    createWindow();
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
