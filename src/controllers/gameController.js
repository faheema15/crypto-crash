const gameService = require('../services/gameService');
const Game = require('../models/Game');
const ProvablyFair = require('../utils/provablyFair');

/**
 * Place a bet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.placeBet = async (req, res) => {
  try {
    const { playerId, usdAmount, currency } = req.body;
    
    // Validate request body
    if (!playerId || !usdAmount || !currency) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: playerId, usdAmount, and currency are required'
      });
    }
    
    // Validate USD amount
    if (isNaN(usdAmount) || usdAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid USD amount: must be a positive number'
      });
    }
    
    // Place bet
    const result = await gameService.placeBet(playerId, parseFloat(usdAmount), currency);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in placeBet controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Process cashout
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.cashout = async (req, res) => {
  try {
    const { playerId } = req.body;
    
    // Validate request body
    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: playerId'
      });
    }
    
    // Process cashout
    const result = await gameService.cashout(playerId);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in cashout controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get current game state
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCurrentGame = async (req, res) => {
  try {
    const gameState = gameService.getCurrentGameState();
    
    return res.status(200).json({
      success: true,
      data: gameState
    });
  } catch (error) {
    console.error('Error in getCurrentGame controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get game history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getGameHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const games = await gameService.getGameHistory(limit);
    
    return res.status(200).json({
      success: true,
      data: games
    });
  } catch (error) {
    console.error('Error in getGameHistory controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get detailed game by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getGameById = async (req, res) => {
  try {
    const gameId = req.params.id;
    
    // Find game by ID (or roundId if numeric)
    let game;
    if (!isNaN(gameId)) {
      game = await Game.findOne({ roundId: parseInt(gameId) });
    } else {
      game = await Game.findById(gameId);
    }
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: game
    });
  } catch (error) {
    console.error('Error in getGameById controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Verify game fairness
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifyGame = async (req, res) => {
  try {
    const { roundId, seed, crashPoint } = req.body;
    
    // Validate request body
    if (!roundId || !seed || !crashPoint) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: roundId, seed, and crashPoint are required'
      });
    }
    
    // Verify game
    const isValid = ProvablyFair.verifyRound(
      seed,
      parseInt(roundId),
      parseFloat(crashPoint)
    );
    
    return res.status(200).json({
      success: true,
      valid: isValid,
      message: isValid
        ? 'Game verification successful'
        : 'Game verification failed: crash point does not match'
    });
  } catch (error) {
    console.error('Error in verifyGame controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};