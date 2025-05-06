/**
 * Script to populate the database with sample data for testing
 * This creates sample players, wallets, and game rounds
 */
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Player = require('../src/models/Player');
const Game = require('../src/models/Game');
const Transaction = require('../src/models/Transaction');

// Import utility for generating fair crash points
const { generateSeed, generateCrashPoint } = require('../src/utils/provablyFair');

// Helper function to generate a mock transaction hash
const generateMockTransactionHash = (playerId, gameId, type = 'bet') => {
  const timestamp = Date.now().toString();
  const randomPart = Math.random().toString().substring(2);
  return `tx_${type}_${playerId.toString().substring(0, 6)}_${gameId.toString().substring(0, 6)}_${timestamp.substring(timestamp.length - 6)}_${randomPart.substring(0, 6)}`;
};

// Connect to MongoDB
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-crash');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Create sample players with wallets
const createPlayers = async () => {
  try {
    // Clear existing players
    await Player.deleteMany({});

    const samplePlayers = [
      {
        username: 'player1',
        email: 'player1@example.com',
        wallet: {
          usd: 1000,
          btc: 0.02,
          eth: 0.5
        }
      },
      {
        username: 'player2',
        email: 'player2@example.com',
        wallet: {
          usd: 2000,
          btc: 0.05,
          eth: 1.2
        }
      },
      {
        username: 'player3',
        email: 'player3@example.com',
        wallet: {
          usd: 500,
          btc: 0.01,
          eth: 0.3
        }
      },
      {
        username: 'player4',
        email: 'player4@example.com',
        wallet: {
          usd: 3000,
          btc: 0.08,
          eth: 2.0
        }
      },
      {
        username: 'player5',
        email: 'player5@example.com',
        wallet: {
          usd: 1500,
          btc: 0.03,
          eth: 0.8
        }
      }
    ];

    const players = await Player.insertMany(samplePlayers);
    console.log('Created sample players:', players.map(p => p._id));
    return players;
  } catch (error) {
    console.error('Error creating sample players:', error);
    throw error;
  }
};

// Create sample game rounds with bets and cashouts
const createGameRounds = async (players) => {
  try {
    // Clear existing games and transactions
    await Game.deleteMany({});
    await Transaction.deleteMany({});

    const games = [];
    const cryptoPrices = {
      btc: 60000,  // Sample BTC price in USD
      eth: 3500    // Sample ETH price in USD
    };

    // Create 5 sample game rounds
    for (let i = 1; i <= 5; i++) {
      const seed = generateSeed();
      const crashPoint = generateCrashPoint(seed, i);
      
      // Create a new game with roundNumber set (not roundId)
      const game = new Game({
        roundNumber: i,
        seed: seed,
        crashPoint: crashPoint,
        startTime: new Date(Date.now() - (6 - i) * 60000), // Games spaced 1 minute apart
        endTime: new Date(Date.now() - (6 - i) * 60000 + 30000), // Each game lasts 30 seconds
        status: 'completed',
        bets: [],
        cashouts: []
      });

      // Add random bets for each player
      for (const player of players) {
        const willBet = Math.random() > 0.3; // 70% chance of placing a bet
        
        if (willBet) {
          const crypto = Math.random() > 0.5 ? 'btc' : 'eth';
          const usdAmount = Math.floor(Math.random() * 100) + 10; // Random bet between $10-$110
          const cryptoAmount = usdAmount / cryptoPrices[crypto];
          
          // Create a bet transaction
          const betTransaction = new Transaction({
            playerId: player._id,
            gameId: game._id,
            usdAmount: usdAmount,
            cryptoAmount: cryptoAmount,
            cryptoCurrency: crypto,
            priceAtTime: cryptoPrices[crypto],
            transactionType: 'bet',
            transactionHash: generateMockTransactionHash(player._id, game._id, 'bet'),
            timestamp: game.startTime
          });
          
          await betTransaction.save();
          
          // Add bet to game
          const bet = {
            playerId: player._id,
            usdAmount: usdAmount,
            cryptoAmount: cryptoAmount,
            cryptoCurrency: crypto,
            transactionId: betTransaction._id
          };
          
          game.bets.push(bet);
          
          // Determine if player will cash out before crash
          const willCashout = Math.random() > 0.4; // 60% chance of cashing out
          
          if (willCashout) {
            // Random cashout multiplier between 1.1 and the crash point
            const cashoutMultiplier = Math.min(
              crashPoint - 0.1,
              1.1 + Math.random() * (crashPoint - 1.2)
            ).toFixed(2);
            
            if (cashoutMultiplier > 1) {
              const cashoutCryptoAmount = cryptoAmount * cashoutMultiplier;
              const cashoutUsdAmount = cashoutCryptoAmount * cryptoPrices[crypto];
              
              // Create a cashout transaction
              const cashoutTransaction = new Transaction({
                playerId: player._id,
                gameId: game._id,
                usdAmount: cashoutUsdAmount,
                cryptoAmount: cashoutCryptoAmount,
                cryptoCurrency: crypto,
                priceAtTime: cryptoPrices[crypto],
                transactionType: 'cashout',
                transactionHash: generateMockTransactionHash(player._id, game._id, 'cashout'),
                timestamp: new Date(game.startTime.getTime() + (cashoutMultiplier - 1) * 10000) // Time based on multiplier
              });
              
              await cashoutTransaction.save();
              
              // Add cashout to game
              const cashout = {
                playerId: player._id,
                usdAmount: cashoutUsdAmount,
                cryptoAmount: cashoutCryptoAmount,
                cryptoCurrency: crypto,
                multiplier: parseFloat(cashoutMultiplier),
                transactionId: cashoutTransaction._id
              };
              
              game.cashouts.push(cashout);
            }
          }
        }
      }
      
      await game.save();
      games.push(game);
    }
    
    console.log(`Created ${games.length} sample game rounds`);
    return games;
  } catch (error) {
    console.error('Error creating sample game rounds:', error);
    throw error;
  }
};

