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
const { EventEmitter } = require("events");

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

// const gpt_model = "gpt-4o-mini";
const gpt_model = "o4-mini";

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

const tools = [
  {
    type: "function",
    name: "add_self_observe_test",
    description:
      "Adding a test that ask the student to describe something about the circuit. For example, if you push X button, does Y light up",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        jsondata: {
          type: "object",
          properties: {
            pin: {
              type: "array",
              items: { type: "number", maximum: 50, minimum: 1 },
              description:
                "pins that you want to blink to better support your message",
            },
          },
          required: ["pin"],
          additionalProperties: false,
        },
      },
      required: ["title", "description", "jsondata"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "add_measure_voltage_test",
    description:
      "Ask the student to measure voltage at any row on the BlinkBoard. Records the voltage at 500ms interval for 10 seconds. You can describe some of the instruction in the description e.g. rotate the potentionmeter from one end to the other as you measure, bend the flex sensor repeatedly as you measure, etc.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: {
          type: "string",
          description:
            "this should explain the reason why you administered this test",
        },
        jsondata: {
          type: "object",
          properties: {
            measure_pin: {
              type: "string",
              description:
                "you can decide by yourself which pin to use for measuring. this is the blinkboard built-in adc pins",
              enum: ["a0", "a1", "a2"],
            },
            measure_row: {
              type: "number",
              description: "the row which you want to measure voltage",
              maximum: 50,
              minimum: 1,
            },
          },
          required: ["measure_pin", "measure_row"],
          additionalProperties: false,
        },
      },
      required: ["title", "description", "jsondata"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function add_self_observe_test({ title, description, jsondata }) {
  // console.log("add_self_observe_test", title, description, jsondata);

  // Find the latest test group and add the new test
  if (testGroups.length > 0) {
    const latestGroup = testGroups[testGroups.length - 1];

    const newTest = {
      id: Date.now().toString(),
      type: "self_observe",
      title: title,
      description: description,
      jsondata: jsondata,
      timestamp: Date.now(),
      userObservation: "", // Will store user's observation
      completed: false,
    };

    latestGroup.tests.push(newTest);

    console.log(
      `✅ Added self observation test "${title}" to group "${latestGroup.title}"`
    );

    // Send the updated test groups to the frontend
    console.log(
      JSON.stringify({
        type: "test_groups_updated",
        testGroups: testGroups,
        timestamp: Date.now(),
      })
    );

    return newTest.id;
  } else {
    console.log("❌ No test groups available to add test to");
    return null;
  }
}

function add_measure_voltage_test({ title, description, jsondata }) {
  console.log("add_measure_voltage_test", title, description, jsondata);

  // Find the latest test group and add the new test
  if (testGroups.length > 0) {
    const latestGroup = testGroups[testGroups.length - 1];

    // Create new test object
    const newTest = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "measure_voltage",
      title: title,
      description: description,
      jsondata: jsondata || {},
      measurePin: jsondata?.measure_pin || "A0",
      measureRow: jsondata?.measure_row || 1,
      completed: false,
      voltageData: [], // Will store voltage measurements
    };

    // Add test to the latest group
    latestGroup.tests.push(newTest);

    console.log(
      `✅ Added measure voltage test "${title}" to group "${latestGroup.title}"`
    );

    // Emit test groups updated event to frontend
    process.stdout.write(
      JSON.stringify({
        type: "test_groups_updated",
        testGroups: testGroups,
        timestamp: Date.now(),
      }) + "\n"
    );
  } else {
    console.log(
      "⚠️ No test groups available. Cannot add measure voltage test."
    );
  }
}

class EventHandler extends EventEmitter {
  openai;
  constructor(openai) {
    super();
    this.openai = openai;
  }

  async onEvent(event) {
    try {
      console.log(event);
      // Retrieve events that are denoted with 'requires_action'
      // since these will have our tool_calls
      if (event.type === "response.output_item.added") {
        if (event.item.type === "message") {
          process.stdout.write(
            JSON.stringify({
              type: "streaming_start",
              message: "Starting AI response...",
              timestamp: Date.now(),
            }) + "\n"
          );
        } else if (event.item.type === "function_call") {
          process.stdout.write(
            JSON.stringify({
              type: "function_calling",
              message: "Calling function...",
              timestamp: Date.now(),
            }) + "\n"
          );
        }
      } else if (event.type === "response.completed") {
        event.response.output.forEach((output) => {
          if (output.type === "message") {
            openai_chat_history = [
              ...openai_chat_history,
              { role: "assistant", content: output.content[0].text },
            ];
          } else {
            openai_chat_history = [...openai_chat_history, output];
          }
        });

        const function_calls = event.response.output.filter(
          (output) => output.type === "function_call"
        );

        if (function_calls.length > 0) {
          const set_count = testGroups.length + 1;
          testGroups.push({
            id: Date.now().toString(),
            title: `Debug ${set_count}`,
            description: `Debug ${set_count}`,
            tests: [],
          });
          this.handle_function_calls(function_calls);
        }
      } else if (event.type === "response.output_text.done") {
        // TODO: tell the frontend that the output is done

        process.stdout.write(
          JSON.stringify({
            type: "chat",
            message: event.text,
            timestamp: Date.now(),
          }) + "\n"
        );

        process.stdout.write(
          JSON.stringify({
            type: "streaming_done",
            message: "AI response complete",
            timestamp: Date.now(),
          }) + "\n"
        );
        console.log("output is done");
      } else if (event.type === "response.output_text.delta") {
        // current_gpt_answer.text += event.delta;
        // chat_scroll_area?.scrollToBottom();
        // No longer sending delta events - just accumulate content internally
      }
    } catch (error) {
      console.error("Error handling event:", error);
    }
  }

