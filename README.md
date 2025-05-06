# Crypto Crash Game

A real-time multiplayer "Crash" betting game with cryptocurrency integration and WebSockets.

## Overview

Crypto Crash is a backend implementation of a "Crash" gambling game where:

1. Players place bets in USD, which are converted to cryptocurrency (BTC or ETH) using real-time prices.
2. A multiplier starts at 1x and increases exponentially over time.
3. Players can cash out at any time before the game crashes to secure their winnings.
4. If a player doesn't cash out before the crash, they lose their bet.
5. All game events are broadcast in real-time to all connected clients using WebSockets.

## Features

- **Game Logic**: Provably fair crash algorithm with verifiable outcomes
- **Cryptocurrency Integration**: Real-time price fetching and USD-to-crypto conversion
- **WebSockets**: Real-time multiplayer updates and interactions
- **Wallet System**: Simulated cryptocurrency wallet for players
- **Transaction Logging**: Detailed records of all bets, cashouts, and outcomes

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB
- **WebSockets**: ws library
- **Crypto API**: CoinGecko API for real-time prices

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/crypto-crash.git
   cd crypto-crash
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables by creating a `.env` file in the project root with the following content:
   ```
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/crypto-crash
   CRYPTO_API_KEY=your_api_key_here
   CRYPTO_API_BASE_URL=https://api.coingecko.com/api/v3
   GAME_INTERVAL=10000
   MIN_CRASH=1.01
   MAX_CRASH=100
   ```

4. Make sure MongoDB is running on your local machine.

5. Seed the database with sample data:
   ```
   node scripts/seedDatabase.js
   ```

6. Start the server:
   ```
   npm start
   ```

## API Endpoints

### Game Endpoints

- **POST /api/game/bet**: Place a bet
  - Request body: `{ playerId, usdAmount, cryptoCurrency }`
  - Response: Bet details including crypto conversion

- **POST /api/game/cashout**: Cash out during a game
  - Request body: `{ playerId, roundId }`
  - Response: Cashout details including payout

- **GET /api/game/history**: Get game round history
  - Query parameters: `limit`, `page`
  - Response: List of past game rounds with outcomes

- **GET /api/game/current**: Get current game state
  - Response: Current game status, multiplier, and active bets

### Wallet Endpoints

- **GET /api/wallet/balance/:playerId**: Get player's wallet balance
  - Response: Crypto balances and USD equivalents

- **POST /api/wallet/deposit**: Deposit USD to player's wallet (converted to crypto)
  - Request body: `{ playerId, usdAmount, cryptoCurrency }`
  - Response: Transaction details

- **GET /api/wallet/transactions/:playerId**: Get player's transaction history
  - Query parameters: `limit`, `page`
  - Response: List of transactions

## WebSocket Events

### Client to Server Events

- **PLACE_BET**: Place a bet
  - Data: `{ type: 'PLACE_BET', playerId, usdAmount, cryptoCurrency }`

- **CASHOUT**: Cash out during a game
  - Data: `{ type: 'CASHOUT', playerId, roundId }`

- **GET_GAME_STATE**: Request current game state
  - Data: `{ type: 'GET_GAME_STATE' }`

### Server to Client Events

- **GAME_STATE**: Current game state
  - Data includes status, multiplier, active bets, game history

- **ROUND_STARTING**: New round is about to start
  - Data includes roundId and startingIn (countdown)

- **MULTIPLIER_UPDATE**: Multiplier value update
  - Data includes current multiplier value

- **PLAYER_BET**: A player placed a bet
  - Data includes player details and bet amount

- **PLAYER_CASHOUT**: A player cashed out
  - Data includes player details, multiplier, and payout

- **ROUND_CRASHED**: Game round ended with a crash
  - Data includes crashPoint and round details

- **BET_PLACED**: Confirmation of player's bet
  - Data includes success status and bet details

- **CASHOUT_CONFIRMED**: Confirmation of player's cashout
  - Data includes success status and cashout details

- **ERROR**: Error notification
  - Data includes error message

## Testing

1. Open the WebSocket test client at `http://localhost:3000/test-client`
2. Use the interface to place bets and cash out during live games
3. Monitor game events and player interactions in real-time

## Provably Fair Algorithm

The game uses a cryptographically secure algorithm to determine crash points:

1. For each round, a unique seed is combined with the round number.
2. This combination is hashed to generate a deterministic but unpredictable value.
3. The hash is converted to a crash point using a formula that ensures fair distribution.
4. Players can verify that the crash point was not manipulated after the game.
