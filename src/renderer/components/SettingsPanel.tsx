import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Moon, Sun, Monitor, Keyboard, Shield, FolderClosed, Brain, Mic, Video, FolderOpen, Check, Command, Eye } from 'lucide-react';
import type { Settings, AIModel, ThemeId, AppearanceMode } from '../../shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'voice' | 'recording' | 'hotkeys' | 'permissions' | 'safety' | 'privacy' | 'context'>('general');
  const [appPath, setAppPath] = useState<string>('');


  const themeOptions: Array<{ id: ThemeId; name: string; description: string; swatches: string[] }> = [
    {
      id: 'twitter',
      name: 'Twitter',
      description: 'Clean and modern blue design',
      swatches: ['#EAF5FF', '#1DA1F2', '#0F172A'],
    },
    {
      id: 'claude',
      name: 'Claude',
      description: 'Warm beige tones with orange accents',
      swatches: ['#F7E7D2', '#C96B2C', '#2B2118'],
    },
    {
      id: 'neo-brutalism',
      name: 'Neo Brutalism',
      description: 'Bold colors with hard shadows',
      swatches: ['#FFF3E6', '#FF3B30', '#1A1A1A'],
    },
    {
      id: 'retro-arcade',
      name: 'Retro Arcade',
      description: 'Vibrant pink and teal pixel vibes',
      swatches: ['#FFF0F7', '#FF4DB8', '#32D5C5'],
    },
    {
      id: 'aurora',
      name: 'Aurora',
      description: 'Deep violet and teal, like northern lights',
      swatches: ['#F4F3FF', '#7C3AED', '#22D3EE'],
    },
    {
      id: 'business',
      name: 'Business',
      description: 'Deep navy (#000e4e) and gray monochrome',
      swatches: ['#F7F8FA', '#000E4E', '#64748B'],
    },
  ];

  const appearanceModes: Array<{ id: AppearanceMode; label: string; icon: typeof Sun }> = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadAppPath();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const data = await window.electronAPI.getSettings() as Settings;
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadAppPath = async () => {
    try {
      const path = await window.electronAPI.getAppPath();
      setAppPath(path);
    } catch (err) {
      console.error('Failed to get app path:', err);
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    if (!settings) return;
    
    try {
      const newSettings = { ...settings, ...updates };
      await window.electronAPI.setSettings(newSettings);
      setSettings(newSettings);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  if (!isOpen || !settings) return null;

  const tabs = [
    { id: 'general', label: 'General', icon: Monitor },
    { id: 'ai', label: 'AI', icon: Brain },
    { id: 'voice', label: 'Voice', icon: Mic },
    { id: 'recording', label: 'Recording', icon: Video },
    { id: 'hotkeys', label: 'Hotkeys', icon: Command },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'safety', label: 'Safety', icon: FolderClosed },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'context', label: 'Context', icon: Eye },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dark-800 dark:text-dark-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 
                       text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-dark-200 dark:border-dark-700">
          <div className="flex gap-1 p-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-white'
                      : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Theme Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  Theme
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {themeOptions.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => updateSettings({ themeId: theme.id })}
                      className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                        settings.themeId === theme.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                      }`}
                    >
                      {settings.themeId === theme.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="font-medium text-sm text-dark-800 dark:text-dark-200 mb-1">
                        {theme.name}
                      </div>
                      <div className="text-xs text-dark-500 dark:text-dark-400 mb-3">
                        {theme.description}
                      </div>
                      <div className="flex gap-2">
                        {theme.swatches.map((color, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-md border border-dark-200 dark:border-dark-600"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Appearance Mode */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  Appearance
                </label>
                <div className="flex gap-2">
                  {appearanceModes.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => updateSettings({ appearanceMode: mode.id })}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                          settings.appearanceMode === mode.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                            : 'border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:border-dark-300 dark:hover:border-dark-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Global Hotkey */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  <Keyboard className="w-4 h-4 inline mr-2" />
                  Global Hotkey
                </label>
                <input
                  type="text"
                  value={settings.hotkey}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                           bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Press this key combination to show the command palette
                </p>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* AI Model Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  <Brain className="w-4 h-4 inline mr-2" />
                  AI Model
                </label>
                <select
                  value={settings.agenticLoop?.model || 'gpt-5'}
                  onChange={(e) => updateSettings({
                    agenticLoop: {
                      ...settings.agenticLoop,
                      model: e.target.value as AIModel
                    }
                  })}
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600
                           bg-white dark:bg-dark-700 text-dark-700 dark:text-dark-300"
                >
                  <optgroup label="⭐ Recommended">
                    <option value="claude-sonnet-4.5">Claude Sonnet 4.5 (Best for agentic loops)</option>
                    <option value="gpt-5.1-codex">GPT-5.1 Codex (Best for code/desktop)</option>
                    <option value="claude-haiku-4.5">Claude Haiku 4.5 (Fastest)</option>
                  </optgroup>

                  <optgroup label="🤖 Claude Models">
                    <option value="claude-opus-4.5">Claude Opus 4.5 (Most capable)</option>
                    <option value="claude-sonnet-4">Claude Sonnet 4 (Previous gen)</option>
                  </optgroup>

                  <optgroup label="✨ GPT-5 Models">
                    <option value="gpt-5.2-codex">GPT-5.2 Codex (Latest code)</option>
                    <option value="gpt-5.2">GPT-5.2 (Latest general)</option>
                    <option value="gpt-5.1-codex-max">GPT-5.1 Codex Max (Extended context)</option>
                    <option value="gpt-5.1">GPT-5.1 (Enhanced)</option>
                    <option value="gpt-5">GPT-5 (Base)</option>
                  </optgroup>

                  <optgroup label="📦 GPT-4 Models">
                    <option value="gpt-4.1">GPT-4.1 Turbo</option>
                    <option value="gpt-4o">GPT-4o (Optimized)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Fast & cheap)</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Budget)</option>
                  </optgroup>

                  <optgroup label="🔮 Other Models">
                    <option value="gemini-3-pro-preview">Gemini 3 Pro (Preview)</option>
                  </optgroup>
                </select>
                <p className="text-xs text-dark-500 mt-2">
                  Choose the AI model for WinPilot's agentic loop
                </p>
              </div>

              {/* Agentic Loop Settings */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Agentic Loop Settings
                </label>

                <div className="space-y-3">
                  {/* Enable/Disable Loop */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.agenticLoop?.enabled ?? true}
                      onChange={(e) => updateSettings({
                        agenticLoop: {
                          ...settings.agenticLoop,
                          enabled: e.target.checked
                        }
                      })}
                      className="w-4 h-4 rounded border-dark-300 text-primary-500"
                    />
                    <span className="text-sm text-dark-600 dark:text-dark-400">
                      Enable agentic loop (multi-turn iteration)
                    </span>
                  </label>

                  {/* Max Iterations */}
                  <div>
                    <label className="block text-xs text-dark-600 dark:text-dark-400 mb-1">
                      Max Iterations: {settings.agenticLoop?.maxIterations || 10}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="20"
                      value={settings.agenticLoop?.maxIterations || 10}
                      onChange={(e) => updateSettings({
                        agenticLoop: {
                          ...settings.agenticLoop,
                          maxIterations: parseInt(e.target.value)
                        }
                      })}
                      className="w-full"
                    />
                  </div>

                  {/* Max Time */}
                  <div>
                    <label className="block text-xs text-dark-600 dark:text-dark-400 mb-1">
                      Max Time: {settings.agenticLoop?.maxTotalTimeMinutes || 15} minutes
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={settings.agenticLoop?.maxTotalTimeMinutes || 15}
                      onChange={(e) => updateSettings({
                        agenticLoop: {
                          ...settings.agenticLoop,
                          maxTotalTimeMinutes: parseInt(e.target.value)
                        }
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Model Info */}
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  💡 <strong>Tip:</strong> Claude Sonnet 4.5 and GPT-5.1 Codex offer the best balance
                  of speed, reasoning, and tool use for autonomous desktop control.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-6">
              {/* Enable Voice Input */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={settings.voiceInput?.enabled ?? false}
                    onChange={(e) => updateSettings({
                      voiceInput: {
                        ...settings.voiceInput,
                        enabled: e.target.checked
                      }
                    })}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500"
                  />
                  <span className="text-sm text-dark-600 dark:text-dark-400">
                    <Mic className="w-4 h-4 inline mr-2" />
                    Enable voice input
                  </span>
                </label>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Speech-to-Text Provider
                </label>
                <select
                  value={settings.voiceInput?.provider || 'browser'}
                  onChange={(e) => updateSettings({
                    voiceInput: {
                      ...settings.voiceInput,
                      provider: e.target.value as 'browser' | 'openai_whisper'
                    }
                  })}
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600
                           bg-white dark:bg-dark-700 text-dark-700 dark:text-dark-300"
                  disabled={!settings.voiceInput?.enabled}
                >
                  <option value="local_whisper">Local Whisper (Recommended - Free, Offline)</option>
                  <option value="openai_whisper">OpenAI Whisper API (Cloud)</option>
                  <option value="browser">Web Speech API (⚠️ Not working in Electron)</option>
                </select>
                <p className="text-xs text-dark-500 mt-1">
                  {settings.voiceInput?.provider === 'local_whisper'
                    ? 'Runs locally on your machine - free, private, no API key needed. Model downloads automatically.'
                    : settings.voiceInput?.provider === 'openai_whisper'
                    ? 'Cloud-based transcription via OpenAI Whisper API - highest accuracy, requires API key'
                    : '⚠️ Web Speech API requires Google services not available in Electron.'}
                </p>
              </div>

              {/* Local Whisper Model Size (only show for local_whisper provider) */}
              {settings.voiceInput?.provider === 'local_whisper' && (
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Model Size
                  </label>
                  <select
                    value={settings.voiceInput?.localWhisper?.modelSize || 'base'}
                    onChange={(e) => updateSettings({
                      voiceInput: {
                        ...settings.voiceInput,
                        localWhisper: {
                          ...settings.voiceInput?.localWhisper,
                          modelSize: e.target.value as 'tiny' | 'base' | 'small' | 'medium' | 'large'
                        }
                      }
                    })}
                    className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600
                             bg-white dark:bg-dark-700 text-dark-700 dark:text-dark-300"
                    disabled={!settings.voiceInput?.enabled}
                  >
                    <option value="tiny">Tiny (~75MB) - Fastest, lower accuracy</option>
                    <option value="base">Base (~150MB) - Good balance (Recommended)</option>
                    <option value="small">Small (~500MB) - Better accuracy</option>
                    <option value="medium">Medium (~1.5GB) - High accuracy</option>
                    <option value="large">Large (~3GB) - Best accuracy, slowest</option>
                  </select>
                  <p className="text-xs text-dark-500 mt-1">
                    Model will be downloaded automatically on first use. Larger models are more accurate but slower.
                  </p>
                </div>
              )}

              {/* OpenAI API Key (only show for openai_whisper provider) */}
              {settings.voiceInput?.provider === 'openai_whisper' && (
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    OpenAI API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="sk-..."
                      className="flex-1 px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                               bg-white dark:bg-dark-700 text-dark-700 dark:text-dark-300"
                      disabled={!settings.voiceInput?.enabled}
                      onBlur={async (e) => {
                        const apiKey = e.target.value.trim();
                        if (apiKey) {
                          await window.electronAPI.voiceSetApiKey(apiKey);
                          e.target.value = ''; // Clear input for security
                        }
                      }}
                    />
                    <button
                      onClick={async () => {
                        await window.electronAPI.voiceClearApiKey();
                        alert('API key cleared');
                      }}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg
                               transition-colors font-medium"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-xs text-dark-500 mt-1">
                    Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-primary-500 hover:underline">OpenAI Platform</a>
                  </p>
                </div>
              )}

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Language
                </label>
                <select
                  value={settings.voiceInput?.language || 'en'}
                  onChange={(e) => updateSettings({
                    voiceInput: {
                      ...settings.voiceInput,
                      language: e.target.value
                    }
                  })}
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600
                           bg-white dark:bg-dark-700 text-dark-700 dark:text-dark-300"
                  disabled={!settings.voiceInput?.enabled}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="auto">Auto-detect</option>
                </select>
              </div>

              {/* Voice Hotkey */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Voice Input Hotkey
                </label>
                <input
                  type="text"
                  value={settings.voiceInput?.hotkey || 'Ctrl+Shift+V'}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                           bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                  disabled={!settings.voiceInput?.enabled}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Press this key combination to start voice recording
                </p>
              </div>

              {/* Visual Feedback */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.voiceInput?.showVisualFeedback ?? true}
                    onChange={(e) => updateSettings({
                      voiceInput: {
                        ...settings.voiceInput,
                        showVisualFeedback: e.target.checked
                      }
                    })}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500"
                    disabled={!settings.voiceInput?.enabled}
                  />
                  <span className="text-sm text-dark-600 dark:text-dark-400">
                    Show visual feedback while recording
                  </span>
                </label>
              </div>

              {/* Auto-Paste on Voice-to-Clipboard */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.voiceInput?.autoPasteOnTranscribe !== false}
                    onChange={(e) => updateSettings({
                      voiceInput: {
                        ...settings.voiceInput,
                        autoPasteOnTranscribe: e.target.checked
                      }
                    })}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500"
                    disabled={!settings.voiceInput?.enabled}
                  />
                  <span className="text-sm text-dark-600 dark:text-dark-400">
                    Auto-paste after voice-to-clipboard (Ctrl+Shift+W)
                  </span>
                </label>
                <p className="text-xs text-dark-500 mt-1 ml-6">
                  Automatically paste transcribed text to the focused app
                </p>
              </div>

              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  <Mic className="w-3 h-3 inline mr-1" />
                  Voice input allows you to speak commands instead of typing. Press the global hotkey or
                  click the mic icon to start recording. Use Ctrl+Shift+W for voice-to-clipboard.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'recording' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  <FolderOpen className="w-4 h-4 inline mr-2" />
                  Recording Output Folder
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.recording?.outputPath || ''}
                    placeholder={`${appPath}\\recordings`}
                    readOnly
                    className="flex-1 px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                             bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                  />
                  <button
                    onClick={async () => {
                      const result = await window.electronAPI.selectFolder({
                        title: 'Select Recording Output Folder',
                        defaultPath: settings.recording?.outputPath || appPath
                      });
                      if (!result.cancelled && result.path) {
                        updateSettings({
                          recording: {
                            ...settings.recording,
                            outputPath: result.path
                          }
                        });
                      }
                    }}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg
                             transition-colors font-medium"
                  >
                    Browse
                  </button>
                </div>
                <p className="text-xs text-dark-500 mt-1">
                  Leave empty to use app directory: {appPath}\recordings
                </p>
              </div>

              <div>
                <button
                  onClick={() => updateSettings({
                    recording: {
                      ...settings.recording,
                      outputPath: ''
                    }
                  })}
                  disabled={!settings.recording?.outputPath}
                  className="px-4 py-2 bg-dark-200 hover:bg-dark-300 dark:bg-dark-700 dark:hover:bg-dark-600
                           text-dark-700 dark:text-dark-300 rounded-lg transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset to Default Location
                </button>
              </div>

              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  <Video className="w-3 h-3 inline mr-1" />
                  Recordings are saved as MP4 (screen/webcam) or MP3 (audio). Use "start screen recording" or
                  "start audio recording" commands to begin.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'hotkeys' && (
            <div className="space-y-6">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <Command className="w-3 h-3 inline mr-1" />
                  Configure global hotkeys for quick actions. Use Ctrl (Windows/Linux) or Cmd (Mac) + Shift + a letter.
                </p>
              </div>

              {/* Clipboard History Hotkey */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Clipboard History
                </label>
                <input
                  type="text"
                  value={settings.hotkeys?.clipboardHistory || 'CommandOrControl+Shift+H'}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                           bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Open clipboard history viewer
                </p>
              </div>

              {/* Voice Transcribe Hotkey */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Voice Transcribe (Speech-to-Text)
                </label>
                <input
                  type="text"
                  value={settings.hotkeys?.voiceTranscribe || 'CommandOrControl+Shift+T'}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                           bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Transcribe speech to text without executing commands
                </p>
              </div>

              {/* Voice Command Hotkey */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Voice Command (Speech-to-Command)
                </label>
                <input
                  type="text"
                  value={settings.hotkeys?.voiceCommand || 'CommandOrControl+Shift+C'}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                           bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Speak a command and execute it immediately
                </p>
              </div>

              {/* Audio Recording Hotkey */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Audio Recording
                </label>
                <input
                  type="text"
                  value={settings.hotkeys?.audioRecording || 'CommandOrControl+Shift+A'}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                           bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Start/stop audio recording
                </p>
              </div>

              {/* Video Recording Hotkey */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Video Recording
                </label>
                <input
                  type="text"
                  value={settings.hotkeys?.videoRecording || 'CommandOrControl+Shift+R'}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                           bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Start/stop screen recording
                </p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <Keyboard className="w-3 h-3 inline mr-1" />
                  Hotkey customization coming soon. Current shortcuts are fixed to prevent conflicts.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={settings.permissions.rememberChoices}
                    onChange={(e) => updateSettings({ 
                      permissions: { ...settings.permissions, rememberChoices: e.target.checked } 
                    })}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500"
                  />
                  <span className="text-sm text-dark-600 dark:text-dark-400">
                    Remember permission choices
                  </span>
                </label>

                <p className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Always require confirmation for:
                </p>
                <div className="space-y-2">
                  {['files.delete', 'process.kill', 'system.sleep', 'system.lock', 'apps.quit'].map((action) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.permissions.requireConfirmFor.includes(action)}
                        onChange={(e) => {
                          const newList = e.target.checked
                            ? [...settings.permissions.requireConfirmFor, action]
                            : settings.permissions.requireConfirmFor.filter(a => a !== action);
                          updateSettings({ 
                            permissions: { ...settings.permissions, requireConfirmFor: newList } 
                          });
                        }}
                        className="w-4 h-4 rounded border-dark-300 text-primary-500"
                      />
                      <span className="text-sm text-dark-600 dark:text-dark-400 font-mono">
                        {action}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Max files per operation
                </label>
                <input
                  type="number"
                  value={settings.safety.maxFilesPerOperation}
                  onChange={(e) => updateSettings({ 
                    safety: { ...settings.safety, maxFilesPerOperation: parseInt(e.target.value) || 100 } 
                  })}
                  className="w-full px-4 py-2 rounded-lg border border-dark-200 dark:border-dark-600 
                           bg-white dark:bg-dark-700 text-dark-700 dark:text-dark-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Protected paths
                </label>
                <div className="space-y-2">
                  {settings.safety.protectedPaths.map((path, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={path}
                        readOnly
                        className="flex-1 px-3 py-1.5 rounded-lg border border-dark-200 dark:border-dark-600 
                                 bg-dark-50 dark:bg-dark-700 text-dark-600 dark:text-dark-400 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-dark-500 mt-1">
                  Files in these paths cannot be modified
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.screenSharePrivacy?.autoHideOnShare ?? true}
                    onChange={(e) => updateSettings({
                      screenSharePrivacy: {
                        ...settings.screenSharePrivacy,
                        autoHideOnShare: e.target.checked,
                      },
                    })}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500"
                  />
                  <span className="text-sm text-dark-600 dark:text-dark-400">
                    Auto-hide Desktop Commander when screen sharing starts
                  </span>
                </label>
              </div>

              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  <Shield className="w-3 h-3 inline mr-1" />
                  When enabled, Desktop Commander will hide itself if a screen sharing app
                  (Zoom, Teams, OBS, etc.) is detected.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'context' && (
            <div className="space-y-6">
              {/* Enable Context Capture */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.contextAwareness?.enabled ?? true}
                    onChange={(e) => updateSettings({
                      contextAwareness: {
                        ...settings.contextAwareness,
                        enabled: e.target.checked,
                      },
                    })}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500"
                  />
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-dark-600 dark:text-dark-400" />
                    <span className="text-sm text-dark-600 dark:text-dark-400">
                      Enable context awareness
                    </span>
                  </div>
                </label>
                <p className="text-xs text-dark-500 mt-1 ml-6">
                  Automatically capture information about your active window to provide better context
                </p>
              </div>

              {/* Show Context Badge */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.contextAwareness?.showContextBadge ?? true}
                    onChange={(e) => updateSettings({
                      contextAwareness: {
                        ...settings.contextAwareness,
                        showContextBadge: e.target.checked,
                      },
                    })}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500"
                    disabled={!settings.contextAwareness?.enabled}
                  />
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-dark-600 dark:text-dark-400" />
                    <span className="text-sm text-dark-600 dark:text-dark-400">
                      Show context badge
                    </span>
                  </div>
                </label>
                <p className="text-xs text-dark-500 mt-1 ml-6">
                  Display a visual indicator showing the current active window
                </p>
              </div>

              {/* Capture Selected Text */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.contextAwareness?.captureSelectedText ?? false}
                    onChange={(e) => updateSettings({
                      contextAwareness: {
                        ...settings.contextAwareness,
                        captureSelectedText: e.target.checked,
                      },
                    })}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500"
                    disabled={!settings.contextAwareness?.enabled}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-dark-600 dark:text-dark-400">
                      Capture selected text
                    </span>
                    <span className="badge-experimental">Experimental</span>
                  </div>
                </label>
                <p className="text-xs text-dark-500 mt-1 ml-6">
                  Include selected text from the active window in context (may not work in all apps)
                </p>
              </div>

              {/* Injection Style */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  <Eye className="w-4 h-4 inline mr-2" />
                  Context injection style
                </label>
                <select
                  value={settings.contextAwareness?.injectionStyle || 'visible'}
                  onChange={(e) => updateSettings({
                    contextAwareness: {
                      ...settings.contextAwareness,
                      injectionStyle: e.target.value as 'visible' | 'hidden',
                    },
                  })}
                  className="setting-select"
                  disabled={!settings.contextAwareness?.enabled}
                >
                  <option value="visible">Visible (prepend to message)</option>
                  <option value="hidden">Hidden (system prompt only)</option>
                </select>
                <p className="text-xs text-dark-500 mt-1">
                  {settings.contextAwareness?.injectionStyle === 'visible'
                    ? 'Context will be shown at the top of your message before sending to the AI'
                    : 'Context will be included in the system prompt without being visible in the chat'}
                </p>
              </div>

              {/* Context Badge Preview */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Badge preview
                </label>
                <div className="p-3 bg-dark-50 dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                  <div className="context-badge-preview">
                    <Eye className="w-3 h-3" />
                    <span className="font-medium">Chrome</span>
                    <span className="text-dark-500">·</span>
                    <span className="text-dark-600">github.com</span>
                  </div>
                  <p className="text-xs text-dark-500 mt-2">
                    This badge shows the app and window title of your active window
                  </p>
                </div>
              </div>

              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  <Eye className="w-3 h-3 inline mr-1" />
                  Context awareness helps the AI understand what you're working on by detecting
                  your active window. This information is used to provide more relevant responses
                  and is never shared externally.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
