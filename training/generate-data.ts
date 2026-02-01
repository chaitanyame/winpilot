/**
 * Training Data Generator
 *
 * This script generates synthetic training data for the FastText intent classifier.
 * It uses the LLM to generate variations of user queries for each tool.
 *
 * Usage: npm run train:generate-data
 */

import { desktopCommanderTools } from '../src/tools/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tool metadata for training data generation
 */
interface ToolInfo {
  name: string;
  description: string;
}

/**
 * Extract tool information from desktopCommanderTools
 */
function extractToolInfo(): ToolInfo[] {
  const tools: ToolInfo[] = [];

  for (const tool of desktopCommanderTools) {
    const toolName = (tool as any).name;
    const toolDescription = (tool as any).description;

    if (toolName && toolDescription) {
      tools.push({
        name: toolName,
        description: toolDescription,
      });
    }
  }

  return tools;
}

/**
 * Generate example queries for a tool
 * In production, this would use LLM to generate variations
 * For now, we'll use rule-based generation
 */
function generateExamples(tool: ToolInfo): string[] {
  const examples: string[] = [];
  const baseName = tool.name;
  const desc = tool.description.toLowerCase();

  // Generate variations based on tool type
  if (baseName.includes('list')) {
    examples.push(`list ${desc.match(/list (.*)/)?.[1] || ''}`);
    examples.push(`show ${desc.match(/list (.*)/)?.[1] || ''}`);
    examples.push(`get ${desc.match(/list (.*)/)?.[1] || ''}`);
    examples.push(`display ${desc.match(/list (.*)/)?.[1] || ''}`);
    examples.push(`what ${desc.match(/list (.*)/)?.[1] || ''}`);
  }

  if (baseName.includes('info')) {
    const subject = baseName.replace('_info', '');
    examples.push(`${subject} info`);
    examples.push(`${subject} information`);
    examples.push(`${subject} details`);
    examples.push(`show ${subject} info`);
    examples.push(`get ${subject} information`);
    examples.push(`what is my ${subject}`);
    examples.push(`tell me about ${subject}`);
  }

  if (baseName === 'system_volume') {
    examples.push('what is the volume');
    examples.push('check volume');
    examples.push('get volume');
    examples.push('set volume to 50');
    examples.push('change volume to 75');
    examples.push('volume 80');
    examples.push('mute');
    examples.push('unmute');
    examples.push('mute volume');
    examples.push('increase volume');
    examples.push('decrease volume');
  }

  if (baseName === 'apps_launch') {
    examples.push('launch chrome');
    examples.push('open notepad');
    examples.push('start firefox');
    examples.push('run calculator');
    examples.push('open vscode');
  }

  if (baseName === 'apps_quit') {
    examples.push('quit chrome');
    examples.push('close notepad');
    examples.push('stop firefox');
    examples.push('kill calculator');
    examples.push('exit vscode');
  }

  if (baseName === 'window_focus') {
    examples.push('focus chrome');
    examples.push('switch to notepad');
    examples.push('bring up firefox');
    examples.push('show calculator');
  }

  if (baseName === 'productivity_countdown') {
    examples.push('set timer for 5 minutes');
    examples.push('countdown 10 minutes');
    examples.push('timer 25 min');
    examples.push('start countdown 30 minutes');
    examples.push('create timer 1 hour');
  }

  if (baseName === 'productivity_pomodoro') {
    examples.push('start pomodoro');
    examples.push('pomodoro timer');
    examples.push('begin pomodoro');
    examples.push('create pomodoro');
  }

  if (baseName === 'set_reminder') {
    examples.push('remind me in 30 minutes');
    examples.push('set reminder for 1 hour');
    examples.push('reminder in 15 min');
    examples.push('remind me to call john in 2 hours');
    examples.push('set reminder to take break in 45 minutes');
  }

  if (baseName === 'clipboard_read') {
    examples.push('read clipboard');
    examples.push('what is in clipboard');
    examples.push('show clipboard');
    examples.push('get clipboard');
    examples.push('check clipboard');
  }

  if (baseName === 'clipboard_write') {
    examples.push('copy to clipboard "hello"');
    examples.push('write to clipboard "test"');
    examples.push('set clipboard to "data"');
  }

  if (baseName === 'clipboard_clear') {
    examples.push('clear clipboard');
    examples.push('empty clipboard');
    examples.push('delete clipboard');
  }

  if (baseName === 'system_lock') {
    examples.push('lock screen');
    examples.push('lock computer');
    examples.push('lock my pc');
    examples.push('secure screen');
  }

  if (baseName === 'system_sleep') {
    examples.push('sleep computer');
    examples.push('put computer to sleep');
    examples.push('hibernate pc');
    examples.push('suspend system');
  }

  if (baseName === 'system_wifi') {
    examples.push('turn on wifi');
    examples.push('enable wifi');
    examples.push('wifi on');
    examples.push('turn off wifi');
    examples.push('disable wifi');
    examples.push('wifi off');
    examples.push('wifi status');
    examples.push('check wifi');
    examples.push('list wifi networks');
  }

  if (baseName === 'system_screenshot') {
    examples.push('take screenshot');
    examples.push('capture screen');
    examples.push('screenshot');
    examples.push('grab screenshot');
  }

  if (baseName === 'productivity_convert') {
    examples.push('convert 100 km to miles');
    examples.push('50 pounds to kg');
    examples.push('convert 32 fahrenheit to celsius');
    examples.push('10 meters to feet');
  }

  // If no specific examples, generate from description
  if (examples.length === 0) {
    examples.push(desc);
    examples.push(`${baseName.replace(/_/g, ' ')}`);
  }

  return examples;
}

/**
 * Main function to generate training data
 */
async function main() {
  console.log('Generating training data for FastText intent classifier...\n');

  const tools = extractToolInfo();
  console.log(`Found ${tools.length} tools\n`);

  const trainingData: string[] = [];

  for (const tool of tools) {
    console.log(`Generating examples for: ${tool.name}`);
    const examples = generateExamples(tool);

    for (const example of examples) {
      // FastText format: __label__<intent> <text>
      trainingData.push(`__label__${tool.name} ${example}`);
    }

    console.log(`  Generated ${examples.length} examples`);
  }

  console.log(`\nTotal training examples: ${trainingData.length}`);

  // Shuffle data
  const shuffled = trainingData.sort(() => Math.random() - 0.5);

  // Split into train (80%) and test (20%)
  const splitIndex = Math.floor(shuffled.length * 0.8);
  const trainData = shuffled.slice(0, splitIndex);
  const testData = shuffled.slice(splitIndex);

  // Write to files
  const trainingDir = path.join(__dirname);
  const trainPath = path.join(trainingDir, 'training_data.txt');
  const testPath = path.join(trainingDir, 'test_data.txt');

  fs.writeFileSync(trainPath, trainData.join('\n'), 'utf-8');
  fs.writeFileSync(testPath, testData.join('\n'), 'utf-8');

  console.log(`\nTraining data written to: ${trainPath}`);
  console.log(`Test data written to: ${testPath}`);
  console.log(`\nTraining examples: ${trainData.length}`);
  console.log(`Test examples: ${testData.length}`);

  console.log('\nNext steps:');
  console.log('1. Review the generated data in training_data.txt and test_data.txt');
  console.log('2. Optionally add more examples manually');
  console.log('3. Run: npm run train:model');
}

main().catch(console.error);
