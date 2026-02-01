/**
 * Simple Training Data Generator (JavaScript version)
 * Generates training examples for all known tools
 */

const fs = require('fs');
const path = require('path');

// All known tools from patterns
const TOOLS = [
  // Window Management
  { name: 'window_list', examples: [
    'list windows', 'show windows', 'get windows', 'display windows',
    'what windows are open', 'show open windows', 'list all windows',
    'display open windows', 'what windows are active', 'show active windows'
  ]},
  { name: 'window_focus', examples: [
    'focus chrome', 'switch to notepad', 'bring up firefox',
    'show calculator', 'focus vscode', 'switch to edge',
    'bring up browser', 'focus window'
  ]},
  { name: 'window_close', examples: [
    'close window', 'close chrome', 'close notepad',
    'quit window', 'exit window'
  ]},

  // System Information
  { name: 'system_info', examples: [
    'system info', 'system information', 'computer info',
    'what is my system', 'show system info', 'get system information',
    'tell me about my computer', 'computer details', 'pc info',
    'machine info', 'show me system stats'
  ]},
  { name: 'network_info', examples: [
    'network info', 'network information', 'wifi status',
    'what is my ip', 'show network info', 'get network status',
    'internet info', 'connection info', 'network details'
  ]},

  // System Volume
  { name: 'system_volume', examples: [
    'what is the volume', 'check volume', 'get volume',
    'show volume', 'volume level', 'what is my volume',
    'set volume to 50', 'change volume to 75', 'volume 80',
    'adjust volume to 60', 'mute', 'unmute', 'mute volume',
    'unmute sound', 'increase volume', 'decrease volume',
    'turn up volume', 'turn down volume', 'raise volume', 'lower volume'
  ]},

  // Apps
  { name: 'apps_list', examples: [
    'list apps', 'show apps', 'get applications', 'display programs',
    'what apps are running', 'show running apps', 'list applications',
    'running programs', 'installed apps'
  ]},
  { name: 'apps_launch', examples: [
    'launch chrome', 'open notepad', 'start firefox', 'run calculator',
    'open vscode', 'start edge', 'launch terminal', 'run cmd',
    'open browser', 'start word'
  ]},
  { name: 'apps_quit', examples: [
    'quit chrome', 'close notepad', 'stop firefox', 'kill calculator',
    'exit vscode', 'quit edge', 'close browser', 'stop word',
    'force quit chrome', 'force close firefox'
  ]},

  // Process
  { name: 'process_list', examples: [
    'list processes', 'show processes', 'get tasks', 'display processes',
    'what processes are running', 'show running processes', 'task list'
  ]},

  // Clipboard
  { name: 'clipboard_read', examples: [
    'read clipboard', 'what is in clipboard', 'show clipboard',
    'get clipboard', 'check clipboard', 'clipboard content',
    'what did i copy', 'show copied text'
  ]},
  { name: 'clipboard_write', examples: [
    'copy to clipboard hello', 'write to clipboard test',
    'set clipboard to data', 'clipboard write text'
  ]},
  { name: 'clipboard_clear', examples: [
    'clear clipboard', 'empty clipboard', 'delete clipboard',
    'wipe clipboard', 'reset clipboard'
  ]},

  // Service
  { name: 'service_list', examples: [
    'list services', 'show services', 'get services',
    'what services are running', 'display services', 'service status'
  ]},

  // System Control
  { name: 'system_lock', examples: [
    'lock screen', 'lock computer', 'lock my pc',
    'secure screen', 'lock it', 'lock this'
  ]},
  { name: 'system_sleep', examples: [
    'sleep computer', 'put computer to sleep', 'hibernate pc',
    'suspend system', 'sleep', 'hibernate', 'suspend'
  ]},
  { name: 'system_wifi', examples: [
    'turn on wifi', 'enable wifi', 'wifi on', 'activate wifi',
    'turn off wifi', 'disable wifi', 'wifi off', 'deactivate wifi',
    'wifi status', 'check wifi', 'list wifi networks',
    'show wifi networks', 'available wifi', 'toggle wifi'
  ]},
  { name: 'system_dnd', examples: [
    'turn on do not disturb', 'enable dnd', 'dnd on',
    'turn off do not disturb', 'disable dnd', 'dnd off',
    'dnd status', 'check do not disturb'
  ]},
  { name: 'system_screenshot', examples: [
    'take screenshot', 'capture screen', 'screenshot',
    'grab screenshot', 'screen capture', 'take a picture of screen'
  ]},

  // Productivity
  { name: 'productivity_countdown', examples: [
    'timer 25 minutes', 'countdown 10 minutes', 'set timer for 5 minutes',
    'timer 30 min', 'start countdown 15 minutes', 'create timer 1 hour',
    'timer for 20 minutes', 'countdown for 30 min'
  ]},
  { name: 'productivity_pomodoro', examples: [
    'start pomodoro', 'pomodoro timer', 'begin pomodoro',
    'create pomodoro', 'pomodoro', 'start pomo'
  ]},
  { name: 'productivity_worldclock', examples: [
    'world clock', 'time in different zones', 'time zones',
    'what time in london', 'clock for cities', 'world time'
  ]},
  { name: 'productivity_convert', examples: [
    'convert 100 km to miles', '50 pounds to kg',
    'convert 32 fahrenheit to celsius', '10 meters to feet',
    '5 inches to cm', '100 dollars to euros'
  ]},

  // Reminders
  { name: 'set_reminder', examples: [
    'remind me in 30 minutes', 'set reminder for 1 hour',
    'reminder in 15 min', 'remind me to call john in 2 hours',
    'set reminder to take break in 45 minutes',
    'remind me in one hour', 'reminder for 3pm'
  ]},
  { name: 'list_reminders', examples: [
    'list reminders', 'show reminders', 'get reminders',
    'what reminders do i have', 'display reminders', 'my reminders'
  ]},
];

console.log('Generating training data for FastText...\n');
console.log(`Total tools: ${TOOLS.length}\n`);

const trainingData = [];
let totalExamples = 0;

for (const tool of TOOLS) {
  console.log(`Generating examples for: ${tool.name}`);

  for (const example of tool.examples) {
    // FastText format: __label__<intent> <text>
    trainingData.push(`__label__${tool.name} ${example}`);
    totalExamples++;
  }

  console.log(`  Generated ${tool.examples.length} examples`);
}

console.log(`\nTotal training examples: ${totalExamples}`);

// Shuffle data
const shuffled = trainingData.sort(() => Math.random() - 0.5);

// Split into train (80%) and test (20%)
const splitIndex = Math.floor(shuffled.length * 0.8);
const trainData = shuffled.slice(0, splitIndex);
const testData = shuffled.slice(splitIndex);

// Write to files
const trainingDir = __dirname;
const trainPath = path.join(trainingDir, 'training_data.txt');
const testPath = path.join(trainingDir, 'test_data.txt');

fs.writeFileSync(trainPath, trainData.join('\n'), 'utf-8');
fs.writeFileSync(testPath, testData.join('\n'), 'utf-8');

console.log(`\nTraining data written to: ${trainPath}`);
console.log(`Test data written to: ${testPath}`);
console.log(`\nTraining examples: ${trainData.length}`);
console.log(`Test examples: ${testData.length}`);
console.log('\nNext step: npm install fasttext-node && npm run train:model');
