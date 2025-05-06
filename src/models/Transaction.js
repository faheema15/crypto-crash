/**
 * Transaction model represents cryptocurrency transfers for bets and cashouts
 */
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true,
    index: true
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
    index: true
  },
  usdAmount: {
    type: Number,
    required: true
  },
  cryptoAmount: {
    type: Number,
    required: true
  },
  cryptoCurrency: {
    type: String,
    enum: ['btc', 'eth'],
    required: true
  },
  priceAtTime: {
    type: Number,
    required: true,
    comment: 'USD price per unit of cryptocurrency at transaction time'
  },
  transactionType: {
    type: String,
    enum: ['bet', 'cashout', 'deposit', 'withdrawal'],
    required: true
  },
  transactionHash: {
    type: String,
    required: true,
    comment: 'Simulated blockchain transaction hash'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  notes: {
    type: String
  }
}, { timestamps: true });

// Virtual to get USD equivalent at current price (if different from price at time)
transactionSchema.methods.getUsdEquivalent = function(currentPrice) {
  if (!currentPrice) {
    return this.usdAmount; // Return original USD amount if no current price provided
  }
  
  return this.cryptoAmount * currentPrice;
};

// Add indexes for better query performance
transactionSchema.index({ playerId: 1, transactionType: 1 });
transactionSchema.index({ gameId: 1, transactionType: 1 });
transactionSchema.index({ timestamp: -1 });
transactionSchema.index({ cryptoCurrency: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;