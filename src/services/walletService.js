const mongoose = require('mongoose');
const crypto = require('crypto');
const Player = require('../models/Player');
const Transaction = require('../models/Transaction');
const cryptoService = require('./cryptoService');

/**
 * Get player's balance for all cryptocurrencies
 */
const getPlayerBalance = async (playerId) => {
  const player = await Player.findById(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  return {
    crypto: player.wallet
  };
};

/**
 * Convert USD to crypto and deposit to player's wallet
 */
const depositUsdToCrypto = async (playerId, usdAmount, cryptoCurrency) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const player = await Player.findById(playerId).session(session);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Get current crypto price
    const cryptoPrice = await cryptoService.getCryptoPrice(cryptoCurrency);
    
    // Convert USD to crypto
    const cryptoAmount = usdAmount / cryptoPrice;
    
    // Update player's wallet
    if (!player.wallet[cryptoCurrency]) {
      player.wallet[cryptoCurrency] = 0;
    }
    player.wallet[cryptoCurrency] += cryptoAmount;
    await player.save({ session });
    
    // Create transaction record
    const transaction = new Transaction({
      playerId,
      usdAmount,
      cryptoAmount,
      cryptoCurrency,
      transactionType: 'DEPOSIT',
      priceAtTime: cryptoPrice,
      transactionHash: generateTransactionHash()
    });
    await transaction.save({ session });
    
    await session.commitTransaction();
    return {
      id: transaction._id,
      playerId,
      usdAmount,
      cryptoAmount,
      cryptoCurrency,
      transactionType: 'DEPOSIT',
      timestamp: transaction.createdAt
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Process a win - add crypto to player's wallet
 */
const processCashout = async (playerId, betAmount, multiplier, cryptoCurrency, roundId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const player = await Player.findById(playerId).session(session);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Calculate win amount
    const winAmount = betAmount * multiplier;
    
    // Get current crypto price for USD conversion
    const cryptoPrice = await cryptoService.getCryptoPrice(cryptoCurrency);
    
    // Update player's wallet
    if (!player.wallet[cryptoCurrency]) {
      player.wallet[cryptoCurrency] = 0;
    }
    player.wallet[cryptoCurrency] += winAmount;
    await player.save({ session });
    
    // Create transaction record
    const transaction = new Transaction({
      playerId,
      usdAmount: winAmount * cryptoPrice,
      cryptoAmount: winAmount,
      cryptoCurrency,
      transactionType: 'CASHOUT',
      priceAtTime: cryptoPrice,
      transactionHash: generateTransactionHash(),
      gameRoundId: roundId,
      multiplier
    });
    await transaction.save({ session });
    
    await session.commitTransaction();
    return {
      id: transaction._id,
      playerId,
      usdAmount: winAmount * cryptoPrice,
      cryptoAmount: winAmount,
      cryptoCurrency,
      transactionType: 'CASHOUT',
      timestamp: transaction.createdAt,
      multiplier
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Process a bet - deduct crypto from player's wallet
 */
const processBet = async (playerId, usdAmount, cryptoCurrency, roundId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const player = await Player.findById(playerId).session(session);
    if (!player) {
      throw new Error('Player not found');
    }
    
    // Get current crypto price
    const cryptoPrice = await cryptoService.getCryptoPrice(cryptoCurrency);
    
    // Convert USD to crypto
    const cryptoAmount = usdAmount / cryptoPrice;
    
    // Check if player has enough balance
    if (!player.wallet[cryptoCurrency] || player.wallet[cryptoCurrency] < cryptoAmount) {
      throw new Error('Insufficient balance');
    }
    
    // Update player's wallet
    player.wallet[cryptoCurrency] -= cryptoAmount;
    await player.save({ session });
    
    // Create transaction record
    const transaction = new Transaction({
      playerId,
      usdAmount: -usdAmount,
      cryptoAmount: -cryptoAmount,
      cryptoCurrency,
      transactionType: 'BET',
      priceAtTime: cryptoPrice,
      transactionHash: generateTransactionHash(),
      gameRoundId: roundId
    });
    await transaction.save({ session });
    
    await session.commitTransaction();
    return {
      id: transaction._id,
      playerId,
      usdAmount,
      cryptoAmount,
      cryptoCurrency,
      transactionType: 'BET',
      timestamp: transaction.createdAt
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get player's transaction history with pagination
 */
const getPlayerTransactions = async (playerId, limit = 20, page = 1) => {
  const skip = (page - 1) * limit;
  
  const transactions = await Transaction.find({ playerId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  return transactions.map(tx => ({
    id: tx._id,
    playerId: tx.playerId,
    usdAmount: tx.usdAmount,
    cryptoAmount: tx.cryptoAmount,
    cryptoCurrency: tx.cryptoCurrency,
    transactionType: tx.transactionType,
    priceAtTime: tx.priceAtTime,
    transactionHash: tx.transactionHash,
    gameRoundId: tx.gameRoundId,
    multiplier: tx.multiplier,
    timestamp: tx.createdAt
  }));
};

/**
 * Generate mock transaction hash for simulated blockchain transactions
 */
const generateTransactionHash = () => {
  return '0x' + crypto.randomBytes(32).toString('hex');
};

module.exports = {
  getPlayerBalance,
  depositUsdToCrypto,
  processBet,
  processCashout,
  getPlayerTransactions
};