  async handle_function_calls(responses) {
    if (responses.length > 0) {
      responses.forEach((response) => {
        if (response.type === "function_call") {
          console.log(response);
          if (response.name === "add_self_observe_test") {
            const { title, description } = JSON.parse(response.arguments);
            const jsondata = { field: undefined };
            const test_key = add_self_observe_test({
              title,
              description,
              jsondata,
            });

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify({ test_key, successfully_added: true }),
            });
          } else if (response.name === "add_measure_voltage_test") {
            const { title, description, jsondata } = JSON.parse(
              response.arguments
            );
            const test_key = add_measure_voltage_test({
              title,
              description,
              jsondata,
            });

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify({ test_key, successfully_added: true }),
            });
          }
        }
      });
    }

    const create_param = {
      model: gpt_model,
      input: openai_chat_history,
      stream: true,
      tools,
    };

    const response = await this.openai.responses.create(create_param);

    for await (const event of response) {
      this.emit("event", event);
    }
  }
}

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
  if (data.status === "ready") {
    // TODO: send that the blinkboard is ready
  } else if (data.ack === "analogRead") {
    const analog_read_data = {
      a0: data.A0 / 1000,
      a1: data.A1 / 1000,
      a2: data.A2 / 1000,
    };
    process.stdout.write(
      JSON.stringify({
        type: "analog_read_data",
        data: JSON.stringify(analog_read_data),
        timestamp: Date.now(),
      }) + "\n"
    );
  }
}

