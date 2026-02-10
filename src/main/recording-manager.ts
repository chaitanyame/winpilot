/**
 * Recording Manager
 *
 * Handles screen recording, audio recording, and webcam recording using FFmpeg.
 * Supports multiple concurrent recordings, region capture, and various audio sources.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Recording,
  RecordingStatus,
  RecordingType,
  AudioSource,
  RecordingRegion
} from '../shared/types';
import { getFFmpegPath, isFFmpegAvailable, validateFFmpeg } from '../utils/ffmpeg-path';
import { getSettings } from './store';

// Constants
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB warning threshold
const MAX_DURATION_SECONDS = 30 * 60; // 30 minutes warning threshold
// Unused for now, but kept for future disk space checking
// const MIN_FREE_DISK_SPACE = 2 * 1024 * 1024 * 1024; // 2GB minimum free space

interface RecordingOptions {
  audioSource?: AudioSource;
  fps?: number;
  region?: RecordingRegion;
  filename?: string;
  format?: 'mp4' | 'mp3' | 'wav' | 'aac';
  outputPath?: string;
}

interface AudioDevice {
  name: string;
  type: 'input' | 'output';
}

interface VideoDevice {
  name: string;
  type: 'webcam' | 'screen';
}

class RecordingManager extends EventEmitter {
  private recordings: Map<string, Recording> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private progressIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  /**
   * Get the output path for recordings
   * Uses settings if configured, otherwise defaults to app directory
   */
  getOutputPath(): string {
    try {
      const settings = getSettings();
      if (settings.recording?.outputPath?.trim()) {
        return settings.recording.outputPath;
      }
    } catch {
      // Settings may not be available during initialization
    }

    // Default: app resources/recordings directory
    const appPath = app.isPackaged
      ? path.dirname(app.getPath('exe'))
      : app.getAppPath();
    return path.join(appPath, 'recordings');
  }

  /**
   * Ensure the output directory exists
   */
  private ensureOutputDirectory(outputPath?: string): void {
    const targetPath = outputPath || this.getOutputPath();
    try {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create recording output directory:', error);
    }
  }

  /**
   * Check if FFmpeg is available
   */
  isAvailable(): boolean {
    return isFFmpegAvailable();
  }

  /**
   * Get FFmpeg validation status
   */
  getFFmpegStatus(): { available: boolean; path: string | null; error?: string } {
    return validateFFmpeg();
  }

  /**
   * Start screen recording
   */
  async startScreenRecording(options: RecordingOptions = {}): Promise<Recording> {
    if (process.platform !== 'win32') {
      throw new Error('Screen recording is currently only supported on Windows');
    }

    const ffmpegPath = getFFmpegPath();
    if (!ffmpegPath) {
      throw new Error('FFmpeg is not available. Please install FFmpeg to use recording features.');
    }

    // Check for existing screen recording
    const existingRecording = this.getActiveRecording(RecordingType.SCREEN);
    if (existingRecording) {
      throw new Error('A screen recording is already in progress');
    }

    const id = uuidv4();
    const audioSource = options.audioSource ?? AudioSource.SYSTEM;
    const fps = options.fps ?? 30;
    const outputPath = options.outputPath ?? this.getOutputPath();
    const filename = options.filename ?? `screen_${Date.now()}.mp4`;
    const fullPath = path.join(outputPath, filename);

    // Ensure output directory exists
    this.ensureOutputDirectory(outputPath);

    // Build FFmpeg command
    const args = this.buildScreenRecordingArgs(audioSource, fps, options.region, fullPath);

    const recording: Recording = {
      id,
      type: RecordingType.SCREEN,
      status: RecordingStatus.RECORDING,
      audioSource,
      filename,
      outputPath: fullPath,
      startTime: Date.now(),
      duration: 0,
      fileSize: 0,
      fps,
      region: options.region
    };

    this.recordings.set(id, recording);

    // Start FFmpeg process
    try {
      await this.startFFmpegProcess(id, ffmpegPath, args);
      this.startProgressMonitoring(id, fullPath);
      this.emit('recording-started', recording);
      return recording;
    } catch (error) {
      this.recordings.delete(id);
      throw error;
    }
  }

  /**
   * Start audio-only recording
   */
  async startAudioRecording(options: RecordingOptions = {}): Promise<Recording> {
    if (process.platform !== 'win32') {
      throw new Error('Audio recording is currently only supported on Windows');
    }

    const ffmpegPath = getFFmpegPath();
    if (!ffmpegPath) {
      throw new Error('FFmpeg is not available. Please install FFmpeg to use recording features.');
    }

    // Check for existing audio recording
    const existingRecording = this.getActiveRecording(RecordingType.AUDIO);
    if (existingRecording) {
      throw new Error('An audio recording is already in progress');
    }

    const id = uuidv4();
    const audioSource = options.audioSource ?? AudioSource.MICROPHONE;
    const format = options.format ?? 'mp3';
    const outputPath = options.outputPath ?? this.getOutputPath();
    const filename = options.filename ?? `audio_${Date.now()}.${format}`;
    const fullPath = path.join(outputPath, filename);

    // Ensure output directory exists
    this.ensureOutputDirectory(outputPath);

    // Build FFmpeg command for audio
    const args = this.buildAudioRecordingArgs(audioSource, format, fullPath);

    const recording: Recording = {
      id,
      type: RecordingType.AUDIO,
      status: RecordingStatus.RECORDING,
      audioSource,
      filename,
      outputPath: fullPath,
      startTime: Date.now(),
      duration: 0,
      fileSize: 0
    };

    this.recordings.set(id, recording);

    // Start FFmpeg process
    try {
      await this.startFFmpegProcess(id, ffmpegPath, args);
      this.startProgressMonitoring(id, fullPath);
      this.emit('recording-started', recording);
      return recording;
    } catch (error) {
      this.recordings.delete(id);
      throw error;
    }
  }

  /**
   * Start webcam recording
   */
  async startWebcamRecording(options: RecordingOptions = {}): Promise<Recording> {
    if (process.platform !== 'win32') {
      throw new Error('Webcam recording is currently only supported on Windows');
    }

    const ffmpegPath = getFFmpegPath();
    if (!ffmpegPath) {
      throw new Error('FFmpeg is not available. Please install FFmpeg to use recording features.');
    }

    // Check for existing webcam recording
    const existingRecording = this.getActiveRecording(RecordingType.WEBCAM);
    if (existingRecording) {
      throw new Error('A webcam recording is already in progress');
    }

    const id = uuidv4();
    const audioSource = options.audioSource ?? AudioSource.MICROPHONE;
    const outputPath = options.outputPath ?? this.getOutputPath();
    const filename = options.filename ?? `webcam_${Date.now()}.mp4`;
    const fullPath = path.join(outputPath, filename);

    // Ensure output directory exists
    this.ensureOutputDirectory(outputPath);

    // Build FFmpeg command for webcam
    const args = this.buildWebcamRecordingArgs(audioSource, fullPath);

    const recording: Recording = {
      id,
      type: RecordingType.WEBCAM,
      status: RecordingStatus.RECORDING,
      audioSource,
      filename,
      outputPath: fullPath,
      startTime: Date.now(),
      duration: 0,
      fileSize: 0
    };

    this.recordings.set(id, recording);

    // Start FFmpeg process
    try {
      await this.startFFmpegProcess(id, ffmpegPath, args);
      this.startProgressMonitoring(id, fullPath);
      this.emit('recording-started', recording);
      return recording;
    } catch (error) {
      this.recordings.delete(id);
      throw error;
    }
  }

  /**
   * Stop a recording by ID or type
   */
  async stopRecording(idOrType?: string | RecordingType): Promise<Recording | null> {
    let recording: Recording | undefined;

    if (!idOrType) {
      // Stop any active recording
      recording = Array.from(this.recordings.values()).find(
        r => r.status === RecordingStatus.RECORDING
      );
    } else if (Object.values(RecordingType).includes(idOrType as RecordingType)) {
      // Stop by type
      recording = this.getActiveRecording(idOrType as RecordingType);
    } else {
      // Stop by ID
      recording = this.recordings.get(idOrType);
    }

    if (!recording) {
      return null;
    }

    if (recording.status !== RecordingStatus.RECORDING) {
      return recording;
    }

    recording.status = RecordingStatus.STOPPING;
    this.recordings.set(recording.id, recording);

    // Stop the FFmpeg process
    const process = this.processes.get(recording.id);
    if (process) {
      // Send 'q' to gracefully stop FFmpeg
      process.stdin?.write('q');

      // Wait for process to end or force kill after timeout
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          process.kill('SIGKILL');
          resolve();
        }, 5000);

        process.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    // Stop progress monitoring
    const interval = this.progressIntervals.get(recording.id);
    if (interval) {
      clearInterval(interval);
      this.progressIntervals.delete(recording.id);
    }

    // Update recording status
    recording.status = RecordingStatus.COMPLETED;
    recording.endTime = Date.now();
    recording.duration = (recording.endTime - recording.startTime) / 1000;

    // Get final file size
    try {
      const stats = fs.statSync(recording.outputPath);
      recording.fileSize = stats.size;
    } catch {
      // File may not exist if recording failed
    }

    this.recordings.set(recording.id, recording);
    this.processes.delete(recording.id);
    this.emit('recording-stopped', recording);

    return recording;
  }

  /**
   * Get recording status
   */
  getStatus(idOrType?: string | RecordingType): Recording | null {
    if (!idOrType) {
      // Return any active recording
      return Array.from(this.recordings.values()).find(
        r => r.status === RecordingStatus.RECORDING
      ) || null;
    }

    if (Object.values(RecordingType).includes(idOrType as RecordingType)) {
      return this.getActiveRecording(idOrType as RecordingType) || null;
    }

    return this.recordings.get(idOrType) || null;
  }

  /**
   * Get all recordings
   */
  getAllRecordings(): Recording[] {
    return Array.from(this.recordings.values());
  }

  /**
   * List available audio devices
   */
  async listAudioDevices(): Promise<AudioDevice[]> {
    if (process.platform !== 'win32') {
      throw new Error('Device listing is currently only supported on Windows');
    }

    const ffmpegPath = getFFmpegPath();
    if (!ffmpegPath) {
      throw new Error('FFmpeg is not available');
    }

    return new Promise((resolve, reject) => {
      const args = ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'];
      const proc = spawn(ffmpegPath, args);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', () => {
        const devices: AudioDevice[] = [];
        const lines = stderr.split('\n');
        let isAudio = false;

        for (const line of lines) {
          if (line.includes('DirectShow audio devices')) {
            isAudio = true;
            continue;
          }
          if (line.includes('DirectShow video devices')) {
            isAudio = false;
            continue;
          }

          if (isAudio) {
            const match = line.match(/"([^"]+)"/);
            if (match && !line.includes('Alternative name')) {
              devices.push({
                name: match[1],
                type: 'input'
              });
            }
          }
        }

        resolve(devices);
      });

      proc.on('error', reject);
    });
  }

  /**
   * List available video devices
   */
  async listVideoDevices(): Promise<VideoDevice[]> {
    if (process.platform !== 'win32') {
      throw new Error('Device listing is currently only supported on Windows');
    }

    const ffmpegPath = getFFmpegPath();
    if (!ffmpegPath) {
      throw new Error('FFmpeg is not available');
    }

    return new Promise((resolve, reject) => {
      const args = ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'];
      const proc = spawn(ffmpegPath, args);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', () => {
        const devices: VideoDevice[] = [];
        const lines = stderr.split('\n');
        let isVideo = false;

        for (const line of lines) {
          if (line.includes('DirectShow video devices')) {
            isVideo = true;
            continue;
          }
          if (line.includes('DirectShow audio devices')) {
            isVideo = false;
            continue;
          }

          if (isVideo) {
            const match = line.match(/"([^"]+)"/);
            if (match && !line.includes('Alternative name')) {
              devices.push({
                name: match[1],
                type: 'webcam'
              });
            }
          }
        }

        resolve(devices);
      });

      proc.on('error', reject);
    });
  }

  /**
   * Cleanup on app exit
   */
  async cleanup(): Promise<void> {
    // Stop all active recordings
    for (const recording of this.recordings.values()) {
      if (recording.status === RecordingStatus.RECORDING) {
        await this.stopRecording(recording.id);
      }
    }

    // Kill any remaining processes
    for (const process of this.processes.values()) {
      process.kill('SIGKILL');
    }

    this.processes.clear();
    this.progressIntervals.forEach(interval => clearInterval(interval));
    this.progressIntervals.clear();
  }

  /**
   * Get active recording by type
   */
  private getActiveRecording(type: RecordingType): Recording | undefined {
    return Array.from(this.recordings.values()).find(
      r => r.type === type && r.status === RecordingStatus.RECORDING
    );
  }

  /**
   * Build FFmpeg arguments for screen recording
   */
  private buildScreenRecordingArgs(
    audioSource: AudioSource,
    fps: number,
    region: RecordingRegion | undefined,
    outputPath: string
  ): string[] {
    const args: string[] = [];

    // Video input (gdigrab for screen capture)
    args.push('-f', 'gdigrab');
    args.push('-framerate', fps.toString());

    // Region capture if specified
    if (region) {
      args.push('-offset_x', region.x.toString());
      args.push('-offset_y', region.y.toString());
      args.push('-video_size', `${region.width}x${region.height}`);
    }

    args.push('-i', 'desktop');

    // Audio input based on source
    if (audioSource !== AudioSource.NONE) {
      const audioDevice = this.getAudioInputDevice(audioSource);
      if (audioDevice) {
        args.push('-f', 'dshow');
        args.push('-i', `audio=${audioDevice}`);
      }
    }

    // Video codec settings
    args.push('-c:v', 'libx264');
    args.push('-preset', 'ultrafast');
    args.push('-crf', '23');

    // Audio codec settings
    if (audioSource !== AudioSource.NONE) {
      args.push('-c:a', 'aac');
      args.push('-b:a', '192k');
    }

    // Overwrite output file
    args.push('-y');
    args.push(outputPath);

    return args;
  }

  /**
   * Build FFmpeg arguments for audio recording
   */
  private buildAudioRecordingArgs(
    audioSource: AudioSource,
    format: string,
    outputPath: string
  ): string[] {
    const args: string[] = [];

    // Audio input
    const audioDevice = this.getAudioInputDevice(audioSource);
    if (!audioDevice) {
      throw new Error('No audio device available for the specified source');
    }

    args.push('-f', 'dshow');
    args.push('-i', `audio=${audioDevice}`);

    // Audio codec based on format
    switch (format) {
      case 'mp3':
        args.push('-c:a', 'libmp3lame');
        args.push('-b:a', '192k');
        break;
      case 'wav':
        args.push('-c:a', 'pcm_s16le');
        break;
      case 'aac':
        args.push('-c:a', 'aac');
        args.push('-b:a', '192k');
        break;
      default:
        args.push('-c:a', 'libmp3lame');
        args.push('-b:a', '192k');
    }

    args.push('-y');
    args.push(outputPath);

    return args;
  }

  /**
   * Build FFmpeg arguments for webcam recording
   */
  private buildWebcamRecordingArgs(
    audioSource: AudioSource,
    outputPath: string
  ): string[] {
    const args: string[] = [];

    // Use default video device
    args.push('-f', 'dshow');

    // Build input string with video and optional audio
    const videoDevice = 'video=Integrated Camera'; // Will be replaced with actual device discovery
    const audioDevice = this.getAudioInputDevice(audioSource);

    if (audioSource !== AudioSource.NONE && audioDevice) {
      args.push('-i', `${videoDevice}:audio=${audioDevice}`);
    } else {
      args.push('-i', videoDevice);
    }

    // Video codec settings
    args.push('-c:v', 'libx264');
    args.push('-preset', 'ultrafast');

    // Audio codec settings
    if (audioSource !== AudioSource.NONE) {
      args.push('-c:a', 'aac');
      args.push('-b:a', '192k');
    }

    args.push('-y');
    args.push(outputPath);

    return args;
  }

  /**
   * Get audio input device name based on source type
   */
  private getAudioInputDevice(source: AudioSource): string | null {
    // These are common Windows audio device names
    // In production, this should be replaced with actual device discovery
    switch (source) {
      case AudioSource.SYSTEM:
        return 'Stereo Mix';
      case AudioSource.MICROPHONE:
        return 'Microphone';
      case AudioSource.BOTH:
        // FFmpeg can only use one audio input directly
        // For both, we'd need complex audio mixing which is not implemented yet
        return 'Stereo Mix';
      case AudioSource.NONE:
      default:
        return null;
    }
  }

  /**
   * Start FFmpeg process
   */
  private async startFFmpegProcess(
    id: string,
    ffmpegPath: string,
    args: string[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let errorOutput = '';

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('error', (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });

      proc.on('exit', (code) => {
        const recording = this.recordings.get(id);
        if (recording && recording.status === RecordingStatus.RECORDING) {
          // Unexpected exit
          recording.status = RecordingStatus.ERROR;
          recording.error = `FFmpeg exited unexpectedly with code ${code}: ${errorOutput.slice(-500)}`;
          this.recordings.set(id, recording);
          this.emit('recording-error', recording);
        }
      });

      this.processes.set(id, proc);

      // Give FFmpeg a moment to start
      setTimeout(() => {
        if (proc.killed) {
          reject(new Error('FFmpeg process was killed'));
        } else {
          resolve();
        }
      }, 500);
    });
  }

  /**
   * Start monitoring recording progress
   */
  private startProgressMonitoring(id: string, outputPath: string): void {
    const interval = setInterval(() => {
      const recording = this.recordings.get(id);
      if (!recording || recording.status !== RecordingStatus.RECORDING) {
        clearInterval(interval);
        this.progressIntervals.delete(id);
        return;
      }

      // Update duration
      recording.duration = (Date.now() - recording.startTime) / 1000;

      // Update file size
      try {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          recording.fileSize = stats.size;
        }
      } catch {
        // Ignore file access errors
      }

      this.recordings.set(id, recording);
      this.emit('recording-progress', recording);

      // Check limits
      if (recording.fileSize >= MAX_FILE_SIZE_BYTES) {
        this.emit('recording-warning', {
          id,
          type: 'file-size',
          message: 'Recording has reached 1GB file size limit'
        });
      }

      if (recording.duration >= MAX_DURATION_SECONDS) {
        this.emit('recording-warning', {
          id,
          type: 'duration',
          message: 'Recording has reached 30 minute duration limit'
        });
      }
    }, 1000);

    this.progressIntervals.set(id, interval);
  }
}

// Export singleton instance
export const recordingManager = new RecordingManager();

// Export types for use elsewhere
export type { RecordingOptions, AudioDevice, VideoDevice };
