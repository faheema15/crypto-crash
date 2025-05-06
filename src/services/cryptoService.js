const axios = require('axios');
const config = require('../config/config');

class CryptoService {
  constructor() {
    this.priceCache = {}; // Store cached prices
    this.cacheTTL = 10000; // 10 seconds TTL for cached prices
    this.lastFetchTime = {}; // Track when prices were last fetched
    this.supportedCurrencies = config.game.supportedCurrencies;
  }

  /**
   * Get the current price of a cryptocurrency in USD
   * @param {string} currency - The cryptocurrency symbol (e.g., 'btc', 'eth')
   * @returns {Promise<number>} - The current price in USD
   */
  async getPrice(currency) {
    currency = currency.toLowerCase();
    
    // Validate supported currency
    if (!this.supportedCurrencies.includes(currency)) {
      throw new Error(`Unsupported cryptocurrency: ${currency}`);
    }

    // Check if we have a valid cached price
    const now = Date.now();
    if (
      this.priceCache[currency] && 
      this.lastFetchTime[currency] && 
      now - this.lastFetchTime[currency] < this.cacheTTL
    ) {
      return this.priceCache[currency];
    }

    try {
      // Fetch the latest price from CoinGecko API
      const response = await axios.get(
        `${config.cryptoApi.url}/simple/price`,
        {
          params: {
            ids: this.getCoinGeckoId(currency),
            vs_currencies: 'usd',
            api_key: config.cryptoApi.key
          }
        }
      );
      
      // Extract price from response
      const price = this.extractPrice(response.data, currency);
      
      // Update cache
      this.priceCache[currency] = price;
      this.lastFetchTime[currency] = now;
      
      return price;
    } catch (error) {
      console.error(`Error fetching price for ${currency}:`, error.message);
      
      // Return cached price if available, otherwise throw error
      if (this.priceCache[currency]) {
        console.log(`Using cached price for ${currency}: $${this.priceCache[currency]}`);
        return this.priceCache[currency];
      }
      
      throw new Error(`Failed to get price for ${currency}`);
    }
  }

  /**
   * Convert USD to crypto amount
   * @param {number} usdAmount - Amount in USD
   * @param {string} currency - Cryptocurrency symbol
   * @returns {Promise<{cryptoAmount: number, price: number}>} - Crypto amount and price
   */
  async convertUsdToCrypto(usdAmount, currency) {
    const price = await this.getPrice(currency);
    const cryptoAmount = usdAmount / price;
    return {
      cryptoAmount,
      price
    };
  }

  /**
   * Convert crypto to USD amount
   * @param {number} cryptoAmount - Amount in cryptocurrency
   * @param {string} currency - Cryptocurrency symbol
   * @returns {Promise<{usdAmount: number, price: number}>} - USD amount and price
   */
  async convertCryptoToUsd(cryptoAmount, currency) {
    const price = await this.getPrice(currency);
    const usdAmount = cryptoAmount * price;
    return {
      usdAmount,
      price
    };
  }

  /**
   * Get CoinGecko ID for a given currency symbol
   * @param {string} currency - Cryptocurrency symbol
   * @returns {string} - CoinGecko ID
   */
  getCoinGeckoId(currency) {
    const coinMap = {
      'btc': 'bitcoin',
      'eth': 'ethereum'
      // Add more mappings as needed
    };
    
    return coinMap[currency] || currency;
  }

  /**
   * Extract price from API response
   * @param {Object} data - API response data
   * @param {string} currency - Cryptocurrency symbol
   * @returns {number} - Price in USD
   */
  extractPrice(data, currency) {
    const coinId = this.getCoinGeckoId(currency);
    
    if (!data[coinId] || !data[coinId].usd) {
      throw new Error(`Invalid price data for ${currency}`);
    }
    
    return data[coinId].usd;
  }
}

module.exports = new CryptoService();