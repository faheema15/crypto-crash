/**
 * Player model represents a user of the Crypto Crash game
 * Includes wallet balances in USD and cryptocurrencies
 */
const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  wallet: {
    usd: {
      type: Number,
      default: 0,
      min: 0
    },
    btc: {
      type: Number,
      default: 0,
      min: 0
    },
    eth: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  lastConnected: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Virtual for getting total wallet value in USD (requires current prices)
playerSchema.methods.getTotalWalletValueUsd = function(prices) {
  if (!prices || !prices.btc || !prices.eth) {
    throw new Error('Cryptocurrency prices are required');
  }
  
  const btcValue = this.wallet.btc * prices.btc;
  const ethValue = this.wallet.eth * prices.eth;
  
  return this.wallet.usd + btcValue + ethValue;
};

// Method to check if player has sufficient balance for a bet
playerSchema.methods.hasSufficientBalance = function(amount, currency) {
  return this.wallet[currency.toLowerCase()] >= amount;
};

// Add index for isActive only (username and email already have unique: true which creates indexes)
playerSchema.index({ isActive: 1 });

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;