/**
 * Comprehensive Training Data Generator
 * Creates extensive training examples with variations, typos, synonyms, and phrasings
 * Target: 1000+ examples for 95% accuracy
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Generating Comprehensive Training Data for 95% Accuracy\n');

// Comprehensive tool definitions with extensive examples
const COMPREHENSIVE_TOOLS = [
  {
    name: 'window_list',
    examples: [
      // Direct commands
      'list windows', 'show windows', 'get windows', 'display windows', 'view windows',
      'list all windows', 'show all windows', 'display all windows',
      'what windows are open', 'what windows are running', 'which windows are open',
      'show open windows', 'show active windows', 'list open windows',
      'get all windows', 'get open windows', 'get active windows',
      // Variations
      'show me windows', 'show me all windows', 'show me open windows',
      'tell me what windows are open', 'tell me which windows are running',
      'display all open windows', 'display active windows',
      'i want to see all windows', 'i want to see open windows',
      'can you show me the windows', 'can you list the windows',
      // With typos
      'list windos', 'show windws', 'list wndows', 'display windoes',
      // Natural language
      'what apps do i have open', 'what programs are running',
      'show me everything that is open', 'what do i have open right now',
      'let me see all my windows', 'let me see what i have open',
      // Short forms
      'windows', 'open windows', 'my windows', 'all windows',
    ]
  },

  {
    name: 'window_focus',
    examples: [
      // With specific apps
      'focus chrome', 'focus firefox', 'focus notepad', 'focus vscode', 'focus edge',
      'switch to chrome', 'switch to firefox', 'switch to notepad', 'switch to vscode',
      'bring up chrome', 'bring up firefox', 'bring up notepad',
      'show chrome', 'show firefox', 'show notepad', 'show vscode',
      'go to chrome', 'go to firefox', 'go to notepad',
      // Variations
      'bring chrome to front', 'bring firefox to front',
      'make chrome active', 'make firefox active',
      'activate chrome', 'activate firefox', 'activate notepad',
      'i want to use chrome', 'i want to use firefox',
      'switch focus to chrome', 'switch focus to firefox',
      // Natural language
      'can you bring up chrome', 'please switch to firefox',
      'i need to see notepad', 'show me chrome window',
      // With typos
      'focus crome', 'switch to firefox', 'focus notpad',
    ]
  },

  {
    name: 'window_close',
    examples: [
      'close window', 'close chrome', 'close firefox', 'close notepad',
      'close the window', 'close this window', 'close that window',
      'quit window', 'exit window', 'kill window',
      'close vscode', 'close edge', 'close calculator',
      'shut down chrome', 'shut down firefox',
      'terminate window', 'terminate chrome',
      'get rid of this window', 'remove this window',
      'i want to close chrome', 'please close firefox',
      'can you close notepad', 'close the current window',
    ]
  },

  {
    name: 'system_info',
    examples: [
      // Direct
      'system info', 'system information', 'computer info', 'computer information',
      'pc info', 'pc information', 'machine info', 'machine information',
      'system details', 'computer details', 'pc details',
      'system stats', 'computer stats', 'pc stats',
      'system specifications', 'computer specifications', 'pc specifications',
      // Questions
      'what is my system', 'what is my computer', 'what is my pc',
      'what system do i have', 'what computer do i have',
      'tell me about my system', 'tell me about my computer',
      'show me system info', 'show me computer info',
      'get system information', 'get computer information',
      // Natural language
      'what are my system specs', 'what are my computer specs',
      'how much ram do i have', 'what cpu do i have',
      'tell me my computer specifications',
      'i want to know my system information',
      'can you show me my system details',
      'what kind of computer is this',
      // With typos
      'systm info', 'sytem information', 'computr info',
      // Variations
      'system', 'my system', 'my computer', 'about my computer',
      'hardware info', 'hardware information',
    ]
  },

  {
    name: 'network_info',
    examples: [
      'network info', 'network information', 'network status', 'network details',
      'wifi info', 'wifi information', 'wifi status', 'wifi details',
      'internet info', 'internet information', 'internet status',
      'connection info', 'connection information', 'connection status',
      'what is my ip', 'what is my ip address', 'show my ip',
      'get my ip', 'tell me my ip', 'my ip address',
      'network settings', 'wifi settings', 'internet settings',
      'show network info', 'show wifi info', 'show internet info',
      'get network information', 'get wifi information',
      'what network am i on', 'what wifi am i connected to',
      'am i connected to internet', 'am i online',
      'check network', 'check wifi', 'check internet',
      'network details', 'wifi details', 'connection details',
      // With typos
      'netwrk info', 'wfi info', 'intrnet info',
    ]
  },

  {
    name: 'system_volume',
    examples: [
      // Get volume
      'volume', 'get volume', 'check volume', 'show volume', 'what is the volume',
      'volume level', 'sound level', 'audio level',
      'what is my volume', 'what is the volume level', 'how loud is it',
      'current volume', 'tell me the volume',
      // Set volume
      'set volume to 50', 'set volume to 75', 'set volume to 100', 'set volume to 25',
      'change volume to 50', 'change volume to 75', 'adjust volume to 50',
      'volume 50', 'volume 75', 'volume 100', 'volume 25', 'volume 0',
      'make volume 50', 'make volume 75', 'set sound to 50',
      'set audio to 50', 'change sound to 50',
      // Mute/Unmute
      'mute', 'mute volume', 'mute sound', 'mute audio',
      'unmute', 'unmute volume', 'unmute sound', 'unmute audio',
      'turn off sound', 'turn off volume', 'silence',
      'turn on sound', 'turn on volume',
      // Increase/Decrease
      'increase volume', 'raise volume', 'turn up volume', 'make it louder',
      'decrease volume', 'lower volume', 'turn down volume', 'make it quieter',
      'volume up', 'volume down', 'louder', 'quieter',
      // Natural language
      'can you mute', 'please increase the volume',
      'i need to turn down the volume', 'make it quiet',
      // With typos
      'volum', 'volme', 'set volum to 50', 'increae volume',
    ]
  },

  {
    name: 'system_brightness',
    examples: [
      'brightness', 'get brightness', 'check brightness', 'show brightness',
      'set brightness to 50', 'set brightness to 75', 'set brightness to 100',
      'change brightness to 50', 'adjust brightness to 50',
      'brightness 50', 'brightness 75', 'brightness 100',
      'make brightness 50', 'screen brightness',
      'increase brightness', 'decrease brightness',
      'turn up brightness', 'turn down brightness',
      'make screen brighter', 'make screen darker',
      'dim screen', 'brighten screen',
      'what is the brightness', 'current brightness',
    ]
  },

  {
    name: 'apps_list',
    examples: [
      'list apps', 'list applications', 'list programs', 'show apps',
      'show applications', 'show programs', 'get apps', 'get applications',
      'display apps', 'display applications', 'view apps',
      'what apps are running', 'what apps are open', 'what apps are installed',
      'what applications are running', 'what programs are running',
      'show running apps', 'show open apps', 'show installed apps',
      'list running apps', 'list open apps', 'list installed apps',
      'running applications', 'open applications', 'installed applications',
      'my apps', 'my applications', 'my programs',
      'all apps', 'all applications', 'all programs',
      // With typos
      'list aplications', 'show aplication', 'running aps',
    ]
  },

  {
    name: 'apps_launch',
    examples: [
      // Different apps
      'launch chrome', 'launch firefox', 'launch notepad', 'launch vscode',
      'launch edge', 'launch calculator', 'launch word', 'launch excel',
      'open chrome', 'open firefox', 'open notepad', 'open vscode',
      'open edge', 'open calculator', 'open word', 'open excel',
      'start chrome', 'start firefox', 'start notepad', 'start vscode',
      'run chrome', 'run firefox', 'run notepad', 'run calculator',
      // Natural language
      'can you open chrome', 'please launch firefox',
      'i want to open notepad', 'i need to start vscode',
      'open chrome browser', 'start firefox browser',
      'launch text editor', 'open the calculator',
      // With typos
      'lanch chrome', 'opn firefox', 'start notpad',
      'launch crome', 'open firefox',
    ]
  },

  {
    name: 'apps_quit',
    examples: [
      'quit chrome', 'quit firefox', 'quit notepad', 'quit vscode',
      'close chrome', 'close firefox', 'close notepad', 'close vscode',
      'stop chrome', 'stop firefox', 'stop notepad',
      'kill chrome', 'kill firefox', 'kill notepad',
      'exit chrome', 'exit firefox', 'exit notepad', 'exit vscode',
      'terminate chrome', 'terminate firefox',
      'shut down chrome', 'shut down firefox',
      'force quit chrome', 'force quit firefox',
      'force close chrome', 'force close firefox',
      'force kill chrome', 'force kill firefox',
      'end chrome', 'end firefox', 'end notepad',
      // Natural language
      'can you close chrome', 'please quit firefox',
      'i want to stop notepad', 'close the browser',
    ]
  },

  {
    name: 'process_list',
    examples: [
      'list processes', 'show processes', 'get processes', 'display processes',
      'list tasks', 'show tasks', 'get tasks', 'display tasks',
      'what processes are running', 'what tasks are running',
      'show running processes', 'show running tasks',
      'process list', 'task list', 'task manager',
      'running processes', 'active processes',
      'all processes', 'my processes',
    ]
  },

  {
    name: 'clipboard_read',
    examples: [
      'read clipboard', 'get clipboard', 'show clipboard', 'check clipboard',
      'what is in clipboard', 'what is in the clipboard',
      'clipboard content', 'clipboard contents',
      'what did i copy', 'what did i cut', 'show copied text',
      'show what i copied', 'tell me what is in clipboard',
      'display clipboard', 'view clipboard',
      'paste', 'show paste', 'what can i paste',
      // With typos
      'clipbord', 'clipbaord', 'show clipoard',
    ]
  },

  {
    name: 'clipboard_write',
    examples: [
      'copy to clipboard hello', 'copy hello to clipboard',
      'write to clipboard test', 'write test to clipboard',
      'set clipboard to data', 'set clipboard data',
      'copy this text', 'copy the text',
      'put in clipboard', 'add to clipboard',
      'clipboard write hello', 'clipboard write test',
    ]
  },

  {
    name: 'clipboard_clear',
    examples: [
      'clear clipboard', 'empty clipboard', 'delete clipboard',
      'wipe clipboard', 'reset clipboard', 'erase clipboard',
      'remove clipboard', 'clean clipboard',
      'clear the clipboard', 'empty the clipboard',
      'delete clipboard content', 'clear copied text',
    ]
  },

  {
    name: 'service_list',
    examples: [
      'list services', 'show services', 'get services', 'display services',
      'what services are running', 'what services are active',
      'show running services', 'show active services',
      'service list', 'service status', 'services',
      'windows services', 'system services',
      'all services', 'running services',
    ]
  },

  {
    name: 'system_lock',
    examples: [
      'lock screen', 'lock computer', 'lock pc', 'lock system',
      'lock my screen', 'lock my computer', 'lock my pc',
      'lock it', 'lock this', 'lock the screen',
      'secure screen', 'secure computer', 'lock workstation',
      'screen lock', 'computer lock', 'pc lock',
      'i want to lock', 'please lock screen',
      'can you lock the computer', 'lock my machine',
      // With typos
      'lok screen', 'lock scren', 'lock compter',
    ]
  },

  {
    name: 'system_sleep',
    examples: [
      'sleep', 'sleep computer', 'sleep pc', 'sleep system',
      'put computer to sleep', 'put pc to sleep',
      'hibernate', 'hibernate pc', 'hibernate computer',
      'suspend', 'suspend system', 'suspend computer',
      'go to sleep', 'put to sleep', 'sleep mode',
      'make computer sleep', 'make pc sleep',
      // With typos
      'slep', 'hibrnate', 'suspnd',
    ]
  },

  {
    name: 'system_wifi',
    examples: [
      // Turn on
      'turn on wifi', 'wifi on', 'enable wifi', 'activate wifi',
      'switch on wifi', 'power on wifi', 'start wifi',
      // Turn off
      'turn off wifi', 'wifi off', 'disable wifi', 'deactivate wifi',
      'switch off wifi', 'power off wifi', 'stop wifi',
      // Status
      'wifi status', 'check wifi', 'wifi info', 'wifi information',
      'is wifi on', 'is wifi enabled', 'wifi state',
      // Toggle
      'toggle wifi', 'switch wifi', 'flip wifi',
      // List networks
      'list wifi networks', 'show wifi networks', 'available wifi',
      'wifi networks', 'show networks', 'nearby wifi',
      'scan wifi', 'find wifi networks',
      // With typos
      'wfi on', 'wifi of', 'trun on wifi', 'enable wfi',
    ]
  },

  {
    name: 'system_dnd',
    examples: [
      'turn on do not disturb', 'do not disturb on', 'enable dnd',
      'turn off do not disturb', 'do not disturb off', 'disable dnd',
      'dnd on', 'dnd off', 'activate dnd', 'deactivate dnd',
      'dnd status', 'check dnd', 'is dnd on',
      'do not disturb', 'dnd', 'do not disturb mode',
      'enable do not disturb', 'disable do not disturb',
      'turn on dnd', 'turn off dnd',
    ]
  },

  {
    name: 'system_screenshot',
    examples: [
      'screenshot', 'take screenshot', 'capture screenshot',
      'take a screenshot', 'grab screenshot', 'make screenshot',
      'screen capture', 'capture screen', 'take screen capture',
      'screenshot this', 'capture this screen',
      'take picture of screen', 'save screenshot',
      'print screen', 'screen shot', 'screencap',
      // With typos
      'screnshott', 'screenshott', 'take screnshott',
    ]
  },

  {
    name: 'productivity_countdown',
    examples: [
      // Different durations
      'timer 5 minutes', 'timer 10 minutes', 'timer 15 minutes',
      'timer 20 minutes', 'timer 25 minutes', 'timer 30 minutes',
      'countdown 5 minutes', 'countdown 10 minutes', 'countdown 15 minutes',
      'set timer for 5 minutes', 'set timer for 10 minutes',
      'set timer for 25 minutes', 'set timer for 30 minutes',
      'start timer 5 minutes', 'start timer 10 minutes',
      'create timer 5 minutes', 'create timer 10 minutes',
      // Short forms
      'timer 5 min', 'timer 10 min', 'timer 25 min', 'timer 30 min',
      'countdown 5 min', 'countdown 10 min',
      // Hours
      'timer 1 hour', 'timer 2 hours', 'countdown 1 hour',
      'set timer for 1 hour', 'set timer for 2 hours',
      // Natural language
      'set a timer for 25 minutes', 'i need a timer for 5 minutes',
      'can you set a timer for 10 minutes',
      'start a 25 minute timer', 'create a 30 minute countdown',
      // With typos
      'timer 25 minuts', 'countdown 10 minites',
    ]
  },

  {
    name: 'productivity_pomodoro',
    examples: [
      'pomodoro', 'start pomodoro', 'begin pomodoro', 'create pomodoro',
      'pomodoro timer', 'start pomodoro timer', 'begin pomodoro timer',
      'pomo', 'start pomo', 'pomodoro session',
      'start a pomodoro', 'create a pomodoro', 'new pomodoro',
      'i want to start pomodoro', 'can you start pomodoro',
      'start pomodoro technique', 'pomodoro mode',
      // With typos
      'pomadoro', 'pomodro', 'start pomadoro',
    ]
  },

  {
    name: 'productivity_worldclock',
    examples: [
      'world clock', 'world time', 'time zones', 'timezone',
      'time in different zones', 'time around the world',
      'what time is it in london', 'what time is it in new york',
      'what time is it in tokyo', 'time in paris',
      'clock for different cities', 'international time',
      'show world clock', 'display world time',
      'time in other countries', 'global time',
    ]
  },

  {
    name: 'productivity_convert',
    examples: [
      // Length
      'convert 100 km to miles', 'convert 50 miles to km',
      'convert 10 meters to feet', 'convert 5 feet to meters',
      '100 km to miles', '50 miles to km', '10 meters to feet',
      // Weight
      'convert 50 pounds to kg', 'convert 100 kg to pounds',
      '50 pounds to kg', '100 kg to pounds', '50 lb to kg',
      // Temperature
      'convert 32 fahrenheit to celsius', 'convert 100 celsius to fahrenheit',
      '32 fahrenheit to celsius', '100 celsius to fahrenheit',
      '32 f to c', '100 c to f',
      // Volume
      'convert 5 gallons to liters', '10 liters to gallons',
      // Natural language
      'how many miles is 100 km', 'how many kg is 50 pounds',
      'what is 32 fahrenheit in celsius',
    ]
  },

  {
    name: 'set_reminder',
    examples: [
      // Different delays
      'remind me in 30 minutes', 'remind me in 1 hour', 'remind me in 2 hours',
      'remind me in 15 minutes', 'remind me in 45 minutes',
      'set reminder for 30 minutes', 'set reminder for 1 hour',
      'set reminder in 30 minutes', 'set reminder in 1 hour',
      'reminder in 30 minutes', 'reminder in 1 hour', 'reminder in 15 min',
      // With message
      'remind me to call john in 30 minutes',
      'remind me to take break in 45 minutes',
      'remind me to check email in 1 hour',
      'set reminder to call mom in 2 hours',
      'remind me about meeting in 30 minutes',
      // Natural language
      'can you remind me in 30 minutes', 'please remind me in 1 hour',
      'i need a reminder in 30 minutes', 'set a reminder for 1 hour',
      'create a reminder for 30 minutes',
      // With typos
      'remind me in 30 minuts', 'set reminder for 1 our',
    ]
  },

  {
    name: 'list_reminders',
    examples: [
      'list reminders', 'show reminders', 'get reminders', 'display reminders',
      'what reminders do i have', 'what reminders are set',
      'show my reminders', 'show all reminders',
      'my reminders', 'all reminders', 'active reminders',
      'check reminders', 'view reminders',
      'what reminders are active', 'do i have any reminders',
    ]
  },
];

// Generate training data
const trainingData = [];
let totalExamples = 0;

console.log(`Processing ${COMPREHENSIVE_TOOLS.length} tools...\n`);

for (const tool of COMPREHENSIVE_TOOLS) {
  console.log(`✓ ${tool.name}: ${tool.examples.length} examples`);

  for (const example of tool.examples) {
    trainingData.push(`__label__${tool.name} ${example}`);
    totalExamples++;
  }
}

console.log(`\n📊 Total examples generated: ${totalExamples}`);
console.log(`📊 Average per tool: ${(totalExamples / COMPREHENSIVE_TOOLS.length).toFixed(1)}\n`);

// Shuffle data
console.log('🔀 Shuffling data...');
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

console.log(`\n✅ Training data: ${trainPath}`);
console.log(`   ${trainData.length} examples`);
console.log(`\n✅ Test data: ${testPath}`);
console.log(`   ${testData.length} examples`);

console.log('\n🎯 Target Accuracy: 95%+');
console.log('📈 Expected Improvement: +20-25% from previous 71%\n');
console.log('Next: node training/train-with-natural.js');
