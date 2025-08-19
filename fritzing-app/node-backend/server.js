#!/usr/bin/env node

const readline = require("readline");
const fs = require("fs");
const path = require("path");

// Create readline interface for stdin/stdout communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

console.log("BlinkBoard Node.js Backend Started");
console.log("Waiting for commands from Qt frontend...");

// Handle incoming commands from Qt
rl.on("line", (line) => {
  try {
    const command = JSON.parse(line);
    console.log(`Received command: ${command.command}`);

    // Process the command
    const response = processCommand(command);

    // Send response back to Qt
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error("Error parsing command:", error.message);
    const errorResponse = {
      status: "error",
      error: error.message,
      timestamp: Date.now(),
    };
    console.log(JSON.stringify(errorResponse));
  }
});

// Process different commands
function processCommand(command) {
  const { command: cmd, timestamp } = command;

  switch (cmd) {
    case "init":
      return {
        status: "success",
        message: "Backend initialized successfully",
        timestamp: Date.now(),
        version: "1.0.0",
      };

    case "ping":
      return {
        status: "success",
        message: "pong",
        timestamp: Date.now(),
      };

    case "getStatus":
      return {
        status: "success",
        data: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version,
        },
        timestamp: Date.now(),
      };

    case "fileOperation":
      // Example of a more complex operation
      return {
        status: "success",
        message: "File operation completed",
        timestamp: Date.now(),
      };

    default:
      // Check if it's a chat message
      if (cmd.startsWith("chat:")) {
        const message = cmd.substring(5); // Remove "chat:" prefix
        console.log(`Chat message received: ${message}`);

        // Echo the message back (you can add more sophisticated chat logic here)
        return {
          type: "chat",
          message: `Echo: ${message}`,
          timestamp: Date.now(),
        };
      }

      return {
        status: "error",
        message: `Unknown command: ${cmd}`,
        timestamp: Date.now(),
      };
  }
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("Backend shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Backend shutting down...");
  process.exit(0);
});

// Error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
