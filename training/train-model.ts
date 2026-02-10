/**
 * FastText Model Training Script
 *
 * This script trains the FastText intent classification model using the generated training data.
 *
 * Usage: npm run train:model
 */

import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('Training FastText intent classifier...\n');

  // Check if fasttext-node is installed
  let fastText: any;
  try {
    fastText = require('fasttext-node');
  } catch (error) {
    console.error('Error: fasttext-node is not installed');
    console.error('Please install it with: npm install fasttext-node');
    process.exit(1);
  }

  // Check if training data exists
  const trainingDir = __dirname;
  const trainDataPath = path.join(trainingDir, 'training_data.txt');
  const testDataPath = path.join(trainingDir, 'test_data.txt');

  if (!fs.existsSync(trainDataPath)) {
    console.error('Error: training_data.txt not found');
    console.error('Please run: npm run train:generate-data');
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

      console.log('\nEvaluation results:');
      console.log(`  Precision: ${(result.precision * 100).toFixed(2)}%`);
      console.log(`  Recall: ${(result.recall * 100).toFixed(2)}%`);

      const f1 = 2 * (result.precision * result.recall) / (result.precision + result.recall);
      console.log(`  F1 Score: ${(f1 * 100).toFixed(2)}%`);
      console.log(`  Samples: ${result.samples}`);
    }

    console.log('\nModel saved to:', outputPath + '.ftz');
    console.log('\nNext steps:');
    console.log('1. Test the model by running WinPilot and trying some queries');
    console.log('2. Monitor the logs to see which tier handles each query');
    console.log('3. Collect real user data and retrain periodically');

    // Print some example predictions
    console.log('\nExample predictions:');
    const examples = [
      'list windows',
      'set volume to 50',
      'what is my system info',
      'launch chrome',
      'remind me in 30 minutes',
    ];

    for (const example of examples) {
      const predictions = await model.predict(example, 1);
      if (predictions && predictions.length > 0) {
        const intent = predictions[0].label.replace('__label__', '');
        const confidence = (predictions[0].score * 100).toFixed(1);
        console.log(`  "${example}" → ${intent} (${confidence}%)`);
      }
    }
  } catch (error) {
    console.error('\nError during training:');
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
