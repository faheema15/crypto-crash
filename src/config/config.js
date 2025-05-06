require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/crypto-crash',
  cryptoApi: {
    url: process.env.CRYPTO_API_URL || 'https://api.coingecko.com/api/v3',
    key: process.env.CRYPTO_API_KEY || ''
  },
  game: {
    interval: parseInt(process.env.GAME_INTERVAL) || 10000, // 10 seconds between rounds
    multiplierUpdateInterval: parseInt(process.env.MULTIPLIER_UPDATE_INTERVAL) || 100, // 100ms updates
    supportedCurrencies: ['btc', 'eth'], // supported cryptocurrencies
    growthFactor: 0.05, // affects how quickly the multiplier increases
    maxCrashValue: 100.0, // maximum possible crash point (100x)
    initialBalance: 1000.0 // initial USD balance for new players
  }
};