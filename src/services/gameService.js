const config = require('../config/config');
const Game = require('../models/Game');
const Player = require('../models/Player');
const ProvablyFair = require('../utils/provablyFair');
const walletService = require('./walletService');
const websocketManager = require('../utils/websocketManager');

class GameService {
  constructor() {
    this.currentGame = null;
    this.nextGame = null;
    this.gameCounter = 0;
    this.gameTimer = null;
    this.multiplierTimer = null;
    this.gameStartTime = null;
    this.currentMultiplier = 1.0;
    this.isRunning = false;
  }

  /**
   * Initialize the game service
   */
  async initialize() {
    try {
      // Set the WebSocket manager's game service reference
      websocketManager.gameService = this;
      
      // Get the latest game from the database to continue the counter
      const latestGame = await Game.findOne().sort({ roundId: -1 });
      this.gameCounter = latestGame ? latestGame.roundId : 0;
      
      // Start the game loop
      await this.startGameLoop();
      
      console.log('Game service initialized');
    } catch (error) {
      console.error('Error initializing game service:', error);
    }
  }

  /**
   * Start the game loop
   */
  async startGameLoop() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    
    try {
      // Create the first game if there's no current game
      if (!this.currentGame) {
        await this.createNextGame();
        this.currentGame = this.nextGame;
        this.nextGame = null;
      }
      
      // Start the first game
      this.scheduleNextGame();
    } catch (error) {
      console.error('Error starting game loop:', error);
      this.isRunning = false;
    }
  }

  /**
   * Stop the game loop
   */
  stopGameLoop() {
    this.isRunning = false;
    
    if (this.gameTimer) {
      clearTimeout(this.gameTimer);
      this.gameTimer = null;
    }
    
    if (this.multiplierTimer) {
      clearInterval(this.multiplierTimer);
      this.multiplierTimer = null;
    }
    
    console.log('Game loop stopped');
  }

  /**
   * Create the next game
   */
  async createNextGame() {
    try {
      // Increment game counter
      this.gameCounter++;
      
      // Generate provably fair game data
      const roundData = ProvablyFair.generateRound(this.gameCounter);
      
      // Create new game in database
      const game = new Game({
        roundId: roundData.roundId,
        seed: roundData.seed,
        hash: roundData.hash,
        crashPoint: roundData.crashPoint,
        status: 'pending'
      });
      
      await game.save();
      this.nextGame = game;
      
      console.log(`Created next game #${game.roundId} with crash point ${game.crashPoint}x`);
      
      return game;
    } catch (error) {
      console.error('Error creating next game:', error);
      throw error;
    }
  }

  /**
   * Schedule the next game
   */
  scheduleNextGame() {
    if (!this.isRunning) {
      return;
    }
    
    // Schedule next game
    this.gameTimer = setTimeout(() => this.startGame(), config.game.interval);
    
    console.log(`Next game scheduled to start in ${config.game.interval / 1000} seconds`);
  }

  /**
   * Start a new game round
   */
  async startGame() {
    try {
      if (!this.currentGame) {
        console.error('No current game to start');
        return;
      }
      
      // Create next game for the queue
      if (!this.nextGame) {
        await this.createNextGame();
      }
      
      // Update game status
      this.currentGame.status = 'in_progress';
      this.currentGame.startedAt = new Date();
      await this.currentGame.save();
      
      // Reset multiplier
      this.currentMultiplier = 1.0;
      this.gameStartTime = Date.now();
      
      // Broadcast round start
      websocketManager.broadcastRoundStart({
        roundId: this.currentGame.roundId,
        hash: this.currentGame.hash,
        timestamp: this.currentGame.startedAt
      });
      
      console.log(`Game #${this.currentGame.roundId} started`);
      
      // Start multiplier updates
      this.startMultiplierUpdates();
      
      // Schedule crash
      const crashTimeMs = ProvablyFair.calculateCrashTime(this.currentGame.crashPoint);
      
      setTimeout(() => {
        this.crashGame();
      }, crashTimeMs);
    } catch (error) {
      console.error('Error starting game:', error);
      this.scheduleNextGame();
    }
  }

  /**
   * Start sending multiplier updates
   */
  startMultiplierUpdates() {
    if (this.multiplierTimer) {
      clearInterval(this.multiplierTimer);
    }
    
    this.multiplierTimer = setInterval(() => {
      if (!this.gameStartTime) {
        return;
      }
      
      const elapsedTime = Date.now() - this.gameStartTime;
      this.currentMultiplier = ProvablyFair.calculateMultiplier(elapsedTime);
      
      // Broadcast multiplier update
      websocketManager.broadcastMultiplierUpdate(this.currentMultiplier, elapsedTime);
    }, config.game.multiplierUpdateInterval);
  }

  /**
   * Handle game crash
   */
  async crashGame() {
    try {
      if (!this.currentGame || this.currentGame.status !== 'in_progress') {
        return;
      }
      
      // Stop multiplier updates
      if (this.multiplierTimer) {
        clearInterval(this.multiplierTimer);
        this.multiplierTimer = null;
      }
      
      const crashTime = Date.now();
      const gameDuration = crashTime - this.gameStartTime;
      
      // Update game in database
      this.currentGame.status = 'completed';
      this.currentGame.crashedAt = new Date();
      this.currentGame.duration = gameDuration;
      
      // Update all active bets to 'lost'
      for (const bet of this.currentGame.bets) {
        if (bet.status === 'active') {
          bet.status = 'lost';
        }
      }
      
      await this.currentGame.save();
      
      // Broadcast crash event
      websocketManager.broadcastRoundCrash({
        roundId: this.currentGame.roundId,
        crashPoint: this.currentGame.crashPoint,
        duration: gameDuration
      });
      
      console.log(`Game #${this.currentGame.roundId} crashed at ${this.currentGame.crashPoint}x after ${gameDuration}ms`);
      
      // Prepare for next round
      this.currentGame = this.nextGame;
      this.nextGame = null;
      this.gameStartTime = null;
      
      // Schedule next game
      this.scheduleNextGame();
    } catch (error) {
      console.error('Error handling game crash:', error);
      this.scheduleNextGame();
    }
  }

  /**
   * Place a bet in the current game
   * @param {string} playerId - Player ID
   * @param {number} usdAmount - USD amount to bet
   * @param {string} currency - Cryptocurrency to use
   * @returns {Promise<Object>} - Bet information
   */
  async placeBet(playerId, usdAmount, currency) {
    try {
      // Validate game state
      if (!this.currentGame || this.currentGame.status !== 'pending') {
        throw new Error('Bets can only be placed before the round starts');
      }
      
      // Get player
      const player = await Player.findById(playerId);
      
      if (!player) {
        throw new Error('Player not found');
      }
      
      // Process bet with wallet service
      const betResult = await walletService.placeBet(
        playerId,
        usdAmount,
        currency,
        this.currentGame._id
      );
      
      // Add bet to game
      this.currentGame.bets.push({
        playerId,
        username: player.username,
        usdAmount,
        cryptoAmount: betResult.cryptoAmount,
        currency,
        cryptoPrice: betResult.price,
        status: 'active'
      });
      
      await this.currentGame.save();
      
      return {
        success: true,
        message: 'Bet placed successfully',
        data: {
          roundId: this.currentGame.roundId,
          usdAmount,
          cryptoAmount: betResult.cryptoAmount,
          currency,
          username: player.username
        }
      };
    } catch (error) {
      console.error('Error placing bet:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Process player cashout
   * @param {string} playerId - Player ID
   * @returns {Promise<Object>} - Cashout result
   */
  async cashout(playerId) {
    try {
      // Validate game state
      if (!this.currentGame || this.currentGame.status !== 'in_progress') {
        throw new Error('Cannot cash out when game is not in progress');
      }
      
      // Find player's active bet in current game
      const betIndex = this.currentGame.bets.findIndex(
        bet => bet.playerId.toString() === playerId && bet.status === 'active'
      );
      
      if (betIndex === -1) {
        throw new Error('No active bet found for this player');
      }
      
      const bet = this.currentGame.bets[betIndex];
      
      // Check if the game has crashed already
      if (!this.gameStartTime) {
        throw new Error('Game has already crashed');
      }
      
      // Calculate cashout multiplier
      const elapsedTime = Date.now() - this.gameStartTime;
      const cashoutMultiplier = ProvablyFair.calculateMultiplier(elapsedTime);
      
      // Process cashout
      const cashoutResult = await walletService.processCashout(
        playerId,
        bet,
        cashoutMultiplier,
        this.currentGame._id
      );
      
      // Update bet status
      this.currentGame.bets[betIndex].status = 'cashed_out';
      this.currentGame.bets[betIndex].cashoutMultiplier = cashoutMultiplier;
      this.currentGame.bets[betIndex].profit = cashoutResult.usdAmount - bet.usdAmount;
      this.currentGame.bets[betIndex].cashedOutAt = new Date();
      
      await this.currentGame.save();
      
      // Broadcast cashout
      websocketManager.broadcastPlayerCashout({
        roundId: this.currentGame.roundId,
        playerId,
        username: bet.username,
        multiplier: cashoutMultiplier,
        cryptoAmount: cashoutResult.cryptoAmount,
        usdAmount: cashoutResult.usdAmount,
        currency: bet.currency
      });
      
      return {
        success: true,
        message: 'Cashout successful',
        data: {
          multiplier: cashoutMultiplier,
          usdAmount: cashoutResult.usdAmount,
          cryptoAmount: cashoutResult.cryptoAmount,
          currency: bet.currency
        }
      };
    } catch (error) {
      console.error('Error processing cashout:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get the current game state
   * @returns {Object} - Current game state
   */
  getCurrentGameState() {
    if (!this.currentGame) {
      return {
        status: 'no_game',
        nextGameIn: this.gameTimer ? config.game.interval : 0
      };
    }
    
    const state = {
      roundId: this.currentGame.roundId,
      status: this.currentGame.status,
      hash: this.currentGame.hash
    };
    
    if (this.currentGame.status === 'in_progress' && this.gameStartTime) {
      const elapsedTime = Date.now() - this.gameStartTime;
      state.elapsedTime = elapsedTime;
      state.multiplier = ProvablyFair.calculateMultiplier(elapsedTime);
    } else if (this.currentGame.status === 'completed') {
      state.crashPoint = this.currentGame.crashPoint;
      state.duration = this.currentGame.duration;
    } else if (this.currentGame.status === 'pending') {
      state.nextGameIn = this.gameTimer ? config.game.interval : 0;
    }
    
    return state;
  }

  /**
   * Get game history
   * @param {number} limit - Number of games to retrieve
   * @returns {Promise<Array>} - Game history
   */
  async getGameHistory(limit = 10) {
    try {
      const games = await Game.find({ status: 'completed' })
        .sort({ roundId: -1 })
        .limit(limit)
        .select('roundId crashPoint hash startedAt crashedAt duration');
      
      return games;
    } catch (error) {
      console.error('Error getting game history:', error);
      throw error;
    }
  }
}

module.exports = new GameService();