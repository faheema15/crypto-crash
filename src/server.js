const { server } = require('./app');
const config = require('./config/config');
const { startGameCycle } = require('./services/gameService');

// Start the server
const PORT = config.port || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server is available at ws://localhost:${PORT}`);
  console.log(`Test client available at http://localhost:${PORT}/test-client`);
  
  // Start the game cycle
  startGameCycle();
});