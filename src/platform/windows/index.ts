// Windows Platform Adapter

import { IPlatformAdapter } from '../index';
import { WindowsWindowManager } from './window-manager';
import { WindowsFileSystem } from './file-system';
import { WindowsApps } from './apps';
import { WindowsSystem } from './system';
import { WindowsProcess } from './process';
import { WindowsNetwork } from './network';
import { WindowsServices } from './services';
import { windowsWiFi } from './wifi';
import { windowsMedia } from './media';
import { windowsBrowser } from './browser';
import { windowsEmail } from './email';
import { windowsOcr } from './ocr';

const windowsAdapter: IPlatformAdapter = {
  platform: 'windows',
  windowManager: new WindowsWindowManager(),
  fileSystem: new WindowsFileSystem(),
  apps: new WindowsApps(),
  system: new WindowsSystem(),
  process: new WindowsProcess(),
  network: new WindowsNetwork(),
  services: new WindowsServices(),
  wifi: windowsWiFi,
  media: windowsMedia,
  browser: windowsBrowser,
  email: windowsEmail,
  ocr: windowsOcr,
};

export default windowsAdapter;
