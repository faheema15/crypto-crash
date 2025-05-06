/**
 * Game model represents a single round of the Crypto Crash game
 */
const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  roundNumber: {
    type: Number,
    required: true,
    unique: true
  },
  seed: {
    type: String,
    required: true
  },
  crashPoint: {
    type: Number,
    required: true,
    min: 1
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  bets: [
    {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true
      },
      usdAmount: {
        type: Number,
        required: true,
        min: 0
      },
      cryptoAmount: {
        type: Number,
        required: true,
        min: 0
      },
      cryptoCurrency: {
        type: String,
        enum: ['btc', 'eth'],
        required: true
      },
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
      }
    }
  ],
  cashouts: [
    {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true
      },
      usdAmount: {
        type: Number,
        required: true,
        min: 0
      },
      cryptoAmount: {
        type: Number,
        required: true,
        min: 0
      },
      cryptoCurrency: {
        type: String,
        enum: ['btc', 'eth'],
        required: true
      },
      multiplier: {
        type: Number,
        required: true,
        min: 1
      },
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
      }
    }
  ]
}, { timestamps: true });

// Virtual to calculate total bet amount in USD for a game
gameSchema.virtual('totalBetAmountUsd').get(function() {
  return this.bets.reduce((total, bet) => total + bet.usdAmount, 0);
});

// Virtual to calculate total cashout amount in USD for a game
gameSchema.virtual('totalCashoutAmountUsd').get(function() {
  return this.cashouts.reduce((total, cashout) => total + cashout.usdAmount, 0);
});

// Virtual to calculate house profit/loss
gameSchema.virtual('houseProfitUsd').get(function() {
  const totalBets = this.totalBetAmountUsd;
  const totalCashouts = this.totalCashoutAmountUsd;
  return totalBets - totalCashouts;
});

// Method to check if a player has already placed a bet in this game
gameSchema.methods.hasPlayerBet = function(playerId) {
  return this.bets.some(bet => bet.playerId.toString() === playerId.toString());
};

// Method to check if a player has already cashed out in this game
gameSchema.methods.hasPlayerCashedOut = function(playerId) {
  return this.cashouts.some(cashout => cashout.playerId.toString() === playerId.toString());
};

// Add indexes for better query performance (roundNumber already has unique: true which creates an index)
gameSchema.index({ status: 1 });
gameSchema.index({ startTime: -1 });

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;