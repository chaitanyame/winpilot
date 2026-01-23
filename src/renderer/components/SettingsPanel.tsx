import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Moon, Sun, Monitor, Keyboard, Shield, FolderClosed, Bell } from 'lucide-react';
import type { Settings } from '../../shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'safety'>('general');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
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
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'safety', label: 'Safety', icon: FolderClosed },
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
        <div className="flex border-b border-dark-200 dark:border-dark-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Theme
                </label>
                <div className="flex gap-2">
                  {['light', 'dark', 'system'].map((theme) => (
                    <button
                      key={theme}
                      onClick={() => updateSettings({ theme: theme as any })}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                        settings.theme === theme
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                          : 'border-dark-200 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      {theme === 'light' && <Sun className="w-4 h-4" />}
                      {theme === 'dark' && <Moon className="w-4 h-4" />}
                      {theme === 'system' && <Monitor className="w-4 h-4" />}
                      <span className="capitalize">{theme}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hotkey */}
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
                           bg-dark-50 dark:bg-dark-700 text-dark-700 dark:text-dark-300"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Press the hotkey to open Desktop Commander
                </p>
              </div>

              {/* UI Options */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  UI Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.ui.showInTray}
                      onChange={(e) => updateSettings({ 
                        ui: { ...settings.ui, showInTray: e.target.checked } 
                      })}
                      className="w-4 h-4 rounded border-dark-300 text-primary-500"
                    />
                    <span className="text-sm text-dark-600 dark:text-dark-400">
                      Show in system tray
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.ui.toastNotifications}
                      onChange={(e) => updateSettings({ 
                        ui: { ...settings.ui, toastNotifications: e.target.checked } 
                      })}
                      className="w-4 h-4 rounded border-dark-300 text-primary-500"
                    />
                    <span className="text-sm text-dark-600 dark:text-dark-400">
                      Show notifications
                    </span>
                  </label>
                </div>
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
        </div>
      </motion.div>
    </motion.div>
  );
}
