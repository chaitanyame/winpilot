// Text-to-Speech using Windows System.Speech.Synthesis

import { runPowerShell } from './powershell-pool';
import { exec, ChildProcess } from 'child_process';

export interface TTSOptions {
  voice?: string;
  rate?: number;    // -10 to 10
  volume?: number;  // 0-100
}

export interface TTSVoice {
  name: string;
  culture: string;
  gender: string;
}

let currentTTSProcess: ChildProcess | null = null;

export async function listVoices(): Promise<TTSVoice[]> {
  const script = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voices = $synth.GetInstalledVoices() | ForEach-Object { @{ name = $_.VoiceInfo.Name; culture = $_.VoiceInfo.Culture.Name; gender = $_.VoiceInfo.Gender.ToString() } }; $synth.Dispose(); $voices | ConvertTo-Json -Compress`;

  try {
    const { stdout } = await runPowerShell(script);
    const parsed = JSON.parse(stdout.trim());
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export async function speak(text: string, options: TTSOptions = {}): Promise<boolean> {
  await stopSpeaking();

  const { voice, rate = 0, volume = 100 } = options;

  const safeText = text
    .replace(/'/g, "''")
    .replace(/[\r\n]+/g, ' ')
    .substring(0, 5000);

  const voiceLine = voice
    ? `$synth.SelectVoice('${voice.replace(/'/g, "''")}');`
    : '';

  const script = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; ${voiceLine} $synth.Rate = ${Math.max(-10, Math.min(10, rate))}; $synth.Volume = ${Math.max(0, Math.min(100, volume))}; $synth.Speak('${safeText}'); $synth.Dispose()`;

  return new Promise((resolve) => {
    currentTTSProcess = exec(
      `powershell -NoProfile -Command "${script}"`,
      { timeout: 120000 },
      (error) => {
        currentTTSProcess = null;
        resolve(!error);
      }
    );
  });
}

export async function stopSpeaking(): Promise<void> {
  if (currentTTSProcess) {
    currentTTSProcess.kill();
    currentTTSProcess = null;
  }
}
