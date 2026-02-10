// IPC Handlers for Main Process

import { ipcMain, clipboard, shell, dialog, app, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execAsync = promisify(exec);

import { IPC_CHANNELS, ScheduledTask, Timer, ActionLog, Recording, RecordingType } from '../shared/types';
import { MCP_IPC_CHANNELS, MCPServerConfig } from '../shared/mcp-types';
import { getSettings, setSettings, getHistory, addToHistory, clearHistory, getMcpServers, addMcpServer, updateMcpServer, deleteMcpServer, toggleMcpServer, getScheduledTasks, addScheduledTask, updateScheduledTask, deleteScheduledTask, getTaskLogs } from './store';
import { getAppSetting, setAppSetting, deleteAppSetting } from './database';
import { hideCommandWindow, showCommandWindow, resizeCommandWindow, minimizeCommandWindow, maximizeCommandWindow, fitWindowToScreen, getCommandWindow, setAutoHideSuppressed, startAudioCapture, stopAudioCapture, handleAudioCaptureReady, handleAudioCaptureError, markAudioCaptureWindowReady } from './windows';
import { screenSharePrivacyService } from './screen-share-privacy';
import { screenShareDetector } from './screen-share-detector';
import { InvisiwindWrapper } from '../platform/windows/invisiwind';
import { updateHotkey, registerVoiceHotkey, unregisterVoiceHotkey } from './hotkeys';
import { updateTrayMenu } from './tray';
import { getPlatformAdapter } from '../platform';
import { copilotController } from '../copilot/client';
import { cancelAllPendingPermissions, handlePermissionResponse } from './permission-gate';
import { taskScheduler } from './scheduler';
import { voiceInputManager } from './voice-input';
import { timerManager } from './timers';
import { reminderManager } from './reminders';
import { contextCaptureService } from './context-capture';
import { IntentRouter } from '../intent/router';
import { RouteResult } from '../intent/types';
import { detectSkillIdFromMessage } from '../intent/skill-intents';
import { getSkillIndex, refreshSkillIndex } from './skills-registry';
import { clipboardMonitor } from './clipboard-monitor';
import { saveUserMessage, saveAssistantMessage, getConversationHistory, getAllConversations, loadConversation, deleteConversation } from './chat-history';
import { recordingManager } from './recording-manager';
import { createNote, getNote, listNotes, updateNote, deleteNote, searchNotes } from './notes';
import { createTodo, listTodos, completeTodo, deleteTodo } from './todos';
import { speak, stopSpeaking, listVoices } from '../platform/windows/tts';
import { runPowerShell } from '../platform/windows/powershell-pool';

// Initialize intent router
const intentRouter = new IntentRouter();
let intentRouterInitialized = false;

// Initialize intent router on first use
async function ensureIntentRouterInitialized() {
  if (!intentRouterInitialized) {
    await intentRouter.initialize();
    intentRouterInitialized = true;
  }
}

// Helper: Transcribe with OpenAI Whisper API
async function transcribeWithOpenAI(audioBuffer: Buffer, language: string, settings: any): Promise<{ success: boolean; transcript?: string; error?: string }> {
  const apiKey = getAppSetting('openai_whisper_api_key');
  
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'OpenAI API key not configured. Please add your API key in Settings -> Voice.' };
  }

  const model = settings.voiceInput.openaiWhisper?.model || 'whisper-1';

  try {
    // Create form data (multipart/form-data)
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });
    form.append('model', model);
    form.append('language', language);

    // Make request to OpenAI API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `OpenAI API error: ${response.status} ${errorText}` };
    }

    const result = await response.json() as { text: string };
    let transcript = result.text?.trim();
    
    // Filter out Whisper artifacts
    if (transcript) {
      transcript = transcript
        .replace(/\[BLANK_AUDIO\]/g, '')
        .replace(/\(speaking in foreign language\)/gi, '')
        .trim();
    }

    if (!transcript) {
      return { success: false, error: 'OpenAI API returned empty transcript.' };
    }

    return { success: true, transcript };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

// Whisper.cpp binary and model paths
const WHISPER_DIR = () => path.join(app.getPath('userData'), 'whisper');
const WHISPER_BIN = () => path.join(WHISPER_DIR(), 'whisper-cli.exe');  // Updated from main.exe
const WHISPER_MODELS_DIR = () => path.join(WHISPER_DIR(), 'models');

// FFmpeg paths
const FFMPEG_DIR = () => path.join(app.getPath('userData'), 'ffmpeg');
const FFMPEG_BIN = () => path.join(FFMPEG_DIR(), 'ffmpeg.exe');

// Model URLs from Hugging Face
const MODEL_URLS: Record<string, string> = {
  'tiny': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  'base': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  'small': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  'medium': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  'large': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
};

// Whisper.cpp Windows binary URL (pre-built) - repo moved to ggml-org
const WHISPER_BIN_URL = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip';

// FFmpeg static build URL (gyan.dev provides lightweight static builds)
const FFMPEG_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

// Download file helper with redirect support
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fsSync.createWriteStream(destPath);

    const download = (downloadUrl: string) => {
      https.get(downloadUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            download(redirectUrl);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fsSync.unlink(destPath, () => {});
        reject(err);
      });
    };

    download(url);
  });
}

// Extract zip file (Windows)
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await runPowerShell(`Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`);
}

// Ensure whisper binary is available
async function ensureWhisperBinary(): Promise<string> {
  const binPath = WHISPER_BIN();
  const whisperDir = WHISPER_DIR();

  // Check if binary exists
  if (fsSync.existsSync(binPath)) {
    return binPath;
  }

  console.log('Downloading whisper.cpp binary...');

  // Create directory
  await fs.mkdir(whisperDir, { recursive: true });

  // Download zip
  const zipPath = path.join(whisperDir, 'whisper-bin.zip');
  await downloadFile(WHISPER_BIN_URL, zipPath);

  // Extract
  await extractZip(zipPath, whisperDir);

  // Clean up zip
  await fs.unlink(zipPath).catch(() => {});

  // Find the Release folder (new structure in v1.8+)
  const releaseDir = path.join(whisperDir, 'Release');
  
  // Log what we found for debugging
  try {
    const files = fsSync.existsSync(releaseDir) ? fsSync.readdirSync(releaseDir) : [];
    console.log('Files in Release dir:', files);
    
    // Copy all necessary files from Release folder to whisper folder
    if (fsSync.existsSync(releaseDir)) {
      for (const file of files) {
        const srcPath = path.join(releaseDir, file);
        const destPath = path.join(whisperDir, file);
        // Copy all .exe and .dll files
        if (file.endsWith('.exe') || file.endsWith('.dll')) {
          console.log(`Copying ${file}...`);
          await fs.copyFile(srcPath, destPath);
        }
      }
    }
  } catch (err) {
    console.error('Error copying whisper files:', err);
  }

  if (!fsSync.existsSync(binPath)) {
    throw new Error('Failed to extract whisper binary');
  }

  return binPath;
}