function connect_serial_port(port_path) {
  try {
    console.log(`🔌 Attempting to connect to serial port: ${port_path}`);

    blinkboard_serial_port = new SerialPort({
      path: port_path,
      baudRate: 115200,
    });

    blinkboard_serial_port.on("open", () => {
      // console.log("✅ Serial port opened successfully");
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
  // console.log("Writing to serial port:", to_write);
  blinkboard_serial_port.write(to_write, (error) => {
    if (error) {
      console.error("❌ Error writing to serial port:", error.message);
      console.error(
        "Error occurred in write_json_to_port function at line ~206"
      );
    }
  });
}

function blink_row(row, pattern) {
  write_json_to_port({
    cmd: "setLed",
    led: row,
    pattern: pattern,
  });
}

function blink_rows(rows, pattern) {
  rows.forEach((row) => {
    write_json_to_port({
      cmd: "setLed",
      led: row,
      pattern: pattern,
    });
  });
}

function blink_command_pin(pin, pattern) {
  write_json_to_port({
    cmd: "setCmdLed",
    led: pin,
    pattern: pattern,
  });
}

function blink_command_pins(pins, pattern) {
  pins.forEach((pin) => {
    write_json_to_port({
      cmd: "setCmdLed",
      led: pin,
      pattern: pattern,
    });
  });
}

function request_voltage_data() {
  write_json_to_port({
    cmd: "reset",
  });
  write_json_to_port({
    cmd: "analogRead",
    sample: 5,
  });
}

async function send_openai_message(message) {
  const eventHandler = new EventHandler(openai);
  eventHandler.on("event", eventHandler.onEvent.bind(eventHandler));

  if (openai_chat_history.length == 0) {
    openai_chat_history.push({
      role: "developer",
      content: SYSTEM_INSTRUCTION,
    });
  }

  // console.log("schematic_file_change", schematic_file_change);

  if (schematic_file_change) {
    const update_schematics = `this is the .yaml representation of the schematics \n ${schematics} \n `;

    openai_chat_history.push({
      role: "developer",
      content: update_schematics,
    });

    // console.log("update_schematics", update_schematics);

    schematic_file_change = false;
  }

  let query_text = `${message} \n Add any test if necessary. You can explain the test in your reply but you don't have to mention some trivial details like test_key`;

  openai_chat_history.push({
    role: "user",
    content: query_text,
  });

  // Accumulate the complete response content
  let completeResponse = "";

  const create_param = {
    model: gpt_model,
    input: openai_chat_history,
    stream: true,
    tools,
  };

  // console.log("create_param", create_param);

  const response = await openai.responses.create(create_param);

  for await (const event of response) {
    // Accumulate content instead of streaming it
    // if (event.type === "response.output_text.delta") {
    //   completeResponse += event.delta;
    // }

    // Also emit to event handler for internal processing
    eventHandler.emit("event", event);
  }

  // Send the complete response when streaming is done
  // if (completeResponse.trim()) {
  //   console.log(
  //     JSON.stringify({
  //       type: "chat",
  //       message: completeResponse,
  //       timestamp: Date.now(),
  //     })
  //   );
  // }

  return "success";
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
      // console.log(
      //   `🔌 Detected ${serialPorts.length} serial ports:`,
      //   serialPorts
      // );

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
        testGroups: testGroups,
        timestamp: Date.now(),
      };

    case "submit_test_results":
      try {
        const { groupId, results } = command;
        // console.log(`📝 Received test results for group ${groupId}:`, results);

        const message = `this is the test results that we have run. \n ${JSON.stringify(
          results
        )} \n 
        please analyze the test results and provide a summary of the test results.
        `;
        await send_openai_message(message);

        return {
          status: "success",
          message: `Test results for group ${groupId} received successfully`,
          timestamp: Date.now(),
          resultsReceived: results,
        };
      } catch (error) {
        return createErrorResponse(error, 650); // Line number for submit_test_results
      }

    case "blink_request":
      try {
        const { test, action } = command;
        console.log(`🔘 Received blink request for test: ${test.title}`);
        console.log(`Action: ${action}`);
        console.log(`Test data:`, test);

        if (test.type === "self_observe") {
          blink_rows(test.jsondata.pin, "blink");
        } else if (test.type === "measure_voltage") {
          blink_command_pin(test.jsondata.measure_pin, "blink");
          blink_row(test.jsondata.measure_row, "blink");
        }

        setTimeout(() => {
          write_json_to_port({
            cmd: "reset",
          });
        }, 5000);

        return {
          status: "success",
          message: `Blink request processed for test: ${test.title}`,
          timestamp: Date.now(),
        };
      } catch (error) {
        return createErrorResponse(error, 700); // Line number for blink_request
      }

    case "request_voltage_data":
      const voltage_data_interval = setInterval(() => {
        request_voltage_data();
      }, 500);

      setTimeout(() => {
        clearInterval(voltage_data_interval);
      }, 10000);

      return {
        status: "success",
        message: "Voltage data requested",
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

    case "get_serial_ports":
      // Refresh and return available serial ports
      serialPorts = await detectSerialPorts();
      // console.log(`🔌 Refreshed serial ports: ${serialPorts.length} found`);
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
        // // Echo the message back (you can add more sophisticated chat logic here)
        // return {
        //   type: "chat",
        //   message: `${response}`,
        //   timestamp: Date.now(),
        // };
        return;
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
      // {
      //   name: "Component Connection Test",
      //   description: "Verify all components are properly connected",
      // },
      // {
      //   name: "Power Supply Test",
      //   description: "Check power supply connections and voltage levels",
      // },
      // {
      //   name: "Signal Flow Test",
      //   description: "Validate signal paths through the circuit",
      // },
      {
        id: "so_demo_1",
        type: "self_observe",
        title: "When you press the button, what does the LED do?",
        description:
          "Press and release the button a few times and describe the LED behavior.",
        jsondata: { pin: [10] },
        userObservation: "",
        completed: false,
      },
      {
        id: "mv_demo_1",
        type: "measure_voltage",
        title: "Measure voltage at row 15 using A0",
        description:
          "Rotate the potentiometer from end to end while measuring the voltage.",
        jsondata: { measure_pin: "a0", measure_row: 15 },
        measurePin: "a0",
        measureRow: 15,
        completed: false,
        voltageData: [],
      },
    ],
    timestamp: Date.now(),
  },
  // {
  //   id: "2",
  //   title: "Performance Tests",
  //   description: "Performance and stress testing for circuit operation",
  //   tests: [
  //     {
  //       name: "Load Testing",
  //       description: "Test circuit behavior under various load conditions",
  //     },
  //     {
  //       name: "Temperature Test",
  //       description: "Verify circuit stability across temperature ranges",
  //     },
  //     {
  //       name: "Frequency Response",
  //       description: "Measure frequency response characteristics",
  //     },
  //   ],
  //   timestamp: Date.now(),
  // },
  // {
  //   id: "3",
  //   title: "User Interface Tests",
  //   description: "Testing the user interface and interaction elements",
  //   tests: [
  //     {
  //       name: "Button Functionality",
  //       description: "Test all button interactions and responses",
  //     },
  //     {
  //       name: "Display Accuracy",
  //       description: "Verify display shows correct information",
  //     },
  //     {
  //       name: "Error Handling",
  //       description: "Test system response to invalid inputs",
  //     },
  //   ],
  //   timestamp: Date.now(),
  // },
];
