/**
 * Intent Classification System - ML Classifier
 *
 * This module integrates a Naive Bayes classifier using Natural.js for intent classification (Tier 2).
 * Handles model loading, classification, and confidence scoring.
 */

import { ClassificationResult } from './types';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

/**
 * ML Intent Classifier using Natural.js (Naive Bayes)
 * Provides generalized intent classification with confidence scores
 */
export class MLIntentClassifier {
  private classifier: any = null;
  private initialized = false;
  private initializationError: string | null = null;

  /**
   * Initialize the Natural.js classifier
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const modelPath = path.join(__dirname, '../../models/intent_model.json');

      // Check if model file exists
      if (!fs.existsSync(modelPath)) {
        this.initializationError = 'Model file not found. Run training pipeline first.';
        logger.copilot('ML model not found at ' + modelPath, 'warn');
        logger.copilot('ML classification will be disabled. Run: node training/train-with-natural.js', 'warn');
        this.initialized = true; // Mark as initialized but with error
        return;
      }

      // Dynamically import natural library
      let natural: any;
      try {
        natural = require('natural');
      } catch (error) {
        this.initializationError = 'natural library not installed. Run: npm install natural';
        logger.copilot('natural library not found. ML classification disabled.', 'warn');
        this.initialized = true;
        return;
      }

      // Load the model
      logger.copilot('Loading ML model from ' + modelPath);

      natural.BayesClassifier.load(modelPath, null, (err: any, classifier: any) => {
        if (err) {
          this.initializationError = 'Failed to load model: ' + err.message;
          logger.copilot('Failed to load ML model: ' + err.message, 'error');
          this.initialized = true;
          return;
        }

        this.classifier = classifier;
        this.initialized = true;
        logger.copilot('ML model loaded successfully (Naive Bayes)');
      });

      // Wait a bit for async load
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      this.initializationError = error instanceof Error ? error.message : String(error);
      logger.copilot('Failed to load ML model: ' + this.initializationError, 'error');
      this.initialized = true; // Mark as initialized but with error
    }
  }

  /**
   * Classify a query and return intent with confidence
   */
  async classify(query: string): Promise<ClassificationResult> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // If model failed to load, return low confidence
    if (!this.classifier || this.initializationError) {
      return {
        intent: 'unknown',
        confidence: 0,
        alternatives: [],
      };
    }

    try {
      // Normalize query
      const normalizedQuery = this.normalizeQuery(query);

      // Get classification with confidence scores
      const classifications = this.classifier.getClassifications(normalizedQuery);

      if (!classifications || classifications.length === 0) {
        return {
          intent: 'unknown',
          confidence: 0,
          alternatives: [],
        };
      }

      // Extract top prediction
      const topPrediction = classifications[0];
      const intent = topPrediction.label;
      const confidence = topPrediction.value;

      // Extract alternatives (convert confidence to 0-1 range if needed)
      const alternatives = classifications.slice(1, 3).map((c: any) => ({
        intent: c.label,
        confidence: c.value,
      }));

      logger.copilot('ML classification result', {
        query: normalizedQuery.substring(0, 50),
        intent,
        confidence: confidence.toFixed(3),
      });

      return {
        intent,
        confidence,
        alternatives,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.copilot('ML classification error: ' + errorMessage, 'error');

      return {
        intent: 'unknown',
        confidence: 0,
        alternatives: [],
      };
    }
  }

  /**
   * Normalize query for classification
   * Works best with lowercase, normalized text
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' '); // Collapse multiple spaces
  }

  /**
   * Check if ML classification is available
   */
  isAvailable(): boolean {
    return this.initialized && this.classifier !== null && !this.initializationError;
  }

  /**
   * Get initialization error if any
   */
  getError(): string | null {
    return this.initializationError;
  }
}
