'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell, session } = require('electron');


// Desktop updates are managed by the packaged NSIS app, not the GitHub Pages build.
const fs = require('node:fs');
const { Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
let updateChecking = false;
let updateDownloading = false;
let updateReady = false;
let updateCheckedManually = false;
let updateInterval = null;
let desktopUpdateState={state:'idle',message:'Automatic update checks are available.',progress:0,availableVersion:null};
function currentUpdateStatus(){
  return {...desktopUpdateState,installedVersion:app.getVersion(),
    supported:app.isPackaged&&process.platform==='win32',
    autoCheck:updatePreferences.autoCheck,autoDownload:updatePreferences.autoDownload};
}
function reportUpdateStatus(patch){
  desktopUpdateState={...desktopUpdateState,...patch};
  if(mainWindow&&!mainWindow.isDestroyed()&&!mainWindow.webContents.isLoading()){
    mainWindow.webContents.send('pixelforge:update-status',currentUpdateStatus());
  }
}
const updatePreferencesPath = () => path.join(app.getPath('userData'), 'desktop-update-preferences.json');
const updatePreferences = {autoCheck: true, autoDownload: true};
function readUpdatePreferences() {
  try {
    const stored = JSON.parse(fs.readFileSync(updatePreferencesPath(), 'utf8'));
    if(typeof stored.autoCheck==='boolean')updatePreferences.autoCheck=stored.autoCheck;
    if(typeof stored.autoDownload==='boolean')updatePreferences.autoDownload=stored.autoDownload;
  } catch {}
}
function persistUpdatePreferences() {
  try {
    fs.mkdirSync(path.dirname(updatePreferencesPath()), {recursive: true});
    fs.writeFileSync(updatePreferencesPath(), JSON.stringify(updatePreferences));
  }catch(error){console.warn('Could not save update settings:',error.message);}
}
const updateDialog = (options) =>
  mainWindow&&!mainWindow.isDestroyed()
    ?dialog.showMessageBox(mainWindow,options)
    :dialog.showMessageBox(options);
function checkForDesktopUpdates(manual = false) {
  if(!app.isPackaged || process.platform!=='win32') {
    if(manual)updateDialog({type:'info',title:'PixelForge Updates',message:'Updates are available in installed Windows builds only.'});
    return;
  }
  if(updateChecking || updateDownloading) {
    if(manual)updateDialog({type:'info',title:'PixelForge Updates',message:'An update check or download is already running.'});
    return;
  }
  if(updateReady){
    if(manual)updateDialog({type:'info',title:'PixelForge update ready',
      message:'Your update will install when you close PixelForge.',
      detail:'No Windows restart is required. Save your documents, then close the app normally whenever you are ready.'});
    return;
  }
  updateChecking=true;
  updateCheckedManually=manual;
  reportUpdateStatus({state:'checking',message:'Checking for a new PixelForge version…',progress:0});
  Promise.resolve(autoUpdater.checkForUpdates()).catch(error=>{
    updateChecking=false;
    console.error('PixelForge update check failed:',error.message);
    reportUpdateStatus({state:'error',message:'Update check failed: '+String(error.message).slice(0,160)});
    if(updateCheckedManually)updateDialog({type:'error',title:'Update check failed',
      message:'Could not check for updates.',detail:String(error.message).slice(0,350)});
    updateCheckedManually=false;
  });
}
function setupDesktopUpdates() {
  readUpdatePreferences();
  const menu=Menu.buildFromTemplate([
    {label:'File',submenu:[
      {label:'Open from Computer…',accelerator:'CmdOrCtrl+O',click:()=>requestNativeOpen('open')},
      {label:'Place Image as Layer…',click:()=>requestNativeOpen('place')},
      {type:'separator'},
      {role:'quit',label:'Exit PixelForge'}]},
    {label:'Edit',submenu:[
      {role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},
      {role:'selectAll'}]},
    {label:'View',submenu:[
      {role:'togglefullscreen'},
      {role:'toggleDevTools',visible:!app.isPackaged}]},
    {label:'Updates',submenu:[
      {label:'Check for Updates…',click:()=>checkForDesktopUpdates(true)},
      {type:'separator'},
      {label:'Check automatically',type:'checkbox',checked:updatePreferences.autoCheck,
        click:item=>{updatePreferences.autoCheck=item.checked;persistUpdatePreferences();
          if(item.checked)checkForDesktopUpdates(false);}},
      {label:'Download updates automatically',type:'checkbox',checked:updatePreferences.autoDownload,
        click:item=>{updatePreferences.autoDownload=item.checked;persistUpdatePreferences();
          autoUpdater.autoDownload=item.checked;}},
      {type:'separator'},
      {label:'View official releases',click:()=>shell.openExternal('https://github.com/TheImposter1000/PixelForge/releases')}
    ]},
    {label:'Help',submenu:[
      {label:'About PixelForge Studio',click:()=>updateDialog({type:'info',title:'About PixelForge Studio',
        message:'PixelForge Studio '+app.getVersion(),detail:'Windows desktop edition'})}
    ]}
  ]);
  Menu.setApplicationMenu(menu);
  if(!app.isPackaged || process.platform!=='win32')return;
  autoUpdater.autoDownload=updatePreferences.autoDownload;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.allowPrerelease=false;
  autoUpdater.on('checking-for-update',()=>{
    updateChecking=true;
    reportUpdateStatus({state:'checking',message:'Checking for updates…'});
  });
  autoUpdater.on('update-not-available',()=>{
    updateChecking=false;
    reportUpdateStatus({state:'current',message:'PixelForge Studio is up to date.',progress:0});
    if(updateCheckedManually)updateDialog({type:'info',title:'PixelForge is up to date',
      message:'You are using the latest PixelForge Studio version ('+app.getVersion()+').'});
    updateCheckedManually=false;
  });
  autoUpdater.on('update-available',info=>{
    updateChecking=false;
    reportUpdateStatus({state:'available',availableVersion:info.version,
      message:'PixelForge '+info.version+' is available.',progress:0});
    const manual=updateCheckedManually;
    updateCheckedManually=false;
    if(!updatePreferences.autoDownload) {
      updateDialog({type:'question',title:'PixelForge update available',
        message:'Version '+info.version+' is available.',
        detail:'Download this update and install it without manually downloading a new EXE?',
        buttons:['Download Update','Not Now'],defaultId:0,cancelId:1}).then(({response})=>{
          if(response===0){
            updateDownloading=true;
            reportUpdateStatus({state:'downloading',message:'Downloading update '+info.version+'…',progress:0});
            autoUpdater.downloadUpdate().catch(error=>{
              updateDownloading=false;
              console.error('PixelForge update download failed:',error.message);
              reportUpdateStatus({state:'error',message:'Update download failed: '+String(error.message).slice(0,130)});
              updateDialog({type:'error',title:'Update failed',message:String(error.message).slice(0,250)});
            });
          }
        });
    } else {
      updateDownloading=true;
      reportUpdateStatus({state:'downloading',message:'Downloading update '+info.version+'…',progress:0});
      if(manual)console.info('PixelForge automatically downloading version',info.version);
    }
  });
  autoUpdater.on('download-progress',progress=>{
    updateDownloading=true;
    reportUpdateStatus({state:'downloading',progress:Math.min(100,Math.max(0,progress.percent)),
      message:'Downloading PixelForge update: '+Math.round(progress.percent)+'%'});
    if(mainWindow&&!mainWindow.isDestroyed()){
      mainWindow.setProgressBar(Math.min(1,progress.percent/100));
    }
  });
  autoUpdater.on('update-downloaded',()=>{
    updateChecking=false;updateDownloading=false;updateReady=true;
    autoUpdater.autoInstallOnAppQuit=true;
    reportUpdateStatus({state:'ready',progress:100,
      message:'Update ready. Save your work and close PixelForge to install. No computer restart.'});
    if(mainWindow&&!mainWindow.isDestroyed()){
      mainWindow.setProgressBar(-1);
      mainWindow.webContents.send('pixelforge:update-ready',
        'PixelForge update downloaded. It will install when you close the app. No Windows restart needed.');
    }
  });
  autoUpdater.on('error',error=>{
    const hadPendingUpdate=updateChecking||updateDownloading;
    updateChecking=false;updateDownloading=false;
    if(mainWindow&&!mainWindow.isDestroyed())mainWindow.setProgressBar(-1);
    console.error('PixelForge updater error:',error.message);
    reportUpdateStatus({state:'error',message:'Updater error: '+String(error.message).slice(0,150)});
    if(updateCheckedManually||hadPendingUpdate)
      updateDialog({type:'error',title:'PixelForge updater error',
        message:'An update could not be completed.',detail:String(error.message).slice(0,350)});
    updateCheckedManually=false;
  });
  if(updatePreferences.autoCheck){
    // Run only after the first application window is visible.
    mainWindow?.once('ready-to-show',()=>setTimeout(()=>checkForDesktopUpdates(false),6000));
  }
  updateInterval=setInterval(()=>{
    if(updatePreferences.autoCheck)checkForDesktopUpdates(false);
  },6*60*60*1000);
  updateInterval.unref?.();
}


const OPEN_FORMATS={
  open:{title:'Open images or PixelForge projects',filters:[
    {name:'Images and projects',extensions:['png','jpg','jpeg','webp','gif','bmp','svg','avif','psd','pforge','json']},
    {name:'PixelForge project',extensions:['pforge','json']},
    {name:'Photoshop PSD',extensions:['psd']},
    {name:'Images',extensions:['png','jpg','jpeg','webp','gif','bmp','svg','avif']}
  ]},
  place:{title:'Place images into the current document',filters:[
    {name:'Images',extensions:['png','jpg','jpeg','webp','gif','bmp','svg','avif']}
  ]},
  psd:{title:'Open Photoshop PSD',filters:[{name:'Photoshop PSD',extensions:['psd']}]},
  project:{title:'Open editable PixelForge project',filters:[{name:'PixelForge project',extensions:['pforge','json']}]}
};
const mimeByExtension={
  png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',
  gif:'image/gif',bmp:'image/bmp',svg:'image/svg+xml',avif:'image/avif',
  psd:'image/vnd.adobe.photoshop',pforge:'application/json',json:'application/json'
};
async function selectNativeFiles(kind='open'){
  const config=OPEN_FORMATS[kind];
  if(!config)throw new Error('Unknown file operation');
  if(!mainWindow||mainWindow.isDestroyed())return [];
  const result=await dialog.showOpenDialog(mainWindow,{
    title:config.title,
    properties:['openFile','multiSelections'],
    filters:config.filters
  });
  if(result.canceled)return [];
  const selected=[];
  for(const pathname of result.filePaths.slice(0,24)){
    const extension=path.extname(pathname).toLowerCase().replace(/^\./,'');
    if(!mimeByExtension[extension])throw new Error('Unsupported file type: '+extension);
    if(kind==='place'&&!mimeByExtension[extension].startsWith('image/'))
      throw new Error('Choose an image to place');
    if(kind==='psd'&&extension!=='psd')throw new Error('Select a PSD file');
    if(kind==='project'&&!['pforge','json'].includes(extension))throw new Error('Select a PixelForge project');
    const info=await fs.promises.stat(pathname);
    if(!info.isFile()||info.size>100*1024*1024)throw new Error('Files must be smaller than 100 MB.');
    const bytes=await fs.promises.readFile(pathname);
    selected.push({name:path.basename(pathname),type:mimeByExtension[extension],bytes:new Uint8Array(bytes)});
  }
  return selected;
}
function requestNativeOpen(kind='open'){
  if(mainWindow&&!mainWindow.isDestroyed())
    mainWindow.webContents.send('pixelforge:request-open',kind);
}

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
  ipcMain.handle('pixelforge:update-status',event=>{
    if(!mainWindow||event.sender!==mainWindow.webContents)throw new Error('Invalid update status request');
    return currentUpdateStatus();
  });
  ipcMain.handle('pixelforge:check-updates',event=>{
    if(!mainWindow||event.sender!==mainWindow.webContents)throw new Error('Invalid update request');
    checkForDesktopUpdates(true);
    return currentUpdateStatus();
  });
  ipcMain.handle('pixelforge:open-files', async (event,kind) => {
    if(!mainWindow||event.sender!==mainWindow.webContents)throw new Error('Invalid file request');
    return selectNativeFiles(kind);
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
        icon: path.join(__dirname,'icon.ico'),
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
    setupDesktopUpdates();
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
