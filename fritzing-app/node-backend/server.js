#!/usr/bin/env node

const readline = require("readline");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { OpenAI } = require("openai");
const { parseString } = require("xml2js");
const { ReadlineParser } = require("@serialport/parser-readline");
const yaml = require("yaml");
const { spawn } = require("child_process");
const { SerialPort } = require("serialport");

const SYSTEM_INSTRUCTION = `You are a teacher assistant in an online interaction prototyping class. The class utilize a tool called "BlinkBoard"; a breadboard with built-in LEDs in each row that can light up to signify to the user which row of the board the instructor is referring to. Each connection hole in the BlinkBoard has a specific coordinate in the form of [row, column]. the coordinate maps to the following schema on the Blinkboard;
Blinkboard Schematics

[1, 1] [1, 2] [1, 3] [1, 4] [1, 5] | [26, 1] [26, 2] [26, 3] [26, 4] [26, 5]
[2, 1] [2, 2] [2, 3] [2, 4] [2, 5] | [27, 1] [27, 2] [27, 3] [27, 4] [27, 5]
[3, 1] [3, 2] [3, 3] [3, 4] [3, 5] | [28, 1] [28, 2] [28, 3] [28, 4] [28, 5]
. .
. .
. .
[24, 1] [24, 2] [24, 3] [24, 4] [24, 5] | [49, 1] [49, 2] [49, 3] [49, 4] [49, 5]
[25, 1] [25, 2] [25, 3] [25, 4] [25, 5] | [50, 1] [50, 2] [50, 3] [50, 4] [50, 5]

where [51, 1] is the positive rail and [52, 1] is a negative rail. The number for the positive and negative rails are just for annotations in the code representation of the circuit, you should only call them positive and negative rail and you should NOT call them by their number. The same row of the breadboard is connected.

the blinkboard also has a built-in analog and digital I/O pins that can be used to your advantage.
- pins A0, A1, A2 can be used to sensing voltage at various point in the circuit in relative to ground.

Your job is to help the student debug the circuit using your understanding of the circuit
`;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let openai_chat_history = [];
let schematics;
let schematic_file_change = false;
let testGroups = []; // Store test groups for the test window

// Serial port detection
let serialPorts = [];
let blinkboard_serial_port;

// Helper function to create error responses with line numbers
function createErrorResponse(error, lineNumber) {
  const errorInfo = lineNumber
    ? `${error.message} (at line ${lineNumber})`
    : error.message;

  return {
    status: "error",
    error: errorInfo,
    timestamp: Date.now(),
    lineNumber: lineNumber,
  };
}

let create_param = {
  model: "o4-mini",
  // model: "gpt-4o-mini",
  input: openai_chat_history,
  // stream: true,
  // tools,
};

async function update_schematics(netlist) {
  return new Promise((resolve, reject) => {
    const rustBinaryPath = path.join(
      __dirname,
      "../parse-schematics/target/release/parse-schematics"
    );

    console.log("Using Rust binary:", rustBinaryPath);

    // Add Fritzing namespace if it's missing
    let processedXml = netlist;
    if (!netlist.includes("xmlns=")) {
      // Find the root element and add xmlns attribute
      const rootMatch = netlist.match(/<(\w+)/);
      if (rootMatch) {
        const rootTag = rootMatch[1];
        const xmlnsAttr = `xmlns="http://fritzing.org/fritzing-0.9.3"`;
        processedXml = netlist.replace(
          `<${rootTag}`,
          `<${rootTag} ${xmlnsAttr}`
        );
        console.log("Added Fritzing namespace to XML");
      }
    }

    const rustProcess = spawn(rustBinaryPath, [processedXml]);

    let yamlOutput = "";
    let errorOutput = "";

    rustProcess.stdout.on("data", (data) => {
      yamlOutput += data.toString();
    });

    rustProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    rustProcess.on("close", (code) => {
      console.log(`Rust process exited with code ${code}`);
      if (code === 0) {
        try {
          // Parse the YAML output
          console.log(yamlOutput);
          const schematics = yamlOutput;
          schematic_file_change = true;
          resolve(schematics);
        } catch (parseError) {
          console.error("Error parsing YAML output:", parseError);
          reject(new Error(`Failed to parse YAML: ${parseError.message}`));
        }
      } else {
        reject(new Error(`Rust process failed: ${errorOutput}`));
      }
    });

    rustProcess.on("error", (error) => {
      console.error("❌ Failed to start Rust process:", error);
      reject(error);
    });
  });
}

function serial_port_on_data(data) {
  console.log("Serial port data:", data);
}

