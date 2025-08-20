#!/usr/bin/env node

// Test script to verify serial port display functionality
// This simulates the Qt frontend sending commands to test the backend

const { spawn } = require("child_process");

// Start the Node.js backend
const backend = spawn("node", ["server.js"], {
  stdio: ["pipe", "pipe", "pipe"],
});

console.log("🔌 Testing serial port display functionality...\n");

// Test commands to send
const testCommands = [
  { command: "init", timestamp: Date.now() },
  { command: "get_serial_ports", timestamp: Date.now() },
  {
    command: "blinkboard_connect",
    selectedPort: "/dev/tty.usbserial-12345",
    timestamp: Date.now(),
  },
];

let commandIndex = 0;

// Send commands with delays
function sendNextCommand() {
  if (commandIndex >= testCommands.length) {
    console.log("\n✅ Test completed. Closing backend...");
    backend.kill();
    return;
  }

  const command = testCommands[commandIndex];
  const jsonCommand = JSON.stringify(command);

  console.log(`📤 Sending: ${jsonCommand}`);
  backend.stdin.write(jsonCommand + "\n");

  commandIndex++;

  // Wait 1 second before sending next command
  setTimeout(sendNextCommand, 1000);
}

// Handle backend output
backend.stdout.on("data", (data) => {
  const output = data.toString().trim();
  console.log(`📥 Received: ${output}`);
});

// Handle backend errors
backend.stderr.on("data", (data) => {
  const error = data.toString().trim();
  console.log(`❌ Error: ${error}`);
});

// Handle backend exit
backend.on("close", (code) => {
  console.log(`\n🏁 Backend exited with code ${code}`);
});

// Start sending commands after a short delay
setTimeout(sendNextCommand, 500);

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n🛑 Interrupted by user. Closing...");
  backend.kill();
  process.exit(0);
});
