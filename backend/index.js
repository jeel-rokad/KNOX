/* ============================================
   KNOX — Main Entry Point
   India's Unified Google Cloud Event Platform
   ============================================ 
   
   This is the main entry point for the Knox backend.
   It loads and starts the Express server defined in server.js.
   
   Usage:
     node index.js          → Start the server
     node seed.js           → Seed the database
   
   Environment Variables:
     PORT       — Server port (default: 3000)
============================================ */

// Load and start the server
require('./server');
