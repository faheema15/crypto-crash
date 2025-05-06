const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const websocketManager = require('./utils/websocketManager');
const gameController = require('./controllers/gameController');
const walletController = require('./controllers/walletController');
const config = require('./config/config');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Serve test WebSocket client
app.get('/test-client', (req, res) => {
  res.sendFile(path.join(__dirname, '../test/websocketClient.html'));
});

// API Routes
app.post('/api/game/bet', gameController.placeBet);
app.post('/api/game/cashout', gameController.cashout);
app.get('/api/game/history', gameController.getGameHistory);
app.get('/api/game/current', gameController.getCurrentGame);

app.get('/api/wallet/balance/:playerId', walletController.getBalance);
app.post('/api/wallet/deposit', walletController.deposit);
app.get('/api/wallet/transactions/:playerId', walletController.getTransactions);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: err.message || 'Something went wrong!' });
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket server
const wss = new WebSocket.Server({ server });
// Initialize the websocket manager with the server and gameService
// Note: You'll need to import your gameService or pass it later
websocketManager.initialize(server, null); // Replace null with gameService when available

// Connect to MongoDB
mongoose.connect(config.mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

module.exports = { app, server };