// Ensure model is downloaded
async function ensureWhisperModel(modelSize: string): Promise<string> {
  const modelsDir = WHISPER_MODELS_DIR();
  const modelPath = path.join(modelsDir, `ggml-${modelSize}.bin`);

  // Check if model exists
  if (fsSync.existsSync(modelPath)) {
    return modelPath;
  }

  const modelUrl = MODEL_URLS[modelSize];
  if (!modelUrl) {
    throw new Error(`Unknown model size: ${modelSize}`);
  }

  console.log(`Downloading whisper model (${modelSize})... This may take a while.`);

  // Create directory
  await fs.mkdir(modelsDir, { recursive: true });

  // Download model
  await downloadFile(modelUrl, modelPath);

  return modelPath;
}

// Helper: Ensure FFmpeg binary is available
async function ensureFFmpeg(): Promise<string> {
  const ffmpegPath = FFMPEG_BIN();
  
  if (fsSync.existsSync(ffmpegPath)) {
    return ffmpegPath;
  }
  
  console.log('Downloading FFmpeg binary...');
  
  const ffmpegDir = FFMPEG_DIR();
  await fs.mkdir(ffmpegDir, { recursive: true });
  
  const zipPath = path.join(ffmpegDir, 'ffmpeg.zip');
  await downloadFile(FFMPEG_URL, zipPath);
  
  // Extract using PowerShell
  await extractZip(zipPath, ffmpegDir);
  
  // Find ffmpeg.exe in the extracted folder (it's in a subfolder like ffmpeg-master-latest-win64-gpl/bin/)
  const findFfmpeg = async (dir: string): Promise<string | null> => {
    const entries = fsSync.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await findFfmpeg(fullPath);
        if (found) return found;
      } else if (entry.name === 'ffmpeg.exe') {
        return fullPath;
      }
    }
    return null;
  };
  
  const foundExe = await findFfmpeg(ffmpegDir);
  if (foundExe && foundExe !== ffmpegPath) {
    console.log('Found ffmpeg.exe at:', foundExe);
    await fs.copyFile(foundExe, ffmpegPath);
  }
  
  // Cleanup zip
  await fs.unlink(zipPath).catch(() => {});
  
  if (!fsSync.existsSync(ffmpegPath)) {
    throw new Error('Failed to extract FFmpeg');
  }
  
  console.log('FFmpeg installed at:', ffmpegPath);
  return ffmpegPath;
}

// Helper: Convert WebM to WAV using FFmpeg
async function convertWebmToWav(inputPath: string, outputPath: string): Promise<void> {
  const ffmpegPath = await ensureFFmpeg();
  
  // Convert to 16kHz mono WAV (optimal for whisper)
  const cmd = `"${ffmpegPath}" -y -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`;
  console.log('Converting audio:', cmd);
  
  await execAsync(cmd, { timeout: 30000 });
}

