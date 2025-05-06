const walletService = require('../services/walletService');
const cryptoService = require('../services/cryptoService');

/**
 * Get player's wallet balance (in crypto and USD)
 */
const getBalance = async (req, res) => {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }
    
    const balances = await walletService.getPlayerBalance(playerId);
    
    // Add USD equivalent values
    const usdEquivalents = {};
    for (const [crypto, amount] of Object.entries(balances.crypto)) {
      if (amount > 0) {
        const price = await cryptoService.getCryptoPrice(crypto);
        usdEquivalents[crypto] = amount * price;
      } else {
        usdEquivalents[crypto] = 0;
      }
    }
    
    res.status(200).json({
      playerId,
      balances: {
        crypto: balances.crypto,
        usdEquivalent: usdEquivalents
      }
    });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: error.message || 'Failed to get balance' });
  }
};

/**
 * Deposit USD to player's wallet (converted to crypto)
 */
const deposit = async (req, res) => {
  try {
    const { playerId, usdAmount, cryptoCurrency } = req.body;
    
    if (!playerId || !usdAmount || !cryptoCurrency) {
      return res.status(400).json({ 
        error: 'Player ID, USD amount, and crypto currency are required' 
      });
    }
    
    if (usdAmount <= 0) {
      return res.status(400).json({ error: 'USD amount must be positive' });
    }
    
    const supportedCurrencies = ['BTC', 'ETH'];
    if (!supportedCurrencies.includes(cryptoCurrency.toUpperCase())) {
      return res.status(400).json({ 
        error: `Unsupported cryptocurrency. Choose from: ${supportedCurrencies.join(', ')}` 
      });
    }
    
    const transaction = await walletService.depositUsdToCrypto(
      playerId, 
      usdAmount, 
      cryptoCurrency.toUpperCase()
    );
    
    res.status(201).json({
      message: 'Deposit successful',
      transaction
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({ error: error.message || 'Failed to process deposit' });
  }
};

/**
 * Get player's transaction history
 */
const getTransactions = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }
    
    const transactions = await walletService.getPlayerTransactions(
      playerId, 
      parseInt(limit), 
      parseInt(page)
    );
    
    res.status(200).json({
      playerId,
      transactions,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to get transactions' });
  }
};

module.exports = {
  getBalance,
  deposit,
  getTransactions
};