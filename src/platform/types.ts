// Shared Platform Types

export interface ScreenInfo {
  width: number;
  height: number;
  x: number;
  y: number;
  scaleFactor: number;
  primary: boolean;
}

export interface NativeWindowInfo {
  handle: number;
  title: string;
  className: string;
  processId: number;
  processName: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
}

export interface RunningProcess {
  pid: number;
  name: string;
  path?: string;
  cpuUsage: number;
  memoryUsage: number;
  status: 'running' | 'sleeping' | 'stopped' | 'zombie';
}

export interface InstalledApp {
  name: string;
  displayName: string;
  path: string;
  version?: string;
  publisher?: string;
  installDate?: Date;
}

export interface PowerPointSlide {
  layout: 'title' | 'content' | 'blank' | 'titleOnly';
  title?: string;
  subtitle?: string;
  content?: string;
}
