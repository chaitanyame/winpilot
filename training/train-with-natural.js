/**
 * Train ML model using Natural (pure JavaScript)
 * No native compilation required!
 */

const natural = require('natural');
const fs = require('fs');
const path = require('path');

console.log('🚀 Training ML Intent Classifier with Natural.js\n');

// Load training data
const trainingDataPath = path.join(__dirname, 'training_data.txt');
const testDataPath = path.join(__dirname, 'test_data.txt');

if (!fs.existsSync(trainingDataPath)) {
  console.error('❌ Training data not found!');
  console.error('Run: node training/generate-simple.js');
  process.exit(1);
}

const trainingData = fs.readFileSync(trainingDataPath, 'utf-8')
  .split('\n')
  .map(line => line.replace(/\r$/, ''))
  .filter(Boolean);
const testData = fs.readFileSync(testDataPath, 'utf-8')
  .split('\n')
  .map(line => line.replace(/\r$/, ''))
  .filter(Boolean);

console.log(`📊 Training data: ${trainingData.length} examples`);
console.log(`📊 Test data: ${testData.length} examples\n`);

// Create classifier
const classifier = new natural.BayesClassifier();

console.log('🎓 Training classifier...');
const startTime = Date.now();

// Train on each example
let trainedCount = 0;
for (const line of trainingData) {
  const match = line.match(/^__label__(\S+)\s+(.+)$/);
  if (match) {
    const [, label, text] = match;
    classifier.addDocument(text, label);
    trainedCount++;
  }
}

// Train the model
classifier.train();
const trainingTime = ((Date.now() - startTime) / 1000).toFixed(2);

console.log(`✅ Training complete in ${trainingTime}s`);
console.log(`   Trained on ${trainedCount} examples\n`);

// Evaluate on test data
console.log('📈 Evaluating on test data...\n');

let correct = 0;
let total = 0;
const confusionMatrix = {};

for (const line of testData) {
  const match = line.match(/^__label__(\S+)\s+(.+)$/);
  if (match) {
    const [, expected, text] = match;
    const predicted = classifier.classify(text);

    total++;
    if (predicted === expected) {
      correct++;
    }

    // Track confusion
    if (!confusionMatrix[expected]) {
      confusionMatrix[expected] = {};
    }
    confusionMatrix[expected][predicted] = (confusionMatrix[expected][predicted] || 0) + 1;
  }
}

const accuracy = (correct / total) * 100;

console.log('=== EVALUATION RESULTS ===');
console.log(`  Total samples: ${total}`);
console.log(`  Correct: ${correct}`);
console.log(`  Accuracy: ${accuracy.toFixed(2)}%`);
console.log('');

// Show examples with confidence scores
console.log('=== EXAMPLE PREDICTIONS ===\n');

const examples = [
  'list windows',
  'set volume to 50',
  'what is my system info',
  'launch chrome',
  'remind me in 30 minutes',
  'show me all open windows',
  'mute',
  'take screenshot',
  'wifi status',
  'start pomodoro'
];

for (const example of examples) {
  const predicted = classifier.classify(example);
  const classifications = classifier.getClassifications(example);
  const confidence = (classifications[0].value * 100).toFixed(1);

  // Show alternatives if confidence is low
  if (classifications[0].value < 0.7 && classifications.length > 1) {
    const alt = classifications[1].label;
    const altConf = (classifications[1].value * 100).toFixed(1);
    console.log(`  "${example}"`);
    console.log(`    → ${predicted} (${confidence}%)  [alt: ${alt} (${altConf}%)]`);
  } else {
    console.log(`  "${example}" → ${predicted} (${confidence}%)`);
  }
}

// Save the model
const modelsDir = path.join(__dirname, '..', 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const modelPath = path.join(modelsDir, 'intent_model.json');
classifier.save(modelPath, (err) => {
  if (err) {
    console.error('\n❌ Error saving model:', err);
    process.exit(1);
  }

  const modelSize = (fs.statSync(modelPath).size / 1024).toFixed(2);
  console.log(`\n✅ Model saved to: ${modelPath}`);
  console.log(`   Size: ${modelSize} KB\n`);

  console.log('🎉 Training complete! The model is ready to use.');
  console.log('\n📝 Note: This uses Naive Bayes (simpler than FastText)');
  console.log('   Expected production accuracy: 70-85%');
  console.log('   Fast inference: <10ms\n');
});