function connect_serial_port(port_path) {
  try {
    console.log(`🔌 Attempting to connect to serial port: ${port_path}`);

    blinkboard_serial_port = new SerialPort({
      path: port_path,
      baudRate: 115200,
    });

    blinkboard_serial_port.on("open", () => {
      console.log("✅ Serial port opened successfully");
      setTimeout(() => {
        init_blinkboard_sequence();
      }, 100);
    });

    blinkboard_serial_port.on("error", (error) => {
      console.error("❌ Serial port error:", error.message);
      console.error(
        "Error occurred in connect_serial_port function at line ~137"
      );
    });

    const parser = blinkboard_serial_port.pipe(
      new ReadlineParser({ delimiter: "\r\n" })
    );

    parser.on("data", (data) => {
      try {
        const parsedData = JSON.parse(data);
        serial_port_on_data(parsedData);
      } catch (parseError) {
        console.error(
          "❌ Failed to parse serial port data:",
          parseError.message
        );
        console.error("Raw data received:", data);
        console.error("Error occurred in parser.on('data') at line ~150");
      }
    });

    parser.on("error", (error) => {
      console.error("❌ Parser error:", error.message);
      console.error("Error occurred in parser.on('error') at line ~155");
    });
  } catch (error) {
    console.error("❌ Failed to create serial port connection:", error.message);
    console.error(
      "Error occurred in connect_serial_port function at line ~137"
    );
    return null;
  }
}

function init_blinkboard_sequence() {
  write_json_to_port({
    cmd: "status",
  }); // sent to avoid parse fail
  write_json_to_port({
    cmd: "status",
  });
  write_json_to_port({
    cmd: "reset",
  });
  write_json_to_port({
    cmd: "animate",
  });
  // write_json_to_port({ cmd: "setLed", led: "1", pattern: "blink2" });
}

function write_json_to_port(json) {
  if (!blinkboard_serial_port) return;
  const to_write = `${JSON.stringify(json)}\n`;
  console.log("Writing to serial port:", to_write);
  blinkboard_serial_port.write(to_write, (error) => {
    if (error) {
      console.error("❌ Error writing to serial port:", error.message);
      console.error(
        "Error occurred in write_json_to_port function at line ~206"
      );
    }
  });
}

async function send_openai_message(message) {
  if (openai_chat_history.length == 0) {
    openai_chat_history.push({
      role: "developer",
      content: SYSTEM_INSTRUCTION,
    });
  }

  if (schematic_file_change) {
    const update_schematics = `this is the .yaml representation of the schematics \n ${schematics} \n `;

    openai_chat_history.push({
      role: "developer",
      content: update_schematics,
    });

    schematic_file_change = false;
  }

  let query_text = `${message} \n Add any test if necessary. You can explain the test in your reply but you don't have to mention some trivial details like test_key`;

  openai_chat_history.push({
    role: "user",
    content: query_text,
  });

  const response = await openai.responses.create(create_param);
  return JSON.stringify(response);
}

// Function to detect available serial ports
async function detectSerialPorts() {
  try {
    // Use system commands to detect serial ports
    const { exec } = require("child_process");

    return new Promise((resolve, reject) => {
      // macOS: use ls command to check /dev/tty.*
      exec("ls /dev/tty.*", (error, stdout, stderr) => {
        if (error) {
          console.log("macOS serial port detection failed:", error.message);
          console.log("Error occurred in serial port detection function");
          resolve([]);
          return;
        }

        const ports = [];
        const lines = stdout.split("\n");
        for (const line of lines) {
          if (
            line.trim() &&
            !line.includes("tty.Bluetooth") &&
            !line.includes("tty.Modem")
          ) {
            ports.push({
              path: line.trim(),
              manufacturer: "Unknown",
              serialNumber: "Unknown",
            });
          }
        }
        resolve(ports);
      });
    });
  } catch (error) {
    console.error("Serial port detection error:", error);
    return [];
  }
}

// Create readline interface for stdin/stdout communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

console.log("BlinkBoard Node.js Backend Started");
console.log("Waiting for commands from Qt frontend...");

// Handle incoming commands from Qt
rl.on("line", async (line) => {
  try {
    const command = JSON.parse(line);
    console.log(`Received command: ${command.command}`);

    // Process the command
    const response = await processCommand(command);

    // Send response back to Qt
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error("Error parsing command:", error.message);
    const errorResponse = createErrorResponse(error, 1); // Line 1 for command parsing
    console.log(JSON.stringify(errorResponse));
  }
});