// Helper: Transcribe with Local Whisper (whisper.cpp binary)
async function transcribeWithLocalWhisper(audioBuffer: Buffer, language: string, settings: any): Promise<{ success: boolean; transcript?: string; error?: string }> {
  const modelSize = settings.voiceInput?.localWhisper?.modelSize || 'base';

  try {
    // Ensure binary and model are available
    const binPath = await ensureWhisperBinary();
    const modelPath = await ensureWhisperModel(modelSize);

    const tempDir = app.getPath('temp');
    const timestamp = Date.now();
    
    // Check for WebM magic bytes (0x1A 0x45 0xDF 0xA3)
    const isWebM = audioBuffer[0] === 0x1A && audioBuffer[1] === 0x45 && audioBuffer[2] === 0xDF && audioBuffer[3] === 0xA3;
    
    let wavPath: string;
    let tempWebmPath: string | null = null;
    
    if (isWebM) {
      console.log('Detected WebM audio format, converting to WAV...');
      tempWebmPath = path.join(tempDir, `whisper-input-${timestamp}.webm`);
      wavPath = path.join(tempDir, `whisper-input-${timestamp}.wav`);
      
      await fs.writeFile(tempWebmPath, audioBuffer);
      console.log(`Wrote ${audioBuffer.length} bytes to ${tempWebmPath}`);
      
      // Convert WebM to WAV using FFmpeg
      await convertWebmToWav(tempWebmPath, wavPath);
      console.log('Converted to WAV:', wavPath);
    } else {
      // Assume it's already WAV
      wavPath = path.join(tempDir, `whisper-input-${timestamp}.wav`);
      await fs.writeFile(wavPath, audioBuffer);
      console.log(`Wrote ${audioBuffer.length} bytes to ${wavPath}`);
    }

    try {
      // Build command
      const langArg = language && language !== 'auto' ? `-l ${language}` : '';
      const cmd = `"${binPath}" -m "${modelPath}" -f "${wavPath}" ${langArg} -np -nt`;

      console.log('Running whisper command:', cmd);

      // Run whisper
      const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });

      if (stderr && !stdout) {
        console.error('Whisper stderr:', stderr);
      }

      // Parse output - whisper outputs text directly
      let transcript = stdout.trim();
      
      // Filter out Whisper artifacts
      transcript = transcript
        .replace(/\[BLANK_AUDIO\]/g, '')
        .replace(/\(speaking in foreign language\)/gi, '')
        .trim();

      if (!transcript) {
        return { success: false, error: 'No speech detected or transcription failed.' };
      }

      return { success: true, transcript };
    } finally {
      // Clean up temp files
      await fs.unlink(wavPath).catch(() => {});
      if (tempWebmPath) {
        await fs.unlink(tempWebmPath).catch(() => {});
      }
    }
  } catch (error: any) {
    console.error('Local Whisper transcription error:', error);

    // Provide helpful error messages
    if (error?.message?.includes('ENOENT')) {
      return { success: false, error: 'Whisper binary not found. It will be downloaded on next attempt.' };
    }
    if (error?.message?.includes('timeout')) {
      return { success: false, error: 'Transcription timed out. Try a smaller model or shorter audio.' };
    }

    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Setup all IPC handlers
 */
export function setupIpcHandlers(): void {
  const platform = getPlatformAdapter();
  const invisiwind = new InvisiwindWrapper();

  // App control handlers
  ipcMain.handle('app:getSettings', () => getSettings());
  
  ipcMain.handle('app:setSettings', async (_event: Electron.IpcMainInvokeEvent, settings) => {
    const updated = setSettings(settings);

    // Update hotkey if changed
    if (settings.hotkey) {
      updateHotkey(settings.hotkey);
    }

    // Update voice hotkey if voice input settings changed
    if (settings.voiceInput) {
      if (settings.voiceInput.enabled) {
        registerVoiceHotkey();
      } else {
        unregisterVoiceHotkey();
      }
    }

    // Update screen share detector if settings changed
    if (settings.screenSharePrivacy !== undefined) {
      if (settings.screenSharePrivacy.enabled) {
        screenShareDetector.start();
      } else {
        screenShareDetector.stop();
      }
    }

    // Update tray menu
    updateTrayMenu();

    // Broadcast settings update to renderer
    const window = getCommandWindow();
    window?.webContents.send(IPC_CHANNELS.APP_SETTINGS_UPDATED, updated);

    return updated;
  });

  ipcMain.handle('app:getHistory', () => getHistory());
  ipcMain.handle('app:clearHistory', () => clearHistory());

  ipcMain.on('app:hide', (event: Electron.IpcMainEvent) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const commandWindow = getCommandWindow();
    if (commandWindow && senderWindow === commandWindow) {
      hideCommandWindow();
      return;
    }
    senderWindow?.hide();
  });
  ipcMain.on('app:show', () => showCommandWindow());
  ipcMain.handle('app:autoHideSuppressed', (_event, value: boolean) => {
    setAutoHideSuppressed(Boolean(value));
    return true;
  });
  ipcMain.on('app:resize', (_event: Electron.IpcMainEvent, height: number) => resizeCommandWindow(height));

  // Window control handlers
  ipcMain.on('app:window:minimize', () => minimizeCommandWindow());
  ipcMain.on('app:window:maximize', () => maximizeCommandWindow());
  ipcMain.on('app:window:fitToScreen', () => fitWindowToScreen());

  // Window management handlers
  ipcMain.handle(IPC_CHANNELS.WINDOW_LIST, async () => {
    return platform.windowManager.listWindows();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_FOCUS, async (_, params) => {
    return platform.windowManager.focusWindow(params);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MOVE, async (_, params) => {
    return platform.windowManager.moveWindow(params);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (_, params) => {
    return platform.windowManager.closeWindow(params);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (_, windowId) => {
    return platform.windowManager.minimizeWindow(windowId);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async (_, windowId) => {
    return platform.windowManager.maximizeWindow(windowId);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_ARRANGE, async (_, params) => {
    return platform.windowManager.arrangeWindows(params);
  });

  // Screen share privacy handlers
  ipcMain.handle(IPC_CHANNELS.SCREEN_SHARE_PRIVACY_LIST_WINDOWS, async () => {
    return platform.windowManager.listWindows();
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_SHARE_PRIVACY_LIST_HIDDEN, () => {
    return screenSharePrivacyService.listHiddenWindows();
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_SHARE_PRIVACY_HIDE, async (_event, params: { windowId?: string }) => {
    const windows = await platform.windowManager.listWindows();
    const target = windows.find(w => w.id === params.windowId);
    if (!target) {
      return { success: false, error: 'Window not found' };
    }
    if (target.app.toLowerCase() === 'winpilot' || target.app.toLowerCase() === 'electron') {
      return { success: false, error: 'Refusing to hide Desktop Commander window.' };
    }
    const result = await invisiwind.hideWindowsByPid(target.processId);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    screenSharePrivacyService.addHiddenWindow({
      hwnd: target.id,
      pid: target.processId,
      title: target.title,
      appName: target.app,
      hiddenAt: Date.now(),
    });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_SHARE_PRIVACY_SHOW, async (_event, params: { windowId?: string; all?: boolean }) => {
    if (params.all) {
      const hidden = screenSharePrivacyService.listHiddenWindows();
      for (const entry of hidden) {
        await invisiwind.unhideWindowsByPid(entry.pid);
      }
      screenSharePrivacyService.clear();
      return { success: true };
    }

    const windows = await platform.windowManager.listWindows();
    const target = windows.find(w => w.id === params.windowId);
    if (!target) {
      const hiddenEntries = screenSharePrivacyService.listHiddenWindows();
      const fallback = hiddenEntries.find(entry => entry.hwnd === params.windowId);
      if (fallback) {
        const result = await invisiwind.unhideWindowsByPid(fallback.pid);
        if (!result.success) {
          return { success: false, error: result.error };
        }
        screenSharePrivacyService.removeHiddenWindowsByPid(fallback.pid);
        return { success: true };
      }
      return { success: false, error: 'Window not found' };
    }
    const result = await invisiwind.unhideWindowsByPid(target.processId);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    screenSharePrivacyService.removeHiddenWindowsByPid(target.processId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_SHARE_PRIVACY_GET_AUTO_HIDE, () => {
    return getSettings().screenSharePrivacy?.autoHideOnShare ?? true;
  });

  ipcMain.handle(IPC_CHANNELS.SCREEN_SHARE_PRIVACY_SET_AUTO_HIDE, (_event, value: boolean) => {
    const settings = getSettings();
    const updated = setSettings({
      ...settings,
      screenSharePrivacy: {
        ...(settings.screenSharePrivacy || {}),
        autoHideOnShare: Boolean(value),
      },
    });
    return updated.screenSharePrivacy?.autoHideOnShare ?? true;
  });

  // File system handlers
  ipcMain.handle(IPC_CHANNELS.FILES_LIST, async (_, params) => {
    return platform.fileSystem.listFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_SEARCH, async (_, params) => {
    return platform.fileSystem.searchFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_MOVE, async (_, params) => {
    return platform.fileSystem.moveFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_COPY, async (_, params) => {
    return platform.fileSystem.copyFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_DELETE, async (_, params) => {
    return platform.fileSystem.deleteFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_RENAME, async (_, params) => {
    return platform.fileSystem.renameFile(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_CREATE_FOLDER, async (_, path) => {
    return platform.fileSystem.createFolder(path);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_READ, async (_, params) => {
    return platform.fileSystem.readFile(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_INFO, async (_, path) => {
    return platform.fileSystem.getFileInfo(path);
  });

  // Application handlers
  ipcMain.handle(IPC_CHANNELS.APPS_LIST, async (_, filter) => {
    return platform.apps.listApps(filter);
  });

  ipcMain.handle(IPC_CHANNELS.APPS_LAUNCH, async (_, params) => {
    return platform.apps.launchApp(params);
  });

  ipcMain.handle(IPC_CHANNELS.APPS_QUIT, async (_, params) => {
    return platform.apps.quitApp(params);
  });

  ipcMain.handle(IPC_CHANNELS.APPS_SWITCH, async (_, name) => {
    return platform.apps.switchToApp(name);
  });

  // System control handlers
  ipcMain.handle(IPC_CHANNELS.SYSTEM_VOLUME, async (_, params) => {
    return platform.system.volume(params);
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_BRIGHTNESS, async (_, params) => {
    return platform.system.brightness(params);
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SCREENSHOT, async (_, params) => {
    return platform.system.screenshot(params);
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_DND, async (_, params) => {
    return platform.system.doNotDisturb(params);
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_LOCK, async () => {
    return platform.system.lockScreen();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SLEEP, async () => {
    return platform.system.sleep();
  });

  // Process handlers
  ipcMain.handle(IPC_CHANNELS.PROCESS_LIST, async (_, params) => {
    return platform.process.listProcesses(params);
  });

  ipcMain.handle(IPC_CHANNELS.PROCESS_INFO, async (_, params) => {
    return platform.process.getProcessInfo(params);
  });

  ipcMain.handle(IPC_CHANNELS.PROCESS_KILL, async (_, params) => {
    return platform.process.killProcess(params);
  });

  ipcMain.handle(IPC_CHANNELS.PROCESS_TOP, async (_, params) => {
    return platform.process.getTopProcesses(params);
  });

  // Clipboard handlers
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_READ, async (_, format) => {
    switch (format) {
      case 'html':
        return clipboard.readHTML();
      case 'image':
        return clipboard.readImage().toDataURL();
      default:
        return clipboard.readText();
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE, async (_, { content, format }) => {
    if (format === 'html') {
      clipboard.writeHTML(content);
    } else {
      clipboard.writeText(content);
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CLEAR, async () => {
    clipboard.clear();
    return true;
  });

  // Clipboard history handlers
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_GET, () => {
    return clipboardMonitor.getHistory();
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_DELETE, (_, id: string) => {
    return clipboardMonitor.deleteEntry(id);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_CLEAR, () => {
    clipboardMonitor.clearHistory();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_PIN, (_, id: string) => {
    return clipboardMonitor.togglePin(id);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_RESTORE, (_, id: string) => {
    return clipboardMonitor.restoreToClipboard(id);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_SEARCH, (_, query: string) => {
    return clipboardMonitor.searchHistory(query);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_GET_IMAGE, async (_, imagePath: string) => {
    return clipboardMonitor.getImageDataUrl(imagePath);
  });

  // Clipboard paste with auto-paste (supports text, image, and files)
  ipcMain.handle('clipboard:pasteItem', async (_event, entryId: string) => {
    try {
      console.log('[Paste] Starting paste operation for entry:', entryId);
      const { getPlatformAdapter } = await import('../platform');
      const adapter = getPlatformAdapter();

      // 0. Use captured foreground window handle from when clipboard was opened
      const { getPreviousForegroundWindowHandle } = await import('./windows');
      const foregroundHwnd = getPreviousForegroundWindowHandle();
      console.log('[Paste] Stored foreground window handle:', foregroundHwnd);

      // 1. Restore entry to system clipboard
      const restored = clipboardMonitor.restoreToClipboard(entryId);
      if (!restored) {
        return { success: false, error: 'Failed to restore clipboard entry' };
      }
      console.log('[Paste] Entry restored to clipboard');

      // 2. Hide clipboard window
      const { hideClipboardHistoryWindow } = await import('./windows');
      await hideClipboardHistoryWindow();
      console.log('[Paste] Clipboard window hidden');

      // 3. Restore focus to the original foreground window
      if (foregroundHwnd && foregroundHwnd !== 0) {
        await adapter.system.setForegroundWindow(foregroundHwnd);
        console.log('[Paste] Restored focus to window:', foregroundHwnd);

        // 4. Wait for focus to settle
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        console.log('[Paste] No valid foreground window, waiting for OS to restore focus...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('[Paste] About to simulate paste...');

      // 5. Simulate Ctrl+V paste (also sets foreground inside script)
      const success = await adapter.system.simulatePaste(foregroundHwnd ?? undefined);
      console.log('[Paste] Paste simulation result:', success);

      return { success };
    } catch (error) {
      console.error('[Paste] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Copilot handlers
  ipcMain.handle(IPC_CHANNELS.COPILOT_SEND_MESSAGE, async (event, message: string) => {
    const sender = event.sender;

    console.log('[IPC] Received message:', message);

    // Inject context if enabled and available
    const settings = getSettings();
    let contextualMessage = message;

    if (settings.contextAwareness?.enabled) {
      const context = contextCaptureService.getContext();

      if (context) {
        if (settings.contextAwareness.injectionStyle === 'visible') {
          // Visible: prepend to user message (editable)
          const contextPrefix = `[Context: Working in "${context.appName}" - "${context.windowTitle}"]`;

          if (context.selectedText) {
            contextualMessage = `${contextPrefix}\nSelected text: ${context.selectedText}\n\n${message}`;
          } else {
            contextualMessage = `${contextPrefix}\n\n${message}`;
          }
        }
        // Hidden injection would be handled in copilot/client.ts getSystemPrompt()
        // This is a future enhancement
      }
    }

    // Add to history
    addToHistory(contextualMessage);
    saveUserMessage(contextualMessage);

    try {
      let assistantResponse = '';
      let didEnd = false;
      let streamError: string | null = null;
      let routeResult: RouteResult = { handled: false, reason: 'Intent router not ready' };

      // Pause screen share detector polling during processing (prevents log spam during window/process operations)
      screenShareDetector.pause();

      try {
        // Ensure intent router is initialized (once) before routing
        await ensureIntentRouterInitialized();

        // Try intent-based routing first (Tier 1 & 2)
        console.log('[IPC] Attempting intent-based routing...');
        routeResult = await intentRouter.route(contextualMessage);
      } finally {
        screenShareDetector.resume();
      }

      if (routeResult.handled) {
        // Local execution successful - stream result and end
        console.log('[IPC] Intent routing handled locally', {
          tier: routeResult.tier,
          tool: routeResult.toolName,
          confidence: routeResult.confidence?.toFixed(2),
        });

        if (!sender.isDestroyed()) {
          sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, routeResult.response);
          sender.send(IPC_CHANNELS.COPILOT_STREAM_END);
        }
        if (routeResult.response) {
          saveAssistantMessage(routeResult.response);
        }
        return;
      }

      // Fall back to LLM for complex queries
      console.log('[IPC] Falling back to LLM', { reason: routeResult.reason });

      const skillId = routeResult.skillId || detectSkillIdFromMessage(contextualMessage);
      let skillWarning: string | null = null;
      if (skillId) {
        console.log('[IPC] Skill intent detected, setting active skill context', { skillId });
        const skillSet = copilotController.setActiveSkill(skillId);
        if (!skillSet) {
          console.log('[IPC] Skill context not set (missing SKILL.md?)', { skillId });
          skillWarning = `[System: Skill instructions for "${skillId}" were not found. Proceed with available tools and explain if setup is required.]`;
        }
      }

      // If a tool was attempted but failed, enrich the message with failure context
      // so the LLM can reason about an alternative approach
      let llmMessage = contextualMessage;
      if (skillWarning) {
        llmMessage = `${skillWarning}\n\n${llmMessage}`;
      }
      if (routeResult.failedToolName && routeResult.failedError) {
        console.log('[IPC] Including tool failure context for LLM', {
          failedTool: routeResult.failedToolName,
          tier: routeResult.originalTier,
        });
        llmMessage = `[System: The tool "${routeResult.failedToolName}" was automatically attempted for this request but failed with: "${routeResult.failedError}". Please try an alternative approach or explain the issue to the user.]\n\nUser request: ${contextualMessage}`;
      }

      console.log('[IPC] Starting sendMessageWithLoop generator...');

      // Ensure tool execution can request permissions from the active window.
      copilotController.setActiveWebContents(sender);

      // Pause screen share detector during LLM processing
      screenShareDetector.pause();

      try {
        // Use dual-session routing: GPT-4o-mini for tool selection, GPT-4o for reasoning
        for await (const streamEvent of copilotController.sendWithToolRouting(llmMessage)) {
          // Check if sender is still valid before sending
          if (sender.isDestroyed()) {
            console.log('[IPC] Sender destroyed, stopping stream');
            return;
          }
          console.log('[IPC] Stream event:', streamEvent.type, streamEvent.content?.substring(0, 50));
          switch (streamEvent.type) {
            case 'text':
              if (streamEvent.content) {
                assistantResponse += streamEvent.content;
              }
              sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, streamEvent.content);
              break;
            case 'tool_call': {
              // Show tool execution inline as a collapsible block
              const toolLabel = (streamEvent.toolName || 'tool').replace(/_/g, ' ');
              const toolChunk = `\n<!--tool:start:${toolLabel}-->\n`;
              assistantResponse += toolChunk;
              sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, toolChunk);
              break;
            }
            case 'tool_result': {
              // Close the collapsible tool block with status
              const resultIcon = streamEvent.content?.startsWith('✅') ? '✅' : '❌';
              const resultChunk = `<!--tool:end:${resultIcon}-->\n`;
              assistantResponse += resultChunk;
              sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, resultChunk);
              break;
            }
            case 'iteration_start':
              if (streamEvent.content) {
                assistantResponse += streamEvent.content;
              }
              sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, streamEvent.content || '');
              break;
            case 'iteration_complete':
              // Just log, no need to send to UI unless we want progress indicators
              console.log('[IPC] Iteration complete:', streamEvent.iterationNumber);
              break;
            case 'loop_complete':
              if (streamEvent.content) {
                assistantResponse += streamEvent.content;
              }
              sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, streamEvent.content);
              break;
            case 'error':
              console.error('[IPC] Stream error:', streamEvent.error);
              if (!sender.isDestroyed()) {
                sender.send(IPC_CHANNELS.COPILOT_STREAM_END, { error: streamEvent.error });
              }
              streamError = streamEvent.error ?? 'Unknown error';
              didEnd = true;
              break;
            case 'done':
              console.log('[IPC] Stream done');
              if (!sender.isDestroyed()) {
                sender.send(IPC_CHANNELS.COPILOT_STREAM_END);
              }
              didEnd = true;
              break;
          }
          if (didEnd) {
            break;
          }
        }
      } finally {
        screenShareDetector.resume();
      }
      console.log('[IPC] Generator exhausted');
      if (!didEnd && !sender.isDestroyed()) {
        sender.send(IPC_CHANNELS.COPILOT_STREAM_END);
      }
      if (!streamError && assistantResponse.trim()) {
        saveAssistantMessage(assistantResponse.trim());
      }
    } catch (error) {
      console.error('Copilot error:', error);
      if (!sender.isDestroyed()) {
        sender.send(IPC_CHANNELS.COPILOT_STREAM_END, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } finally {
      cancelAllPendingPermissions();
      copilotController.setActiveWebContents(null);
    }
  });

  ipcMain.handle(IPC_CHANNELS.COPILOT_CANCEL, async () => {
    cancelAllPendingPermissions();
    await copilotController.cancel();
  });

  ipcMain.handle(IPC_CHANNELS.COPILOT_CLEAR_SESSION, async () => {
    await copilotController.clearHistory();
    contextCaptureService.clearContext();
  });

  // Context awareness handlers
  ipcMain.handle(IPC_CHANNELS.CONTEXT_GET, () => {
    return contextCaptureService.getContext();
  });

  ipcMain.handle(IPC_CHANNELS.CONTEXT_CLEAR, () => {
    contextCaptureService.clearContext();
  });

  // Permission handlers
  ipcMain.on(IPC_CHANNELS.APP_PERMISSION_RESPONSE, (_event: Electron.IpcMainEvent, response: unknown) => {
    handlePermissionResponse(response as import('../shared/types').PermissionResponse);
  });

  // Shell handlers
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    // Validate URL protocol to prevent arbitrary protocol execution
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http and https URLs are allowed');
    }
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:openPath', async (_, path: string) => {
    // Block dangerous executable file types
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.ps1', '.vbs', '.vbe', '.js', '.jse',
      '.ws', '.wsf', '.wsc', '.wsh', '.msc', '.msi', '.msp', '.com',
      '.scr', '.hta', '.cpl', '.jar', '.reg'
    ];
    const ext = path.toLowerCase().slice(path.lastIndexOf('.'));
    if (dangerousExtensions.includes(ext)) {
      throw new Error(`Opening ${ext} files is not allowed for security reasons`);
    }
    await shell.openPath(path);
  });

  ipcMain.handle('shell:showItemInFolder', async (_, path: string) => {
    shell.showItemInFolder(path);
  });

  // MCP Server handlers
  ipcMain.handle(MCP_IPC_CHANNELS.MCP_LIST, () => {
    return getMcpServers();
  });

  ipcMain.handle(MCP_IPC_CHANNELS.MCP_ADD, async (_, config: MCPServerConfig) => {
    const server = addMcpServer(config);
    // Notify copilot to update session with new MCP servers
    copilotController.notifyMcpServersChanged();
    return server;
  });

  ipcMain.handle(MCP_IPC_CHANNELS.MCP_UPDATE, async (_, id: string, config: Partial<MCPServerConfig>) => {
    const server = updateMcpServer(id, config);
    if (server) {
      copilotController.notifyMcpServersChanged();
    }
    return server;
  });

  ipcMain.handle(MCP_IPC_CHANNELS.MCP_DELETE, async (_, id: string) => {
    const success = deleteMcpServer(id);
    if (success) {
      copilotController.notifyMcpServersChanged();
    }
    return success;
  });

  ipcMain.handle(MCP_IPC_CHANNELS.MCP_TOGGLE, async (_, id: string) => {
    const server = toggleMcpServer(id);
    if (server) {
      copilotController.notifyMcpServersChanged();
    }
    return server;
  });

  // Skills handlers
  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST, () => {
    return getSkillIndex().map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      source: skill.source,
      license: skill.license,
      triggers: skill.triggers,
      path: skill.path,
    }));
  });

  ipcMain.handle(IPC_CHANNELS.SKILLS_REFRESH, () => {
    return refreshSkillIndex().map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      source: skill.source,
      license: skill.license,
      triggers: skill.triggers,
      path: skill.path,
    }));
  });

  // Scheduled Tasks handlers
  ipcMain.handle('task:list', () => {
    return getScheduledTasks();
  });

  ipcMain.handle('task:add', async (_, task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask = addScheduledTask(task);

    if (newTask.enabled) {
      taskScheduler.scheduleTask(newTask);
    }

    return newTask;
  });

  ipcMain.handle('task:update', async (_, id: string, updates: Partial<ScheduledTask>) => {
    const updated = updateScheduledTask(id, updates);

    if (!updated) {
      throw new Error('Task not found');
    }

    // Reschedule if enabled
    if (updated.enabled) {
      taskScheduler.scheduleTask(updated);
    } else {
      taskScheduler.unscheduleTask(id);
    }

    return updated;
  });

  ipcMain.handle('task:delete', async (_, id: string) => {
    taskScheduler.unscheduleTask(id);
    return deleteScheduledTask(id);
  });

  ipcMain.handle('task:toggle', async (_, id: string) => {
    const task = getScheduledTasks().find(t => t.id === id);
    if (!task) throw new Error('Task not found');

    const updated = updateScheduledTask(id, { enabled: !task.enabled });

    if (updated && updated.enabled) {
      taskScheduler.scheduleTask(updated);
    } else if (updated) {
      taskScheduler.unscheduleTask(id);
    }

    return updated;
  });

  ipcMain.handle('task:execute', async (_, id: string) => {
    await taskScheduler.executeTask(id);
    return { success: true };
  });

  ipcMain.handle('task:logs', () => {
    return getTaskLogs();
  });

  // Voice input handlers
  ipcMain.handle('voice:test', async () => {
    // Test voice recognition by toggling
    await voiceInputManager.toggleRecording();
    return { success: true };
  });

  ipcMain.handle('voice:isRecording', () => {
    return voiceInputManager.getIsRecording();
  });

  ipcMain.handle('voice:transcript', (_, transcript: string) => {
    // This is called from renderer when browser speech recognition completes
    voiceInputManager.sendTranscript(transcript);
    return { success: true };
  });

  ipcMain.handle('voice:transcribe', async (_evt, payload: { audio: ArrayBuffer; mimeType: string; language?: string }) => {
    try {
      const settings = getSettings();
      if (!settings.voiceInput?.enabled) {
        return { success: false, error: 'Voice input is disabled in settings.' };
      }

      const provider = settings.voiceInput.provider;
      const audioBuffer = Buffer.from(payload.audio);
      const language = payload.language?.trim() || 'en';

      // Route to appropriate provider
      if (provider === 'local_whisper') {
        return await transcribeWithLocalWhisper(audioBuffer, language, settings);
      } else if (provider === 'openai_whisper') {
        return await transcribeWithOpenAI(audioBuffer, language, settings);
      } else if (provider === 'browser') {
        // Browser provider is handled in renderer, this should not be called
        return { success: false, error: 'Browser provider should be handled in renderer process.' };
      } else {
        return { success: false, error: `Unknown provider: ${provider}. Use local_whisper, openai_whisper, or browser.` };
      }
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  // OpenAI API key management (never sent to renderer)
  ipcMain.handle('voice:getApiKeyStatus', () => {
    const apiKey = getAppSetting('openai_whisper_api_key');
    return { hasKey: Boolean(apiKey && apiKey.trim()) };
  });

  ipcMain.handle('voice:setApiKey', (_evt, apiKey: string) => {
    if (apiKey && apiKey.trim()) {
      setAppSetting('openai_whisper_api_key', apiKey.trim());
      return { success: true };
    } else {
      deleteAppSetting('openai_whisper_api_key');
      return { success: true };
    }
  });

  ipcMain.handle('voice:clearApiKey', () => {
    deleteAppSetting('openai_whisper_api_key');
    return { success: true };
  });

  // Voice-to-clipboard handlers
  ipcMain.handle('voiceToClipboard:transcribe', async (_evt, payload: { audio: ArrayBuffer; mimeType: string; language?: string }) => {
    try {
      const settings = getSettings();
      if (!settings.voiceInput?.enabled) {
        return { success: false, error: 'Voice input is disabled in settings.' };
      }

      const provider = settings.voiceInput.provider;
      const audioBuffer = Buffer.from(payload.audio);
      const language = payload.language?.trim() || 'en';

      // Route to appropriate provider
      let result;
      if (provider === 'local_whisper') {
        result = await transcribeWithLocalWhisper(audioBuffer, language, settings);
      } else if (provider === 'openai_whisper') {
        result = await transcribeWithOpenAI(audioBuffer, language, settings);
      } else {
        result = { success: false, error: `Unknown provider: ${provider}` };
      }

      return result;
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle('voiceToClipboard:paste', async () => {
    try {
      const { voiceToClipboardManager } = await import('./voice-to-clipboard');
      await voiceToClipboardManager.handlePaste(true); // Force paste when user presses Enter
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle('voiceToClipboard:isRecording', async () => {
    const { voiceToClipboardManager } = await import('./voice-to-clipboard');
    return voiceToClipboardManager.getIsRecording();
  });

  // Audio capture helper window handlers
  ipcMain.on('audioCapture:windowReady', () => {
    console.log('[IPC] Audio capture window ready');
    markAudioCaptureWindowReady();
  });

  ipcMain.on('audioCapture:ready', (_evt: Electron.IpcMainEvent, sampleRate: number) => {
    console.log('[IPC] Audio capture ready, sample rate:', sampleRate);
    handleAudioCaptureReady(sampleRate);
  });

  ipcMain.on('audioCapture:stopped', (_evt: Electron.IpcMainEvent, samples: number[][], sampleRate: number) => {
    console.log('[IPC] Audio capture stopped, chunks:', samples.length, 'rate:', sampleRate);
    // Forward to the main command window for transcription
    const commandWindow = getCommandWindow();
    if (commandWindow && !commandWindow.isDestroyed()) {
      commandWindow.webContents.send('audioCapture:data', { samples, sampleRate });
    }
  });

  ipcMain.on('audioCapture:error', (_evt: Electron.IpcMainEvent, error: string) => {
    console.error('[IPC] Audio capture error:', error);
    handleAudioCaptureError(error);
  });

  // Start audio capture via helper window (called from main renderer)
  ipcMain.handle('audioCapture:startCapture', async () => {
    console.log('[IPC] Starting audio capture via helper window');
    try {
      const sampleRate = await startAudioCapture();
      return { success: true, sampleRate };
    } catch (error: any) {
      console.error('[IPC] Failed to start audio capture:', error);
      return { success: false, error: error?.message || String(error) };
    }
  });

  // Stop audio capture and get samples (called from main renderer)
  ipcMain.handle('audioCapture:stopCapture', async () => {
    console.log('[IPC] Stopping audio capture');
    try {
      const result = await stopAudioCapture();
      return { success: true, ...result };
    } catch (error: any) {
      console.error('[IPC] Failed to stop audio capture:', error);
      return { success: false, error: error?.message || String(error) };
    }
  });

  // Action logs export (renderer keeps logs in-memory; this just persists them to disk)
  ipcMain.handle('logs:export', async (_evt, payload: { logs: ActionLog[]; suggestedName?: string }) => {
    try {
      const suggestedName = (payload.suggestedName && payload.suggestedName.trim()) || `desktop-commander-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const result = await dialog.showSaveDialog({
        title: 'Export Logs',
        defaultPath: path.join(app.getPath('documents'), suggestedName),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      // Electron's typings have varied across versions (some return a string filePath).
      const resultAny: any = result as any;
      const filePath = typeof result === 'string' ? result : resultAny.filePath;
      const cancelled = typeof result === 'string' ? !result : resultAny.canceled;

      if (cancelled || !filePath) {
        return { success: true, cancelled: true };
      }

      const output = {
        exportedAt: Date.now(),
        app: {
          name: 'Desktop Commander',
          version: app.getVersion(),
        },
        logs: payload.logs || [],
      };

      await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf8');
      return { success: true, path: filePath };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  // Timer handlers
  ipcMain.handle('timer:list', () => {
    return timerManager.getAllTimers();
  });

  ipcMain.handle('timer:get', (_, id: string) => {
    return timerManager.getTimer(id);
  });

  ipcMain.handle('timer:create', (_, { type, name, options }) => {
    const timer = timerManager.createTimer(type, name, options);
    // Notify renderer about timer update
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  ipcMain.handle('timer:start', (_, id: string) => {
    const timer = timerManager.startTimer(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  ipcMain.handle('timer:pause', (_, id: string) => {
    const timer = timerManager.pauseTimer(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  ipcMain.handle('timer:reset', (_, id: string) => {
    const timer = timerManager.resetTimer(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  ipcMain.handle('timer:delete', (_, id: string) => {
    const success = timerManager.deleteTimer(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:deleted', id);
    }
    return success;
  });

  ipcMain.handle('timer:skip', (_, id: string) => {
    const timer = timerManager.skipPomodoroPhase(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  // Track active subscription handlers per sender to prevent listener accumulation
  const timerSubs = new WeakMap<Electron.WebContents, Array<() => void>>();
  const reminderSubs = new WeakMap<Electron.WebContents, Array<() => void>>();
  const recordingSubs = new WeakMap<Electron.WebContents, Array<() => void>>();
  const destroyedListenersSet = new WeakSet<Electron.WebContents>();

  // Subscribe to timer updates
  ipcMain.on('timer:subscribe', (event: Electron.IpcMainEvent) => {
    // Remove previous listeners from this sender
    const prevCleanup = timerSubs.get(event.sender);
    if (prevCleanup) {
      prevCleanup.forEach(fn => fn());
      timerSubs.delete(event.sender);
    }

    const timerTickHandler = (timer: Timer) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('timer:tick', timer);
      }
    };

    const timerCreatedHandler = (timer: Timer) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('timer:created', timer);
      }
    };

    const timerCompletedHandler = (timer: Timer) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('timer:completed', timer);
      }
    };

    timerManager.on('timer-tick', timerTickHandler);
    timerManager.on('timer-created', timerCreatedHandler);
    timerManager.on('timer-completed', timerCompletedHandler);

    const cleanup = [
      () => timerManager.off('timer-tick', timerTickHandler),
      () => timerManager.off('timer-created', timerCreatedHandler),
      () => timerManager.off('timer-completed', timerCompletedHandler),
    ];
    timerSubs.set(event.sender, cleanup);

    // Only attach destroyed listener once per sender
    if (!destroyedListenersSet.has(event.sender)) {
      destroyedListenersSet.add(event.sender);
      event.sender.once('destroyed', () => {
        const cleanup = timerSubs.get(event.sender);
        if (cleanup) {
          cleanup.forEach(fn => fn());
          timerSubs.delete(event.sender);
        }
      });
    }
  });

  // Reminder handlers
  ipcMain.handle('reminder:list', () => {
    return reminderManager.getActiveReminders();
  });

  ipcMain.handle('reminder:cancel', async (_event: Electron.IpcMainInvokeEvent, id: string) => {
    return reminderManager.cancelReminder(id);
  });

  ipcMain.handle('reminder:delete', async (_event: Electron.IpcMainInvokeEvent, id: string) => {
    return reminderManager.cancelReminder(id);
  });

  ipcMain.handle('reminder:create', async (_event: Electron.IpcMainInvokeEvent, { message, delayMinutes, scheduledTime }) => {
    const time = scheduledTime ? new Date(scheduledTime) : undefined;
    const reminder = delayMinutes
      ? reminderManager.createReminderWithDelay(message, delayMinutes)
      : reminderManager.createReminder(message, time!);
    return reminder;
  });

  // Subscribe to reminder events
  ipcMain.on('reminder:subscribe', (event: Electron.IpcMainEvent) => {
    // Remove previous listeners from this sender
    const prevCleanup = reminderSubs.get(event.sender);
    if (prevCleanup) {
      prevCleanup.forEach(fn => fn());
      reminderSubs.delete(event.sender);
    }

    const reminderCreatedHandler = (reminder: unknown) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('reminder:created', reminder);
      }
    };

    const reminderTriggeredHandler = (reminder: unknown) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('reminder:triggered', reminder);
      }
    };

    const reminderCancelledHandler = (id: unknown) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('reminder:cancelled', id);
      }
    };

    reminderManager.on('reminder-created', reminderCreatedHandler);
    reminderManager.on('reminder-triggered', reminderTriggeredHandler);
    reminderManager.on('reminder-cancelled', reminderCancelledHandler);

    const cleanup = [
      () => reminderManager.off('reminder-created', reminderCreatedHandler),
      () => reminderManager.off('reminder-triggered', reminderTriggeredHandler),
      () => reminderManager.off('reminder-cancelled', reminderCancelledHandler),
    ];
    reminderSubs.set(event.sender, cleanup);

    // Only attach destroyed listener once per sender
    if (!destroyedListenersSet.has(event.sender)) {
      destroyedListenersSet.add(event.sender);
      event.sender.once('destroyed', () => {
        const cleanup = reminderSubs.get(event.sender);
        if (cleanup) {
          cleanup.forEach(fn => fn());
          reminderSubs.delete(event.sender);
        }
      });
    }
  });

  // Chat history handlers
  ipcMain.handle('chat:start', (_, title) => {
    const { startChatSession } = require('./chat-history');
    return startChatSession(title);
  });

  ipcMain.handle('chat:getHistory', (_, conversationId) => {
    return getConversationHistory(conversationId);
  });

  ipcMain.handle('chat:getConversations', () => {
    return getAllConversations();
  });

  ipcMain.handle('chat:loadConversation', (_, id) => {
    return loadConversation(id);
  });

  ipcMain.handle('chat:deleteConversation', (_, id) => {
    return deleteConversation(id);
  });

  ipcMain.handle('chat:search', (_, query) => {
    const { searchConversations } = require('./chat-history');
    return searchConversations(query);
  });

  ipcMain.handle('chat:getStats', () => {
    const { getChatStatistics } = require('./chat-history');
    return getChatStatistics();
  });

  // Menu bar mode handlers
  ipcMain.handle('menubar:init', (_, config) => {
    const { initCompactWindow } = require('./menubar');
    const platform = process.platform;

    if (platform === 'darwin') {
      const { initMenuBar } = require('./menubar');
      initMenuBar(config);
      return { mode: 'menubar', platform };
    } else {
      initCompactWindow();
      return { mode: 'compact', platform };
    }
  });

  ipcMain.handle('menubar:show', () => {
    if (process.platform === 'darwin') {
      const { showMenuBar } = require('./menubar');
      showMenuBar();
    } else {
      const { showCompactWindow } = require('./menubar');
      showCompactWindow();
    }
  });

  ipcMain.handle('menubar:hide', () => {
    if (process.platform === 'darwin') {
      const { hideMenuBar } = require('./menubar');
      hideMenuBar();
    } else {
      const { hideCompactWindow } = require('./menubar');
      hideCompactWindow();
    }
  });

  ipcMain.handle('menubar:toggle', () => {
    if (process.platform === 'darwin') {
      const { toggleMenuBar } = require('./menubar');
      toggleMenuBar();
    } else {
      const { toggleCompactWindow } = require('./menubar');
      toggleCompactWindow();
    }
  });

  ipcMain.handle('menubar:isActive', () => {
    if (process.platform === 'darwin') {
      const { isMenuBarActive } = require('./menubar');
      return isMenuBarActive();
    } else {
      return true; // Compact window is always "active" if initialized
    }
  });

  // Folder selection dialog
  ipcMain.handle('dialog:selectFolder', async (_, options?: { title?: string; defaultPath?: string }) => {
    const result: { canceled: boolean; filePaths: string[] } = await dialog.showOpenDialog({
      title: options?.title || 'Select Folder',
      defaultPath: options?.defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    }) as any;

    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }

    return { cancelled: false, path: result.filePaths[0] };
  });

  // Get app path (for default recording location)
  ipcMain.handle('app:getAppPath', () => {
    return app.isPackaged
      ? path.dirname(app.getPath('exe'))
      : app.getAppPath();
  });

  // Recording handlers
  ipcMain.handle(IPC_CHANNELS.RECORDING_LIST, () => {
    return recordingManager.getAllRecordings();
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_GET, (_, idOrType?: string) => {
    return recordingManager.getStatus(idOrType);
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_DELETE, async (_, id: string) => {
    const recording = recordingManager.getStatus(id);
    if (!recording) {
      return { success: false, error: 'Recording not found' };
    }

    // Delete the file
    try {
      if (fsSync.existsSync(recording.outputPath)) {
        await fs.unlink(recording.outputPath);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete recording' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_OPEN, async (_, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to open recording' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_OPEN_FOLDER, (_, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, async (_, idOrType?: string | RecordingType) => {
    try {
      const recording = await recordingManager.stopRecording(idOrType);
      return { success: true, recording };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to stop recording' };
    }
  });

  // Notes handlers
  ipcMain.handle(IPC_CHANNELS.NOTES_LIST, (_, limit?: number) => {
    return listNotes(limit);
  });

  ipcMain.handle(IPC_CHANNELS.NOTES_GET, (_, id: string) => {
    return getNote(id);
  });

  ipcMain.handle(IPC_CHANNELS.NOTES_CREATE, (_, params: { title: string; content?: string }) => {
    return createNote(params.title, params.content);
  });

  ipcMain.handle(IPC_CHANNELS.NOTES_UPDATE, (_, params: { id: string; title?: string; content?: string }) => {
    return updateNote(params.id, params.title, params.content);
  });

  ipcMain.handle(IPC_CHANNELS.NOTES_DELETE, (_, id: string) => {
    return deleteNote(id);
  });

  ipcMain.handle(IPC_CHANNELS.NOTES_SEARCH, (_, params: { query: string; limit?: number }) => {
    return searchNotes(params.query, params.limit);
  });

  // Todos handlers
  ipcMain.handle(IPC_CHANNELS.TODOS_LIST, (_, filter?: 'all' | 'active' | 'completed') => {
    return listTodos(filter);
  });

  ipcMain.handle(IPC_CHANNELS.TODOS_CREATE, (_, text: string) => {
    return createTodo(text);
  });

  ipcMain.handle(IPC_CHANNELS.TODOS_COMPLETE, (_, id: string) => {
    return completeTodo(id);
  });

  ipcMain.handle(IPC_CHANNELS.TODOS_DELETE, (_, id: string) => {
    return deleteTodo(id);
  });

  // Session compaction handler
  ipcMain.handle(IPC_CHANNELS.COPILOT_COMPACT_SESSION, async () => {
    try {
      const summary = await copilotController.compactSession();
      return { success: true, summary };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // TTS handlers
  ipcMain.handle(IPC_CHANNELS.TTS_SPEAK, (_, params: { text: string; voice?: string; rate?: number; volume?: number }) => {
    return speak(params.text, params);
  });

  ipcMain.handle(IPC_CHANNELS.TTS_STOP, () => {
    return stopSpeaking();
  });

  ipcMain.handle(IPC_CHANNELS.TTS_LIST_VOICES, () => {
    return listVoices();
  });

  // Subscribe to recording events
  ipcMain.on(IPC_CHANNELS.RECORDING_SUBSCRIBE, (event: Electron.IpcMainEvent) => {
    // Remove previous listeners from this sender
    const prevCleanup = recordingSubs.get(event.sender);
    if (prevCleanup) {
      prevCleanup.forEach(fn => fn());
      recordingSubs.delete(event.sender);
    }

    const progressHandler = (recording: Recording) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.RECORDING_PROGRESS, recording);
      }
    };

    const startedHandler = (recording: Recording) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.RECORDING_UPDATED, recording);
      }
    };

    const stoppedHandler = (recording: Recording) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.RECORDING_UPDATED, recording);
      }
    };

    const errorHandler = (recording: Recording) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.RECORDING_UPDATED, recording);
      }
    };

    recordingManager.on('recording-progress', progressHandler);
    recordingManager.on('recording-started', startedHandler);
    recordingManager.on('recording-stopped', stoppedHandler);
    recordingManager.on('recording-error', errorHandler);

    const cleanup = [
      () => recordingManager.off('recording-progress', progressHandler),
      () => recordingManager.off('recording-started', startedHandler),
      () => recordingManager.off('recording-stopped', stoppedHandler),
      () => recordingManager.off('recording-error', errorHandler),
    ];
    recordingSubs.set(event.sender, cleanup);

    // Only attach destroyed listener once per sender
    if (!destroyedListenersSet.has(event.sender)) {
      destroyedListenersSet.add(event.sender);
      event.sender.once('destroyed', () => {
        const cleanup = recordingSubs.get(event.sender);
        if (cleanup) {
          cleanup.forEach(fn => fn());
          recordingSubs.delete(event.sender);
        }
      });
    }
  });
}
