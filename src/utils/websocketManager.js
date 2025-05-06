const WebSocket = require('ws');
const url = require('url');
const config = require('../config/config');

class WebSocketManager {
  constructor() {
    this.clients = new Map(); // Map client ID to WebSocket connection
    this.server = null;
    this.gameService = null; // Will be set after initialization
  }

  /**
   * Initialize the WebSocket server
   * @param {Object} server - HTTP server instance
   * @param {Object} gameService - Game service instance
   */
  initialize(server, gameService) {
    this.gameService = gameService;
    
    // Create WebSocket server
    this.server = new WebSocket.Server({ server });
    
    // Set up connection handler
    this.server.on('connection', this.handleConnection.bind(this));
    
    console.log('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connections
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request
   */
  handleConnection(ws, req) {
    // Generate a unique client ID
    const clientId = this.generateClientId();
    
    // Parse query parameters
    const queryString = url.parse(req.url, true).query;
    const playerId = queryString.playerId;
    
    // Store client information
    this.clients.set(clientId, {
      socket: ws,
      playerId,
      connected: true
    });
    
    console.log(`Client connected: ${clientId}${playerId ? `, Player: ${playerId}` : ''}`);
    
    // Send current game state upon connection
    this.sendGameState(clientId);
    
    // Set up message handler
    ws.on('message', (message) => this.handleMessage(clientId, message));
    
    // Set up close handler
    ws.on('close', () => this.handleClose(clientId));
    
    // Set up error handler
    ws.on('error', (error) => this.handleError(clientId, error));
  }

  /**
   * Handle WebSocket messages
   * @param {string} clientId - Client ID
   * @param {string} message - Message data
   */
  async handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);
      
      if (!client) {
        return;
      }
      
      console.log(`Message from client ${clientId}:`, data.type);
      
      switch (data.type) {
        case 'cashout':
          if (client.playerId && this.gameService) {
            const result = await this.gameService.cashout(client.playerId);
            this.sendToClient(clientId, {
              type: 'cashout_result',
              success: result.success,
              message: result.message,
              data: result.data
            });
          }
          break;
          
        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from client ${clientId}:`, error);
    }
  }

  /**
   * Handle WebSocket connection close
   * @param {string} clientId - Client ID
   */
  handleClose(clientId) {
    const client = this.clients.get(clientId);
    
    if (client) {
      client.connected = false;
      console.log(`Client disconnected: ${clientId}`);
      
      // Remove client after a short timeout (in case they reconnect)
      setTimeout(() => {
        if (client && !client.connected) {
          this.clients.delete(clientId);
        }
      }, 5000);
    }
  }

  /**
   * Handle WebSocket errors
   * @param {string} clientId - Client ID
   * @param {Error} error - Error object
   */
  handleError(clientId, error) {
    console.error(`WebSocket error for client ${clientId}:`, error);
  }

  /**
   * Generate a unique client ID
   * @returns {string} - Client ID
   */
  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Send data to a specific client
   * @param {string} clientId - Client ID
   * @param {Object} data - Data to send
   */
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    
    if (client && client.connected && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(data));
    }
  }

  /**
   * Send data to all connected clients
   * @param {Object} data - Data to send
   */
  broadcast(data) {
    const message = JSON.stringify(data);
    
    this.clients.forEach((client, clientId) => {
      if (client.connected && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    });
  }

  /**
   * Send current game state to a client
   * @param {string} clientId - Client ID
   */
  sendGameState(clientId) {
    if (this.gameService) {
      const gameState = this.gameService.getCurrentGameState();
      
      this.sendToClient(clientId, {
        type: 'game_state',
        data: gameState
      });
    }
  }

  /**
   * Broadcast round start event
   * @param {Object} roundData - Round data
   */
  broadcastRoundStart(roundData) {
    this.broadcast({
      type: 'round_start',
      data: roundData
    });
  }

  /**
   * Broadcast multiplier update
   * @param {number} multiplier - Current multiplier
   * @param {number} elapsedTime - Elapsed time in milliseconds
   */
  broadcastMultiplierUpdate(multiplier, elapsedTime) {
    this.broadcast({
      type: 'multiplier_update',
      data: {
        multiplier,
        elapsedTime
      }
    });
  }

  /**
   * Broadcast player cashout
   * @param {Object} cashoutData - Cashout data
   */
  broadcastPlayerCashout(cashoutData) {
    this.broadcast({
      type: 'player_cashout',
      data: cashoutData
    });
  }

  /**
   * Broadcast round crash
   * @param {Object} crashData - Crash data
   */
  broadcastRoundCrash(crashData) {
    this.broadcast({
      type: 'round_crash',
      data: crashData
    });
  }
}

module.exports = new WebSocketManager();