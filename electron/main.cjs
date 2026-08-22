const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "App Restaurante",
    // Use o ícone se existir, caso contrário Electron usa o padrão
    icon: require('fs').existsSync(path.join(__dirname, '../public/icon-512.png')) 
      ? path.join(__dirname, '../public/icon-512.png') 
      : undefined
  });

  // Remove menu padrão
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    // No desenvolvimento, aponta para o servidor do Vite
    // Adicionamos o fragmento da rota desejada
    mainWindow.loadURL('http://localhost:3000/app-restaurante');
  } else {
    // No build, carrega o arquivo local
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    
    // Após carregar, podemos tentar forçar a navegação via script se necessário
    // Mas para o build final, o roteamento deve ser tratado no frontend
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript('window.location.hash = "/app-restaurante"');
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
