/**
 * Advanced Training Script for 95% Accuracy
 * Uses Natural.js with optimized settings:
 * - More training data (711 examples)
 * - Case normalization
 * - Better tokenization
 */

const natural = require('natural');
const fs = require('fs');
const path = require('path');

console.log('🎯 Training Advanced ML Model for 95% Accuracy\n');

// Load training data
const trainingDataPath = path.join(__dirname, 'training_data.txt');
const testDataPath = path.join(__dirname, 'test_data.txt');

if (!fs.existsSync(trainingDataPath)) {
  console.error('❌ Training data not found!');
  console.error('Run: node training/generate-comprehensive.js');
  process.exit(1);
}

const trainingData = fs.readFileSync(trainingDataPath, 'utf-8').split('\n').filter(Boolean);
const testData = fs.readFileSync(testDataPath, 'utf-8').split('\n').filter(Boolean);

console.log(`📊 Training data: ${trainingData.length} examples`);
console.log(`📊 Test data: ${testData.length} examples`);
console.log(`📊 Total: ${trainingData.length + testData.length} examples\n`);

// Create classifier with stemming
console.log('🔧 Configuring classifier...');
const classifier = new natural.BayesClassifier();

console.log('🎓 Training classifier...');
const startTime = Date.now();

// Train on each example
let trainedCount = 0;
const toolCounts = {};

for (const line of trainingData) {
  const match = line.match(/^__label__(\S+)\s+(.+)$/);
  if (match) {
    const [, label, text] = match;

    // Add document (Natural.js handles stemming internally)
    classifier.addDocument(text.toLowerCase(), label);

    toolCounts[label] = (toolCounts[label] || 0) + 1;
    trainedCount++;
  }
}

// Train the model
classifier.train();
const trainingTime = ((Date.now() - startTime) / 1000).toFixed(2);

console.log(`✅ Training complete in ${trainingTime}s`);
console.log(`   Trained on ${trainedCount} examples`);
console.log(`   ${Object.keys(toolCounts).length} unique tools\n`);

// Evaluate on test data
console.log('📈 Evaluating on test data...\n');

let correct = 0;
let total = 0;
const confusionMatrix = {};
const errors = [];

for (const line of testData) {
  const match = line.match(/^__label__(\S+)\s+(.+)$/);
  if (match) {
    const [, expected, text] = match;
    const predicted = classifier.classify(text.toLowerCase());
    const classifications = classifier.getClassifications(text.toLowerCase());
    const confidence = classifications[0].value;

    total++;
    if (predicted === expected) {
      correct++;
    } else {
      // Track errors for analysis
      errors.push({
        text,
        expected,
        predicted,
        confidence,
        alternatives: classifications.slice(0, 3).map(c => ({
          label: c.label,
          conf: (c.value * 100).toFixed(1)
        }))
      });
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
console.log(`  Incorrect: ${total - correct}`);
console.log(`  Accuracy: ${accuracy.toFixed(2)}%`);
console.log('');

// Show improvement
if (accuracy >= 90) {
  console.log('🎉 EXCELLENT! Accuracy >= 90%');
} else if (accuracy >= 85) {
  console.log('✅ GOOD! Accuracy >= 85%');
} else if (accuracy >= 80) {
  console.log('👍 Decent! Accuracy >= 80%');
} else {
  console.log('⚠️  Accuracy below 80%, may need more data or tuning');
}
console.log('');

// Show errors for analysis (if any)
if (errors.length > 0 && errors.length <= 20) {
  console.log('=== CLASSIFICATION ERRORS ===\n');
  errors.forEach((err, i) => {
    console.log(`${i + 1}. "${err.text}"`);
    console.log(`   Expected: ${err.expected}`);
    console.log(`   Predicted: ${err.predicted} (${(err.alternatives[0].conf)}%)`);
    if (err.alternatives.length > 1) {
      console.log(`   Alternatives: ${err.alternatives.slice(1).map(a => `${a.label} (${a.conf}%)`).join(', ')}`);
    }
    console.log('');
  });
}

// Show confusion matrix for most confused classes
console.log('=== MOST CONFUSED PAIRS ===\n');
const confusedPairs = [];
for (const expected in confusionMatrix) {
  for (const predicted in confusionMatrix[expected]) {
    if (expected !== predicted && confusionMatrix[expected][predicted] > 1) {
      confusedPairs.push({
        expected,
        predicted,
        count: confusionMatrix[expected][predicted]
      });
    }
  }
}
confusedPairs.sort((a, b) => b.count - a.count);
if (confusedPairs.length > 0) {
  confusedPairs.slice(0, 5).forEach(pair => {
    console.log(`  ${pair.expected} → ${pair.predicted}: ${pair.count} times`);
  });
} else {
  console.log('  No significant confusion pairs!');
}
console.log('');

// Show examples with confidence scores
console.log('=== EXAMPLE PREDICTIONS ===\n');

const examples = [
  'list windows',
  'show me all open windows',
  'set volume to 50',
  'what is my system info',
  'launch chrome',
  'remind me in 30 minutes',
  'mute',
  'take screenshot',
  'wifi status',
  'start pomodoro',
  'convert 100 km to miles',
  'lock screen',
  'what is in clipboard'
];

for (const example of examples) {
  const predicted = classifier.classify(example.toLowerCase());
  const classifications = classifier.getClassifications(example.toLowerCase());
  const confidence = (classifications[0].value * 100).toFixed(1);

  // Show alternatives if confidence is low
  if (classifications[0].value < 0.8 && classifications.length > 1) {
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

  if (accuracy >= 95) {
    console.log('🎉🎉🎉 TARGET ACHIEVED! 95%+ Accuracy! 🎉🎉🎉\n');
  } else if (accuracy >= 90) {
    console.log(`🎯 Close! ${(95 - accuracy).toFixed(1)}% away from 95% target\n`);
  } else {
    console.log(`📈 Current accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`   ${(95 - accuracy).toFixed(1)}% improvement needed for 95% target\n`);
  }

  console.log('💡 To improve accuracy further:');
  console.log('   1. Add more examples for confused pairs');
  console.log('   2. Add more variations and typos');
  console.log('   3. Collect real user queries and retrain');
  console.log('');
});
