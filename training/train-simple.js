/**
 * Simple FastText Model Training Script
 */

const fastText = require('fasttext-node');
const path = require('path');
const fs = require('fs');

async function main() {
  console.log('Training FastText intent classifier...\n');

  // Check if training data exists
  const trainingDir = __dirname;
  const trainDataPath = path.join(trainingDir, 'training_data.txt');
  const testDataPath = path.join(trainingDir, 'test_data.txt');

  if (!fs.existsSync(trainDataPath)) {
    console.error('Error: training_data.txt not found');
    console.error('Please run: node training/generate-simple.js');
    process.exit(1);
  }

  console.log('Input files:');
  console.log(`  Training data: ${trainDataPath}`);
  console.log(`  Test data: ${testDataPath}`);
  console.log('');

  // Output path
  const modelsDir = path.join(__dirname, '..', 'models');
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  const outputPath = path.join(modelsDir, 'intent_model');

  console.log('Training configuration:');
  console.log('  Algorithm: Supervised (softmax)');
  console.log('  Embedding dimension: 100');
  console.log('  Epochs: 25');
  console.log('  Learning rate: 0.5');
  console.log('  Word n-grams: 2 (bigrams)');
  console.log('');

  try {
    // Train the model
    console.log('Training model...');
    const startTime = Date.now();

    const model = await fastText.train({
      input: trainDataPath,
      output: outputPath,
      loss: 'softmax',        // Multi-class classification
      dim: 100,               // Embedding dimension
      epoch: 25,              // Training iterations
      lr: 0.5,                // Learning rate
      wordNgrams: 2,          // Use bigrams for better generalization
      minCount: 1,            // Include rare words
      bucket: 2000000,        // Hash bucket size
      thread: 4,              // Parallel training threads
    });

    const trainingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Training completed in ${trainingTime}s\n`);

    // Evaluate on test data if it exists
    if (fs.existsSync(testDataPath)) {
      console.log('Evaluating model on test data...');
      const result = await model.test(testDataPath);

      console.log('\n=== EVALUATION RESULTS ===');
      console.log(`  Samples: ${result.samples}`);
      console.log(`  Precision@1: ${(result.precision * 100).toFixed(2)}%`);
      console.log(`  Recall@1: ${(result.recall * 100).toFixed(2)}%`);

      const f1 = 2 * (result.precision * result.recall) / (result.precision + result.recall);
      console.log(`  F1 Score: ${(f1 * 100).toFixed(2)}%`);
      console.log('');
    }

    console.log('Model saved to:', outputPath + '.ftz');
    console.log('Model size:', (fs.statSync(outputPath + '.ftz').size / 1024 / 1024).toFixed(2), 'MB');
    console.log('');

    // Print some example predictions
    console.log('=== EXAMPLE PREDICTIONS ===');
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
      const predictions = await model.predict(example, 3);
      if (predictions && predictions.length > 0) {
        const intent = predictions[0].label.replace('__label__', '');
        const confidence = (predictions[0].score * 100).toFixed(1);

        // Show top 3 if confidence is not very high
        if (predictions[0].score < 0.9 && predictions.length > 1) {
          const alt1 = predictions[1].label.replace('__label__', '');
          const conf1 = (predictions[1].score * 100).toFixed(1);
          console.log(`  "${example}"`);
          console.log(`    → ${intent} (${confidence}%)  [alt: ${alt1} (${conf1}%)]`);
        } else {
          console.log(`  "${example}" → ${intent} (${confidence}%)`);
        }
      }
    }

    console.log('\n✅ Training complete! The model is ready to use.');
    console.log('\nNext: Start WinPilot and try some queries!');

  } catch (error) {
    console.error('\n❌ Error during training:');
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
