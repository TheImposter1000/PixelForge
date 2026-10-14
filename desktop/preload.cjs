'use strict';

const {contextBridge, ipcRenderer} = require('electron');

let authCallbackHandler = null;
let pendingCallback = null;
ipcRenderer.on('pixelforge:auth-callback', (_event, url) => {
  if (typeof url !== 'string') return;
  if (authCallbackHandler) authCallbackHandler(url);
  else pendingCallback = url;
});

contextBridge.exposeInMainWorld('pixelforgeDesktop', Object.freeze({
  isDesktop: true,
  openOAuth: url => ipcRenderer.invoke('pixelforge:open-oauth', url),
  onAuthCallback: handler => {
    if (typeof handler !== 'function') return;
    authCallbackHandler = handler;
    if (pendingCallback) {
      const url = pendingCallback;
      pendingCallback = null;
      handler(url);
    }
    ipcRenderer.invoke('pixelforge:pending-auth').then(url => {
      if (url) handler(url);
    }).catch(() => {});
  }
}));