// Update player wallets based on game outcomes
const updatePlayerWallets = async (players, games) => {
  try {
    // For each player, calculate their net winnings and losses
    for (const player of players) {
      // Get all transactions for this player
      const transactions = await Transaction.find({ playerId: player._id });
      
      let netBtc = 0;
      let netEth = 0;
      let netUsd = 0;
      
      for (const transaction of transactions) {
        if (transaction.transactionType === 'bet') {
          // Deduct bet amounts
          if (transaction.cryptoCurrency === 'btc') {
            netBtc -= transaction.cryptoAmount;
          } else if (transaction.cryptoCurrency === 'eth') {
            netEth -= transaction.cryptoAmount;
          }
          netUsd -= transaction.usdAmount;
        } else if (transaction.transactionType === 'cashout') {
          // Add cashout amounts
          if (transaction.cryptoCurrency === 'btc') {
            netBtc += transaction.cryptoAmount;
          } else if (transaction.cryptoCurrency === 'eth') {
            netEth += transaction.cryptoAmount;
          }
          netUsd += transaction.usdAmount;
        }
      }
      
      // Update player wallet
      await Player.findByIdAndUpdate(player._id, {
        $inc: {
          'wallet.btc': netBtc,
          'wallet.eth': netEth,
          'wallet.usd': netUsd
        }
      });
    }
    
    console.log('Updated player wallets based on game outcomes');
  } catch (error) {
    console.error('Error updating player wallets:', error);
    throw error;
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    await connectToDatabase();
    
    // First, fix any potential index issues
    const db = mongoose.connection.db;
    const gamesCollection = db.collection('games');
    
    try {
      console.log('Checking for problematic roundId index...');
      const indexes = await gamesCollection.indexes();
      const hasRoundIdIndex = indexes.some(index => index.key && index.key.roundId === 1);
      
      if (hasRoundIdIndex) {
        console.log('Found roundId index, attempting to drop it...');
        await gamesCollection.dropIndex('roundId_1');
        console.log('Successfully dropped roundId_1 index');
      }
    } catch (indexError) {
      console.error('Error handling index:', indexError.message);
      // Continue with seeding despite index error
    }
    
    const players = await createPlayers();
    const games = await createGameRounds(players);
    await updatePlayerWallets(players, games);
    
    console.log('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Execute seeding
seedDatabase();

/**
 * Script to fix the MongoDB schema issue with roundId
 */
const mongoose = require('mongoose');
require('dotenv').config();

const fixDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-crash');
    console.log('Connected to MongoDB');
    
    // Get direct access to the games collection
    const db = mongoose.connection.db;
    const gamesCollection = db.collection('games');
    
    // Option 1: Drop the problematic index
    console.log('Attempting to drop the roundId index...');
    try {
      await gamesCollection.dropIndex('roundId_1');
      console.log('Successfully dropped roundId_1 index');
    } catch (indexError) {
      console.error('Error dropping index:', indexError.message);
    }
    
    // Option 2: Alternatively, update any documents with null roundId
    console.log('Updating any documents with null roundId...');
    const updateResult = await gamesCollection.updateMany(
      { roundId: null }, 
      { $set: { roundId: 'deprecated' } }
    );
    console.log(`Updated ${updateResult.modifiedCount} documents with null roundId`);
    
    console.log('Database fix completed');
  } catch (error) {
    console.error('Error fixing database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

fixDatabase();