// Process different commands
async function processCommand(command) {
  const { command: cmd, timestamp } = command;

  switch (cmd) {
    case "init":
      // Detect serial ports and send them along with initialization
      serialPorts = await detectSerialPorts();
      console.log(
        `🔌 Detected ${serialPorts.length} serial ports:`,
        serialPorts
      );

      return {
        status: "success",
        message: "Backend initialized successfully",
        timestamp: Date.now(),
        version: "1.0.0",
        serialPorts: serialPorts,
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

    case "update_schematics":
      try {
        schematics = await update_schematics(command.netlist);
        return {
          status: "success",
          message: JSON.stringify(schematics),
          timestamp: Date.now(),
        };
      } catch (error) {
        return createErrorResponse(error, 320); // Line number for update_schematics
      }

    case "get_test_groups":
      // Return all stored test groups for display in Qt frontend
      return {
        status: "success",
        message: "Test groups retrieved successfully",
        testGroups: testGroups,
        timestamp: Date.now(),
      };

    case "add_test_group":
      // Add a new test group to the collection
      const { testGroupData } = command;
      if (testGroupData) {
        const newTestGroup = {
          id: Date.now().toString(), // Simple ID generation as string
          ...testGroupData,
          timestamp: Date.now(),
        };
        testGroups.push(newTestGroup);
        return {
          status: "success",
          message: "Test group added successfully",
          testGroup: newTestGroup,
          timestamp: Date.now(),
        };
      } else {
        return createErrorResponse(
          new Error("No test group data provided"),
          365
        );
      }

    case "submit_test_results":
      // Handle test results submission
      const { groupId, results } = command;
      if (groupId && results) {
        console.log(`Test results submitted for group ${groupId}:`, results);
        return {
          status: "success",
          message: "Test results submitted successfully",
          groupId: groupId,
          results: results,
          timestamp: Date.now(),
        };
      } else {
        return createErrorResponse(
          new Error("Missing group ID or results data"),
          385
        );
      }

    case "get_serial_ports":
      // Refresh and return available serial ports
      serialPorts = await detectSerialPorts();
      console.log(`🔌 Refreshed serial ports: ${serialPorts.length} found`);
      return {
        status: "success",
        message: "Serial ports refreshed",
        serialPorts: serialPorts,
        timestamp: Date.now(),
      };

    case "blinkboard_connect":
      // Handle BlinkBoard connection request
      const { selectedPort } = command;
      if (selectedPort) {
        console.log(
          `🔌 BlinkBoard connection requested to port: ${selectedPort}`
        );

        console.log("Connecting to serial port:", selectedPort);

        connect_serial_port(selectedPort);

        return {
          status: "success",
          message: `BlinkBoard connection initiated to ${selectedPort}`,
          command: "blinkboard_connect",
          selectedPort: selectedPort,
          timestamp: Date.now(),
        };
      } else {
        return createErrorResponse(
          new Error("No serial port selected for BlinkBoard connection"),
          415
        );
      }

    default:
      // Check if it's a chat message
      if (cmd.startsWith("chat:")) {
        const message = cmd.substring(5); // Remove "chat:" prefix
        console.log(`Chat message received: ${message}`);

        const response = await send_openai_message(message);
        // Echo the message back (you can add more sophisticated chat logic here)
        return {
          type: "chat",
          message: `${response}`,
          timestamp: Date.now(),
        };
      }

      return createErrorResponse(new Error(`Unknown command: ${cmd}`), 435);
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

// Initialize with some sample test groups
testGroups = [
  {
    id: "1",
    title: "Circuit Validation Tests",
    description:
      "Basic validation tests for circuit components and connections",
    tests: [
      {
        name: "Component Connection Test",
        description: "Verify all components are properly connected",
      },
      {
        name: "Power Supply Test",
        description: "Check power supply connections and voltage levels",
      },
      {
        name: "Signal Flow Test",
        description: "Validate signal paths through the circuit",
      },
    ],
    timestamp: Date.now(),
  },
  {
    id: "2",
    title: "Performance Tests",
    description: "Performance and stress testing for circuit operation",
    tests: [
      {
        name: "Load Testing",
        description: "Test circuit behavior under various load conditions",
      },
      {
        name: "Temperature Test",
        description: "Verify circuit stability across temperature ranges",
      },
      {
        name: "Frequency Response",
        description: "Measure frequency response characteristics",
      },
    ],
    timestamp: Date.now(),
  },
  {
    id: "3",
    title: "User Interface Tests",
    description: "Testing the user interface and interaction elements",
    tests: [
      {
        name: "Button Functionality",
        description: "Test all button interactions and responses",
      },
      {
        name: "Display Accuracy",
        description: "Verify display shows correct information",
      },
      {
        name: "Error Handling",
        description: "Test system response to invalid inputs",
      },
    ],
    timestamp: Date.now(),
  },
];
