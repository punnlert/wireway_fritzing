#!/usr/bin/env node

const readline = require("readline");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { OpenAI } = require("openai");
const { parseString } = require("xml2js");
const { ReadlineParser } = require("@serialport/parser-readline");
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
So, instead of saying [51, 1] and [52, 1], you should say "positive rail" and "negative rail".


the blinkboard also has a built-in analog and digital I/O rows that can be used to your advantage.
- rows A0, A1, A2 can be used to sensing voltage at various point in the circuit in relative to ground.
- rows D0, D1 can be used to output high and low voltage and PWM.
- row D2 can be used to output analog voltage between 0 and 4.5V.

The user can choose for you to behave in two different modes:
- asking mode: the student will ask you general question about the circuit that does not require you to form any hypothesis that needs to be tested. e.g. the specification of a components, where to connect a component, where should somethign occur, etc. In this mode, you can make suggestions to correct any obvious mistakes.
- testing mode: the student will ask you questions that you would need some information of the current state of the circuit to answer. e.g. why is the reading from my potentiometer not changing, why is the LED not lighting up, etc. In this mode, you have to form some hypothesis about why the situation is happening and then add tests to debug the circuit according to your hypothesis. If the student is simply making a miswiring mistake, you should just suggest them to fix it. Only add tests if you have suspision about something. Don't add extensive tests. ONLY ADD THEM WHEN YOU FEEL NECESSARY.
`;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let openai_chat_history = [];
let schematics;
let schematic_file_change = false;
let testGroups = []; // Store test groups for the test window

let openai_chat_context = [];

let global_mode = "asking";
let mode_changed = false;

// Serial port detection
let serialPorts = [];
let blinkboard_serial_port;

// const gpt_model = "gpt-4o-mini";
const gpt_model = "o4-mini";
const gpt_reasoning = { effort: "low" };

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

const testing_tools = [
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
        test_group_id: {
          type: "string",
          description:
            "the id of the test group to add the test to. you must provide it every time for it to be added to the correct group. if you don't have any test group available, you can add a test group first by calling the add_test_group function",
        },
        jsondata: {
          type: "object",
          properties: {
            row: {
              type: "array",
              items: { type: "number", maximum: 50, minimum: 1 },
              description:
                "rows that you want to blink to better support your message",
            },
          },
          required: ["row"],
          additionalProperties: false,
        },
      },
      required: ["title", "description", "jsondata", "test_group_id"],
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
        test_group_id: {
          type: "string",
          description:
            "the id of the test group to add the test to. you must provide it every time for it to be added to the correct group. if you don't have any test group available, you can add a test group first by calling the add_test_group function",
        },
        jsondata: {
          type: "object",
          properties: {
            blinkboard_adc_row: {
              type: "string",
              description:
                "you can decide by yourself which ADC row to use for measuring. this is the blinkboard built-in adc rows",
              enum: ["a0", "a1", "a2"],
            },
            measure_row: {
              type: "number",
              description: "the row which you want to measure voltage",
              maximum: 50,
              minimum: 1,
            },
          },
          required: ["blinkboard_adc_row", "measure_row"],
          additionalProperties: false,
        },
      },
      required: ["title", "description", "jsondata", "test_group_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "add_high_low_voltage_test",
    description:
      "Choose a specific row that you want to turn high or low and let the student observe the result of the change.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: {
          type: "string",
          description:
            "this should explain the reason why you administered this test",
        },
        test_group_id: {
          type: "string",
          description:
            "the id of the test group to add the test to. you must provide it every time for it to be added to the correct group. if you don't have any test group available, you can add a test group first by calling the add_test_group function",
        },
        jsondata: {
          type: "object",
          properties: {
            blinkboard_digital_row: {
              type: "string",
              description:
                "you can decide by yourself which digital row to use for to administer the voltage. this is the blinkboard built-in digital rows",
              enum: ["d0", "d1"],
            },
            high_low_pattern: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  voltage: {
                    type: "string",
                    description: "the voltage you want to turn the row to",
                    enum: ["high", "low"],
                  },
                  duration: {
                    type: "number",
                    description: "the duration of the voltage in milliseconds",
                  },
                },
                required: ["voltage", "duration"],
                additionalProperties: false,
              },
            },
            high_low_row: {
              type: "number",
              description: "the row which you want to turn high or low",
              maximum: 50,
              minimum: 1,
            },
          },
          required: [
            "blinkboard_digital_row",
            "high_low_row",
            "high_low_pattern",
          ],
          additionalProperties: false,
        },
      },
      required: ["title", "description", "jsondata", "test_group_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "add_switch_connection_suggestion",
    description:
      "Sometimes, the student might mistakenly connect some pins in the wrong hole. This is how we suggest them to fix it.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        test_group_id: {
          type: "string",
          description:
            "the id of the test group to add the test to. you must provide it every time for it to be added to the correct group. if you don't have any test group available, you can add a test group first by calling the add_test_group function",
        },
        jsondata: {
          type: "object",
          properties: {
            row_from: {
              type: "string",
              enum: [
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "10",
                "11",
                "12",
                "13",
                "14",
                "15",
                "16",
                "17",
                "18",
                "19",
                "20",
                "21",
                "22",
                "23",
                "24",
                "25",
                "26",
                "27",
                "28",
                "29",
                "30",
                "31",
                "32",
                "33",
                "34",
                "35",
                "36",
                "37",
                "38",
                "39",
                "40",
                "41",
                "42",
                "43",
                "44",
                "45",
                "46",
                "47",
                "48",
                "49",
                "50",
                "a0",
                "a1",
                "a2",
                "d0",
                "d1",
                "d2",
                "vcc",
                "gnd",
              ],
              description:
                "the row that the student mistakenly connected. please note that these are the rows name for all rows available on the blinkboards. other component may have pins with the same name. be careful to not make mistake.",
            },
            row_to: {
              type: "string",
              description:
                "the row that the student should connect to. please note that these are the rows name for all rows available on the blinkboards. other component may have pins with the same name. be careful to not make mistake.",
              enum: [
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "10",
                "11",
                "12",
                "13",
                "14",
                "15",
                "16",
                "17",
                "18",
                "19",
                "20",
                "21",
                "22",
                "23",
                "24",
                "25",
                "26",
                "27",
                "28",
                "29",
                "30",
                "31",
                "32",
                "33",
                "34",
                "35",
                "36",
                "37",
                "38",
                "39",
                "40",
                "41",
                "42",
                "43",
                "44",
                "45",
                "46",
                "47",
                "48",
                "49",
                "50",
                "a0",
                "a1",
                "a2",
                "d0",
                "d1",
                "d2",
                "vcc",
                "gnd",
              ],
            },
          },
          required: ["row_from", "row_to"],
          additionalProperties: false,
        },
      },
      required: ["title", "description", "jsondata", "test_group_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "add_test_group",
    description:
      "Adding a test group. One test group should have only one goal that you want to prove. Must be called before adding any test.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
      },
      required: ["title", "description"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const suggesting_tools = [
  {
    type: "function",
    name: "add_suggestion_group",
    description:
      "Adding a suggestion group. One suggestion group should have only one goal that you want to prove. Must be called before adding any suggestion.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
      },
      required: ["title", "description"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "add_switch_connection_suggestion",
    description:
      "Sometimes, the student might mistakenly connect some pins in the wrong hole. This is how we suggest them to fix it.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        test_group_id: {
          type: "string",
          description:
            "the id of the test group to add the test to. you must provide it every time for it to be added to the correct group. if you don't have any test group available, you can add a test group first by calling the add_test_group function",
        },
        jsondata: {
          type: "object",
          properties: {
            row_from: {
              type: "string",
              enum: [
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "10",
                "11",
                "12",
                "13",
                "14",
                "15",
                "16",
                "17",
                "18",
                "19",
                "20",
                "21",
                "22",
                "23",
                "24",
                "25",
                "26",
                "27",
                "28",
                "29",
                "30",
                "31",
                "32",
                "33",
                "34",
                "35",
                "36",
                "37",
                "38",
                "39",
                "40",
                "41",
                "42",
                "43",
                "44",
                "45",
                "46",
                "47",
                "48",
                "49",
                "50",
                "a0",
                "a1",
                "a2",
                "d0",
                "d1",
                "d2",
                "vcc",
                "gnd",
              ],
              description:
                "the row that the student mistakenly connected. please note that these are the rows name for all rows available on the blinkboards. other component may have pins with the same name. be careful to not make mistake.",
            },
            row_to: {
              type: "string",
              description:
                "the row that the student should connect to. please note that these are the rows name for all rows available on the blinkboards. other component may have pins with the same name. be careful to not make mistake.",
              enum: [
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "10",
                "11",
                "12",
                "13",
                "14",
                "15",
                "16",
                "17",
                "18",
                "19",
                "20",
                "21",
                "22",
                "23",
                "24",
                "25",
                "26",
                "27",
                "28",
                "29",
                "30",
                "31",
                "32",
                "33",
                "34",
                "35",
                "36",
                "37",
                "38",
                "39",
                "40",
                "41",
                "42",
                "43",
                "44",
                "45",
                "46",
                "47",
                "48",
                "49",
                "50",
                "a0",
                "a1",
                "a2",
                "d0",
                "d1",
                "d2",
                "vcc",
                "gnd",
              ],
            },
          },
          required: ["row_from", "row_to"],
          additionalProperties: false,
        },
      },
      required: ["title", "description", "jsondata", "test_group_id"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function add_self_observe_test({
  title,
  description,
  jsondata,
  test_group_id,
}) {
  // console.log("add_self_observe_test", title, description, jsondata);

  // Find the latest test group and add the new test
  if (testGroups.length > 0) {
    const groupIndex = testGroups.findIndex(
      (group) => group.id === test_group_id
    );

    if (groupIndex === -1) {
      console.log("❌ Test group not found");
      return {
        successfully_added: false,
        error: "Test group not found",
      };
    }

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

    testGroups[groupIndex].tests.push(newTest);

    console.log(
      `✅ Added self observation test "${title}" to group "${testGroups[groupIndex].title}"`
    );

    return {
      successfully_added: true,
      error: null,
    };
  } else {
    console.log("❌ No test groups available to add test to");
    return {
      successfully_added: false,
      error: "No test groups available to add test to",
    };
  }
}

function add_measure_voltage_test({
  title,
  description,
  jsondata,
  test_group_id,
}) {
  // console.log("add_measure_voltage_test", title, description, jsondata);

  // Find the latest test group and add the new test
  if (testGroups.length > 0) {
    const groupIndex = testGroups.findIndex(
      (group) => group.id === test_group_id
    );

    if (groupIndex === -1) {
      console.log("❌ Test group not found");
      return {
        successfully_added: false,
        error: "Test group not found",
      };
    }

    // Create new test object
    const newTest = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "measure_voltage",
      title: title,
      description: description,
      jsondata: jsondata || {},
      blinkboardADCRow: jsondata?.blinkboard_adc_row || "A0",
      measureRow: jsondata?.measure_row || 1,
      completed: false,
      voltageData: [], // Will store voltage measurements
    };

    // Add test to the latest group
    testGroups[groupIndex].tests.push(newTest);

    console.log(
      `✅ Added measure voltage test "${title}" to group "${testGroups[groupIndex].title}"`
    );

    return {
      successfully_added: true,
      error: null,
    };
  } else {
    console.log(
      "⚠️ No test groups available. Cannot add measure voltage test."
    );

    return {
      successfully_added: false,
      error: "No test groups available to add test to",
    };
  }
}

function add_high_low_voltage_test({
  title,
  description,
  jsondata,
  test_group_id,
}) {
  if (testGroups.length > 0) {
    const groupIndex = testGroups.findIndex(
      (group) => group.id === test_group_id
    );

    if (groupIndex === -1) {
      console.log("❌ Test group not found");
      return {
        successfully_added: false,
        error: "Test group not found",
      };
    }

    const newTest = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "high_low_voltage",
      title: title,
      description: description,
      jsondata: jsondata || {},
      blinkboardDigitalRow: jsondata?.blinkboard_digital_row || "d0",
      highLowRow: jsondata?.high_low_row || 1,
      highLowPattern: jsondata?.high_low_pattern || [],
      completed: false,
    };

    testGroups[groupIndex].tests.push(newTest);

    console.log(
      `✅ Added high low voltage test "${title}" to group "${testGroups[groupIndex].title}"`
    );

    return {
      successfully_added: true,
      error: null,
    };
  }

  return {
    successfully_added: false,
    error: "No test groups available to add test to",
  };
}

function add_switch_connection_suggestion({
  title,
  description,
  jsondata,
  test_group_id,
}) {
  console.log("add_switch_connection_suggestion", title, description, jsondata);

  if (testGroups.length > 0) {
    const groupIndex = testGroups.findIndex(
      (group) => group.id === test_group_id
    );

    if (groupIndex === -1) {
      console.log("❌ Test group not found");
      return {
        successfully_added: false,
        error: "Test group not found",
      };
    }

    // Create new test object
    const newTest = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "switch_connection_suggestion",
      title: title,
      description: description,
      jsondata: jsondata || {},
      row_from: jsondata?.row_from || "",
      row_to: jsondata?.row_to || "",
      completed: false,
    };

    // Add test to the latest group
    testGroups[groupIndex].tests.push(newTest);

    console.log(
      `✅ Added measure voltage test "${title}" to group "${testGroups[groupIndex].title}"`
    );

    return {
      successfully_added: true,
      error: null,
    };
  } else {
    console.log(
      "⚠️ No test groups available. Cannot add measure voltage test."
    );

    return {
      successfully_added: false,
      error: "No test groups available to add test to",
    };
  }
}

function add_test_group({ title, description }) {
  const id = crypto.randomUUID();
  testGroups.push({
    id,
    title: title,
    description: description,
    tests: [],
  });
  return {
    successfully_added: true,
    test_group_id: id,
    error: null,
  };
}

class EventHandler extends EventEmitter {
  openai;
  constructor(openai) {
    super();
    this.openai = openai;
  }

  async onEvent(event) {
    try {
      // Retrieve events that are denoted with 'requires_action'
      // since these will have our tool_calls
      console.log(event.type);
      if (event.type === "response.output_item.added") {
        if (event.item.type === "message" || event.item.type === "reasoning") {
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
          openai_chat_history = [...openai_chat_history, output];
        });

        const function_calls = event.response.output.filter(
          (output) => output.type === "function_call"
        );

        if (function_calls.length > 0) {
          this.handle_function_calls(function_calls);
          process.stdout.write(
            JSON.stringify({
              type: "test_groups_updated",
              testGroups: testGroups,
              timestamp: Date.now(),
            }) + "\n"
          );
        }
      } else if (event.type === "response.output_text.done") {
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
            const { title, description, test_group_id } = JSON.parse(
              response.arguments
            );
            const jsondata = { field: undefined };
            const result = add_self_observe_test({
              title,
              description,
              jsondata,
              test_group_id,
            });

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          } else if (response.name === "add_measure_voltage_test") {
            const { title, description, jsondata, test_group_id } = JSON.parse(
              response.arguments
            );
            const result = add_measure_voltage_test({
              title,
              description,
              jsondata,
              test_group_id,
            });

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          } else if (response.name === "add_high_low_voltage_test") {
            const { title, description, jsondata, test_group_id } = JSON.parse(
              response.arguments
            );
            const result = add_high_low_voltage_test({
              title,
              description,
              jsondata,
              test_group_id,
            });

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          } else if (response.name === "add_switch_connection_suggestion") {
            const { title, description, jsondata, test_group_id } = JSON.parse(
              response.arguments
            );
            const result = add_switch_connection_suggestion({
              title,
              description,
              jsondata,
              test_group_id,
            });

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          } else if (
            response.name === "add_test_group" ||
            response.name === "add_suggestion_group"
          ) {
            const { title, description } = JSON.parse(response.arguments);
            const result = add_test_group({ title, description });

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          }
        }
      });
    }

    const create_param = {
      model: gpt_model,
      input: openai_chat_history,
      stream: true,
      tools: global_mode === "testing" ? testing_tools : suggesting_tools,
      reasoning: gpt_reasoning,
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

    const rustProcess = spawn(rustBinaryPath, ["-y", "-x", processedXml]);
    const rustProcessJson = spawn(rustBinaryPath, ["-x", processedXml]);

    let yamlOutput = "";
    let errorOutput = "";

    let jsonOutput = "";
    let errorOutputJson = "";

    rustProcess.stdout.on("data", (data) => {
      yamlOutput += data.toString();
    });

    rustProcessJson.stdout.on("data", (data) => {
      jsonOutput += data.toString();
    });

    rustProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    rustProcessJson.stderr.on("data", (data) => {
      errorOutputJson += data.toString();
    });

    // Track completion of both processes
    let yamlCompleted = false;
    let jsonCompleted = false;
    let hasError = false;

    // Function to check if both processes are complete
    const checkCompletion = () => {
      if (yamlCompleted && jsonCompleted && !hasError) {
        try {
          const schematics_yaml = yamlOutput;
          const schematics_json = JSON.parse(jsonOutput);
          schematic_file_change = true;
          console.log("✅ Both Rust processes completed successfully");
          resolve({ schematics_yaml, schematics_json });
        } catch (parseError) {
          console.error("Error processing outputs:", parseError);
          reject(new Error(`Failed to process outputs: ${parseError.message}`));
        }
      }
    };

    rustProcess.on("close", (code) => {
      console.log(`YAML Rust process exited with code ${code}`);
      if (code === 0) {
        yamlCompleted = true;
        checkCompletion();
      } else {
        hasError = true;
        reject(new Error(`YAML Rust process failed: ${errorOutput}`));
      }
    });

    rustProcessJson.on("close", (code) => {
      console.log(`JSON Rust process exited with code ${code}`);
      if (code === 0) {
        jsonCompleted = true;
        checkCompletion();
      } else {
        hasError = true;
        reject(new Error(`JSON Rust process failed: ${errorOutputJson}`));
      }
    });

    rustProcess.on("error", (error) => {
      console.error("❌ Failed to start YAML Rust process:", error);
      hasError = true;
      reject(new Error(`Failed to start YAML Rust process: ${error.message}`));
    });

    rustProcessJson.on("error", (error) => {
      console.error("❌ Failed to start JSON Rust process:", error);
      hasError = true;
      reject(new Error(`Failed to start JSON Rust process: ${error.message}`));
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

function convert_pinname_to_row_num(pinname) {
  const pinMatch = /^pin([1-9]|[1-4][0-9]|50)([A-Z])$/.exec(pinname);
  if (pinMatch) {
    const rowNum = Number(pinMatch[1]);
    const rowLetter = pinMatch[2];

    if (rowNum >= 1 && rowNum <= 50) {
      if (rowLetter >= "A" && rowLetter <= "E") {
        if (rowNum <= 25) {
          return rowNum;
        }
      } else if (rowLetter >= "F" && rowLetter <= "H") {
        return rowNum + 25;
      }
    }
    if (rowLetter == "W" || rowLetter == "Y") {
      return 51;
    } else if (rowLetter == "X" || rowLetter == "Z") {
      return 52;
    }
  }
}

function blink_component(pins, pattern) {
  let leds = [];

  for (const pin of pins) {
    // INSERT_YOUR_CODE
    // Only process pins that match the format 'pin[num][row]' where num is 1-50 and row is A-H or J
    // Example: 'pin12A', 'pin3B', etc.
    const rowNum = convert_pinname_to_row_num(pin);

    if (rowNum && rowNum <= 50) {
      leds.push(rowNum);
      write_json_to_port({
        cmd: "setLed",
        led: rowNum,
        pattern: pattern,
      });
    } else if (rowNum && rowNum === 51) {
      leds.push("vcc");
      write_json_to_port({
        cmd: "setCmdLed",
        led: "vcc",
        pattern: pattern,
      });
    } else if (rowNum && rowNum === 52) {
      leds.push("gnd");
      write_json_to_port({
        cmd: "setCmdLed",
        led: "gnd",
        pattern: pattern,
      });
    }
  }

  // Reset after highlighting
  setTimeout(() => {
    if (leds.length > 0) {
      for (const led of leds) {
        if (led === "vcc" || led === "gnd") {
          write_json_to_port({
            cmd: "setCmdLed",
            led: led,
            pattern: "off",
          });
        } else {
          write_json_to_port({
            cmd: "setLed",
            led: led,
            pattern: "off",
          });
        }
      }
    }
  }, 3000); // Shorter duration for component highlighting
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

  if (mode_changed) {
    openai_chat_history.push({
      role: "developer",
      content: `the operation mode has been changed to ${global_mode}`,
    });
    mode_changed = false;
  }

  if (schematic_file_change) {
    const update_schematics = `this is the .yaml representation of the schematics \n ${schematics.schematics_yaml} \n `;

    openai_chat_history.push({
      role: "developer",
      content: update_schematics,
    });

    // console.log("update_schematics", update_schematics);

    schematic_file_change = false;
  }

  openai_chat_history.push({
    role: "user",
    content: message,
  });

  const create_param = {
    model: gpt_model,
    input: openai_chat_history,
    stream: true,
    tools: global_mode === "testing" ? testing_tools : suggesting_tools,
    reasoning: gpt_reasoning,
  };

  const response = await openai.responses.create(create_param);

  for await (const event of response) {
    // Also emit to event handler for internal processing
    eventHandler.emit("event", event);
  }

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
        console.log(`📝 Received test results for group ${groupId}:`, results);
        console.log("results", results);

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
          blink_rows(test.jsondata.row, "blink");
        } else if (test.type === "measure_voltage") {
          blink_command_pin(test.jsondata.blinkboard_adc_row, "blink");
          blink_row(test.jsondata.measure_row, "blink");
        } else if (test.type === "switch_connection_suggestion") {
          // INSERT_YOUR_CODE
          // Determine if row_from is a number (row) or a command pin (like 'a0', 'd1', etc.)
          if (!isNaN(Number(test.jsondata.row_from))) {
            blink_row(Number(test.jsondata.row_from), "on");
          } else {
            blink_command_pin(test.jsondata.row_from, "on");
          }

          if (!isNaN(Number(test.jsondata.row_to))) {
            blink_row(Number(test.jsondata.row_to), "blink2");
          } else {
            blink_command_pin(test.jsondata.row_to, "blink2");
          }
          // blink_row(test.jsondata.row_from, "on");
          // blink_row(test.jsondata.row_to, "blink2");
        } else if (test.type === "add_high_low_voltage_test") {
          // Handle high/low voltage test
          console.log(`🔘 Processing high/low voltage test: ${test.title}`);
          console.log(`Test data:`, test.jsondata);

          // Extract the high/low pattern from the test data
          const { high_low_pattern, high_low_row, blinkboard_digital_row } =
            test.jsondata;

          // For now, just blink the specified row to indicate the test is active
          // Later, this can be enhanced to play the full sequence
          if (high_low_row && !isNaN(Number(high_low_row))) {
            blink_row(Number(high_low_row), "blink");
            console.log(
              `🔘 Blinking row ${high_low_row} for high/low voltage test`
            );
          }

          // Also blink the digital command pin if specified
          if (blinkboard_digital_row) {
            blink_command_pin(blinkboard_digital_row, "blink");
            console.log(
              `🔘 Blinking digital pin ${blinkboard_digital_row} for high/low voltage test`
            );
          }
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

    case "component_highlight":
      try {
        const { component_id, component_title, timestamp, pins } = command;
        console.log(
          `🔘 Received component highlight request for: ${component_title}`
        );

        // const component = JSON.stringify({
        //   component_id,
        //   component_title,
        //   pins,
        // });

        // openai_chat_context = [
        //   {
        //     role: "developer",
        //     content: `this component is highlighted on the user's UI: ${component}`,
        //   },
        // ];

        blink_component(pins, "on");

        return {
          status: "success",
          message: `Component highlight processed for: ${component_title}`,
          pins_highlighted: 1,
          timestamp: Date.now(),
        };
      } catch (error) {
        return createErrorResponse(error, 800); // Line number for component_highlight
      }

    case "multiple_components_selected":
      try {
        const { components } = command;

        // Use a Set to ensure only unique pins are included

        // const components_string = JSON.stringify(
        //   components.map(({ component_id, component_title, pins }) => ({
        //     component_id,
        //     component_title,
        //     pins,
        //   }))
        // );

        // openai_chat_context = [
        //   {
        //     role: "developer",
        //     content: `these components are highlighted on the user's UI: ${components_string}`,
        //   },
        // ];
      } catch (error) {
        return createErrorResponse(error, 900); // Line number for multiple_components_selected
      }

    case "request_voltage_data":
      const voltage_data_interval = setInterval(() => {
        request_voltage_data();
      }, 500);

      setTimeout(() => {
        clearInterval(voltage_data_interval);
      }, 10500);

      return {
        status: "success",
        message: "Voltage data requested",
        timestamp: Date.now(),
      };

    // case "add_test_group":
    //   // Add a new test group to the collection
    //   const { testGroupData } = command;
    //   if (testGroupData) {
    //     const newTestGroup = {
    //       id: Date.now().toString(), // Simple ID generation as string
    //       ...testGroupData,
    //       timestamp: Date.now(),
    //     };
    //     testGroups.push(newTestGroup);
    //     return {
    //       status: "success",
    //       message: "Test group added successfully",
    //       testGroup: newTestGroup,
    //       timestamp: Date.now(),
    //     };
    //   } else {
    //     return createErrorResponse(
    //       new Error("No test group data provided"),
    //       365
    //     );
    //   }

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

    case "chat":
      try {
        const { message, highlighted_components, mode } = command;
        console.log(`Chat message received: ${message}`);
        console.log(`Highlighted components:`, highlighted_components);
        console.log(`Mode: ${mode}`);

        if (global_mode !== mode) {
          global_mode = mode;
          mode_changed = true;
        }

        // Check if highlighted components are provided
        if (
          highlighted_components &&
          highlighted_components !== undefined &&
          highlighted_components.length > 0
        ) {
          // Create context string from highlighted components
          let contextString = `\n\nContext - Highlighted Components:\n`;
          highlighted_components.forEach((component, index) => {
            const title = component.component_title || component.component_id;
            const row_numbers = component.pins
              ? component.pins
                  .map((pin) => convert_pinname_to_row_num(pin))
                  .join(", ")
              : "No row connected";
            contextString += `${index + 1}. ${title} (ID: ${
              component.component_id
            }) - Row Numbers: ${row_numbers}\n`;
          });

          let query_text = `${message}${contextString}\n\nAdd any tests or suggestions if necessary. You can explain the test in your reply but you don't have to mention some trivial details like test_key`;
          const response = await send_openai_message(query_text);
        } else {
          let query_text = `${message} \n Add any tests or suggestions if necessary. You can explain the test in your reply but you don't have to mention some trivial details like test_key`;
          const response = await send_openai_message(query_text);
        }

        return;
      } catch (error) {
        return createErrorResponse(error, 950); // Line number for chat
      }

    default:
      // No matching command found
      console.log(`Unknown command: ${cmd}`);
      return createErrorResponse(new Error(`Unknown command: ${cmd}`), 999);
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
        jsondata: { row: [10] },
        userObservation: "",
        completed: false,
      },
      {
        id: "mv_demo_1",
        type: "measure_voltage",
        title: "Measure voltage at row 15 using A0",
        description:
          "Rotate the potentiometer from end to end while measuring the voltage.",
        jsondata: { blinkboard_adc_row: "a0", measure_row: 15 },
        blinkboardADCRow: "a0",
        measureRow: 15,
        completed: false,
        voltageData: [],
      },
      {
        id: "sc_demo_1",
        type: "switch_connection_suggestion",
        title: "Switch connection suggestion",
        description:
          "The student mistakenly connected pin 10 to pin 11. You should switch the connection to pin 12.",
        jsondata: { row_from: "10", row_to: "gnd" },
        row_from: "10",
        row_to: "gnd",
        userObservation: "",
        completed: false,
      },
      {
        id: "hl_demo_1",

        type: "add_high_low_voltage_test",
        title: "High/Low Voltage Test",
        description: "Test the high/low voltage of the circuit.",
        jsondata: {
          blinkboard_digital_row: "d0",
          high_low_row: 1,
          high_low_pattern: [
            { voltage: "high", duration: 1000 },
            { voltage: "low", duration: 1000 },
            { voltage: "high", duration: 500 },
            { voltage: "low", duration: 500 },
            { voltage: "high", duration: 1000 },
          ],
        },
        completed: false,
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
