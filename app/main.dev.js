/* eslint global-require: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 *
 * @flow
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import log from 'electron-log';
import { FOLDERPATH, AUTHPATH } from './constants/path';
import setupSocket from './main-process/webSocket';
import LocalVariable from './main-process/LocalVariable';
import SystemVariable from './main-process/SystemVariable';

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow = null;
let authWindow = null;
const localVariable = new LocalVariable();
const systemVariable = new SystemVariable();

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map(name => installer.default(installer[name], forceDownload))
  ).catch(console.log);
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1000,
    height: 600,
    minWidth: 800,
    minHeight: 480,
    webPreferences: {
      nodeIntegration: true,
      devTools: false
    }
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.setMenuBarVisibility(false);
  // const menuBuilder = new MenuBuilder(mainWindow);
  // menuBuilder.buildMenu();

  // mainWindow.webContents.closeDevTools();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  // new AppUpdater();
};

const createAuthWindow = async upper => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  authWindow = new BrowserWindow({
    show: false,
    width: 400,
    height: 540,
    minWidth: 400,
    minHeight: 540,
    maxWidth: 600,
    maxHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      devTools: false
    }
  });

  authWindow.loadURL(AUTHPATH, {
    userAgent: 'Chrome'
  });

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  authWindow.webContents.on('did-finish-load', () => {
    if (!authWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      authWindow.minimize();
    } else {
      authWindow.show();
      authWindow.focus();
    }
  });

  authWindow.on('closed', () => {
    authWindow = null;
  });

  authWindow.setMenuBarVisibility(false);

  authWindow.webContents.on('did-navigate', async function income() {
    const token = await authWindow.webContents
      .executeJavaScript(`document.querySelector('pre').innerText`, true)
      .then(result => {
        // console.log(result); // Will be the JSON object from the fetch call
        authWindow.close();
        return result;
      })
      .catch(() => {
        return null;
      });
    if (token !== null) {
      const parsed = JSON.parse(token);
      systemVariable.accessToken = parsed.accessToken;
      systemVariable.refreshToken = parsed.refreshToken;
      upper.webContents.send('sign-in-ok', parsed);
    }
    // More complex code to handle tokens goes here
  });

  authWindow.webContents.on('will-navigate', async function income() {
    const token = await authWindow.webContents
      .executeJavaScript(`document.querySelector('pre').innerText`, true)
      .then(result => {
        // console.log(result); // Will be the JSON object from the fetch call
        authWindow.close();
        return result;
      })
      .catch(() => {
        return null;
      });
    if (token !== null) {
      const parsed = JSON.parse(token);
      systemVariable.accessToken = parsed.accessToken;
      systemVariable.refreshToken = parsed.refreshToken;
      upper.webContents.send('sign-in-ok', parsed);
    }
    // More complex code to handle tokens goes here
  });
  mainWindow.setMenuBarVisibility(false);

  // const menuBuilder = new MenuBuilder(authWindow);
  // menuBuilder.buildMenu();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  // new AppUpdater();
};

/*
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('ready', () => {
  if (!fs.existsSync(FOLDERPATH)) {
    fs.mkdirSync(FOLDERPATH);
  }

  createWindow();
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});

/*
 *user request for login
 */
ipcMain.on('google-signIn', () => {
  createAuthWindow(mainWindow);
});

/*
 *setup stage after user login success
 */
ipcMain.on('dashboard-setup', () => {
  systemVariable.setMachinId();
  setupSocket(systemVariable, localVariable, mainWindow);
});

/*
 * user request data update within 20s
 */
ipcMain.handle('data-update-signal', async () => {
  const obj = await localVariable.checkLocalVariable(FOLDERPATH);
  console.log(obj);
  return obj;
});

/*
 *user request that change maximum settingsize
 */
ipcMain.handle('data-settingSize', async (event, arg) => {
  localVariable.settingSize = arg;
  const obj = await localVariable.checkLocalVariable(FOLDERPATH);
  return obj;
});
