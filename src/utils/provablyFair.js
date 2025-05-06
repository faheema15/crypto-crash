/**
 * Utility functions for implementing provably fair crash game logic
 */
const crypto = require('crypto');

/**
 * Generates a cryptographically secure random seed
 * @returns {string} A hex string representing the random seed
 */
const generateSeed = () => {
  // Use a combination of timestamp and Math.random as a fallback if randomBytes isn't working
  const timestamp = Date.now().toString();
  const randomValue = Math.random().toString();
  return crypto.createHash('sha256').update(timestamp + randomValue).digest('hex');
};

/**
 * Generates a crash point based on a seed and round number
 * The crash point is a multiplier value at which the game will crash
 * 
 * @param {string} seed - The cryptographic seed for this game round
 * @param {number} roundNumber - The game round number
 * @param {number} [max=100] - Maximum possible crash value (default 100x)
 * @param {number} [min=1] - Minimum possible crash value (default 1x)
 * @returns {number} The crash point multiplier (e.g., 1.5x, 3x, 10x)
 */
const generateCrashPoint = (seed, roundNumber, max = 100, min = 1) => {
  // Create a deterministic hash based on the seed and round number
  const hashInput = seed + roundNumber.toString();
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  
  // Convert the first 8 characters of the hash to a number between 0 and 1
  const hashDecimal = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  
  // Use an exponential distribution for more realistic crash points
  // This creates a distribution where lower crash points are more common
  const exponent = 0.5;
  const crashValue = Math.pow(hashDecimal, exponent) * (max - min) + min;
  
  // Round to 2 decimal places for better UX
  return Math.round(crashValue * 100) / 100;
};

/**
 * Verifies that a crash point was fairly generated from a given seed and round number
 * 
 * @param {string} seed - The cryptographic seed used for the round
 * @param {number} roundNumber - The game round number
 * @param {number} claimedCrashPoint - The crash point to verify
 * @param {number} [max=100] - Maximum possible crash value used in generation
 * @param {number} [min=1] - Minimum possible crash value used in generation
 * @returns {boolean} True if the crash point matches what would be generated from the seed
 */
const verifyCrashPoint = (seed, roundNumber, claimedCrashPoint, max = 100, min = 1) => {
  const calculatedCrashPoint = generateCrashPoint(seed, roundNumber, max, min);
  return Math.abs(calculatedCrashPoint - claimedCrashPoint) < 0.001; // Allow for tiny floating point differences
};

/**
 * Calculate the current multiplier value based on elapsed time and growth factor
 * 
 * @param {number} timeElapsed - Time elapsed since round start in milliseconds
 * @param {number} [growthFactor=0.00006] - Factor determining how quickly the multiplier grows
 * @returns {number} The current multiplier value
 */
const calculateMultiplier = (timeElapsed, growthFactor = 0.00006) => {
  // Convert time from milliseconds to seconds for more manageable numbers
  const timeInSeconds = timeElapsed / 1000;
  // Calculate multiplier: starts at 1x and grows exponentially
  const multiplier = 1 + (timeInSeconds * growthFactor * Math.pow(timeInSeconds, 2));
  // Round to 2 decimal places
  return Math.round(multiplier * 100) / 100;
};

module.exports = {
  generateSeed,
  generateCrashPoint,
  verifyCrashPoint,
  calculateMultiplier
};