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
const yaml = require("js-yaml");

const SYSTEM_INSTRUCTION = `You are a teacher assistant in a physical computing class. The class utilize a tool called "BlinkBoard"; a breadboard with built-in LEDs in each row that can light up to signify to the user which row of the board the instructor is referring to. Each connection hole in the BlinkBoard has a specific coordinate in the form of [row, column]. the coordinate maps to the following schema on the Blinkboard;
Blinkboard Schematics

[1, 1] [1, 2] [1, 3] [1, 4] [1, 5] | [26, 1] [26, 2] [26, 3] [26, 4] [26, 5]
[2, 1] [2, 2] [2, 3] [2, 4] [2, 5] | [27, 1] [27, 2] [27, 3] [27, 4] [27, 5]
[3, 1] [3, 2] [3, 3] [3, 4] [3, 5] | [28, 1] [28, 2] [28, 3] [28, 4] [28, 5]
. .
. .
. .
[24, 1] [24, 2] [24, 3] [24, 4] [24, 5] | [49, 1] [49, 2] [49, 3] [49, 4] [49, 5]
[25, 1] [25, 2] [25, 3] [25, 4] [25, 5] | [50, 1] [50, 2] [50, 3] [50, 4] [50, 5]

where [51, 1] is the positive rail and [52, 1] is a negative rail. The number for the positive and negative rails are just for annotations in the code representation of the circuit. So, instead of saying [51, 1] and [52, 1], you should say "positive rail" and "negative rail". The same row of the breadboard is connected.

PLEASE GIVE CLEAR, CONCISE, AND SHORT RESPONSES. assume that the student is a beginner and doesn't know any technical terms and that they need children-level of language. you may ask the user to elaborate on some of your instructions when you sense that there's room for ambiguity. Support the user's intention to learn and understand the circuit. If the user ask for confirmation if anything was correct, you can say "yes" or "no" to confirm. If you want the user to test something, you can ask them to switch to the test mode if we're not currently in the test mode.
`;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let openai_chat_history = [];
let schematics;
let parts_connections;
let schematic_file_change = false;
let testGroups = []; // Store test groups for the test window
let code_file;
let code_file_change = false;
let current_token_usage = 0;

let openai_chat_context = [];

let global_mode = "asking";
let mode_changed = false;

// Serial port detection
let serialPorts = [];
let blinkboard_serial_port;

// const gpt_model = "gpt-4o-mini";
const gpt_model = "o4-mini";
const gpt_reasoning = { effort: "low" };
const gpt_verbosity = "low";

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

const tests_functions = [
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
              enum: ["D0", "D1"],
            },
            high_low_pattern: {
              type: "array",
              description:
                "you can create your own pattern of high and low voltage that changes with time. because maybe you want to try some hypothesis out that requires pattern. If you simple want to turn it high or low, then simply add one component into the array",
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
];

const suggestion_functions = [
  {
    type: "function",
    name: "add_new_component_suggestion",
    description:
      "If there's a component that you think should be added in the circuit, you can add a suggestion here. e.g. add a resistor to the circuit",
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
            component_name: { type: "string" },
            component_value: { type: "string" },
            connections: {
              type: "array",
              description:
                "the connections of the component. e.g. [1, 2, 3] means the component is connected to the 1st, 2nd, and 3rd rows. some connections maybe crossing the middle of the board. e.g. [1, 26], or [n, n+25] n < 25 (refer to the blinkboard schematics).",
              items: {
                type: "number",
                maximum: 50,
                minimum: 1,
              },
            },
          },
          required: ["component_name", "component_value", "connections"],
          additionalProperties: false,
        },
      },
      required: ["title", "description", "jsondata", "test_group_id"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const schematics_functions = [
  {
    type: "function",
    name: "request_schematics",
    description:
      'Request the schematics of the circuit. This is useful when you want to be reminded of how the circuit is wired. You can request the schematics of the circuit and then add the component to the circuit. If this fails, you should ask the user to "update the schematics"',
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "add_component_highlight_chat",
    description:
      "Highlight a component in the circuit. This is useful if you want to point out to the user where a component is in the circuit. You can request the schematics of the circuit and then highlight the component. this will appear directly in the chat window as a button that the user can click to highlight the component.",
    parameters: {
      type: "object",
      properties: {
        info: { type: "string" },
        rows: {
          type: "array",
          description:
            "the rows of the component that you want to highlight. only input the rows that you need to support your statement. you can blink multiple rows",
          items: { type: "number", maximum: 50, minimum: 1 },
        },
        component_name: { type: "string" },
        pattern: {
          type: "string",
          enum: ["blink", "blink2", "on"],
        },
      },
      required: ["info", "rows", "component_name", "pattern"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const testing_tools = [
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
  // ...suggestion_functions,
  ...schematics_functions,
  ...tests_functions,
];

const suggesting_tools = [
  ...suggestion_functions,
  ...schematics_functions,
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
  { type: "web_search" },
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

function add_analog_voltage_test({
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
      type: "analog_voltage",
      title: title,
      description: description,
      jsondata: jsondata || {},
      output_row: jsondata?.output_row || 1,
      output_voltage: jsondata?.output_voltage || 0,
      completed: false,
    };

    testGroups[groupIndex].tests.push(newTest);

    console.log(
      `✅ Added analog voltage test "${title}" to group "${testGroups[groupIndex].title}"`
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

function add_new_component_suggestion({
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
      type: "new_component_suggestion",
      title: title,
      description: description,
      jsondata: jsondata || {},
      component_name: jsondata?.component_name || "",
      component_value: jsondata?.component_value || "",
      connections: jsondata?.connections || [],
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

function add_component_highlight_chat({ rows, component_name, pattern, info }) {
  process.stdout.write(
    JSON.stringify({
      type: "component_highlight_chat",
      rows: rows,
      component_name: component_name,
      pattern: pattern,
      info: info,
    }) + "\n"
  );
  return {
    status: "success",
    message: "Component highlight chat added",
    timestamp: Date.now(),
  };
}

function request_schematics() {
  if (!!schematics) {
    return {
      status: "success",
      message: `row connections: ${schematics.schematics_yaml} \n\n part connections: ${parts_connections}`,
      timestamp: Date.now(),
    };
  } else {
    return {
      status: "error",
      message:
        "No schematics found. you should provoke the user to update the schematics to backend.",
      timestamp: Date.now(),
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
      console.log(event);
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
        current_token_usage = event.response.usage.total_tokens;
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

            process.stdout.write(
              JSON.stringify({
                type: "adding_test",
                message: "Adding test...",
                timestamp: Date.now(),
              }) + "\n"
            );

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

            process.stdout.write(
              JSON.stringify({
                type: "adding_test",
                message: "Adding test...",
                timestamp: Date.now(),
              }) + "\n"
            );

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

            process.stdout.write(
              JSON.stringify({
                type: "adding_test",
                message: "Adding test...",
                timestamp: Date.now(),
              }) + "\n"
            );

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          } else if (response.name === "add_analog_voltage_test") {
            const { title, description, jsondata, test_group_id } = JSON.parse(
              response.arguments
            );
            const result = add_analog_voltage_test({
              title,
              description,
              jsondata,
              test_group_id,
            });

            process.stdout.write(
              JSON.stringify({
                type: "adding_test",
                message: "Adding test...",
                timestamp: Date.now(),
              }) + "\n"
            );

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

            process.stdout.write(
              JSON.stringify({
                type: "adding_suggestion",
                message: "Adding suggestion...",
                timestamp: Date.now(),
              }) + "\n"
            );

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          } else if (response.name === "add_new_component_suggestion") {
            const { title, description, jsondata, test_group_id } = JSON.parse(
              response.arguments
            );
            const result = add_new_component_suggestion({
              title,
              description,
              jsondata,
              test_group_id,
            });

            process.stdout.write(
              JSON.stringify({
                type: "adding_suggestion",
                message: "Adding suggestion...",
                timestamp: Date.now(),
              }) + "\n"
            );

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          } else if (response.name === "add_component_highlight_chat") {
            const { rows, component_name, pattern, info } = JSON.parse(
              response.arguments
            );
            const result = add_component_highlight_chat({
              rows,
              component_name,
              pattern,
              info,
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

            process.stdout.write(
              JSON.stringify({
                type: "adding_test_group",
                message: "Adding test group...",
                timestamp: Date.now(),
              }) + "\n"
            );

            openai_chat_history.push({
              type: "function_call_output",
              call_id: response.call_id,
              output: JSON.stringify(result),
            });
          } else if (response.name === "request_schematics") {
            const result = request_schematics();

            process.stdout.write(
              JSON.stringify({
                type: "requesting_schematics",
                message: "Requesting schematics...",
                timestamp: Date.now(),
              }) + "\n"
            );

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
          console.log(schematics_yaml);
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

  // Automatically update schematics when connection is established
  console.log("🔌 BlinkBoard connected - automatically updating schematics...");
  // Note: We'll need to get the current netlist from the frontend
  // This will be handled by the frontend sending an automatic update
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
      } else if (rowLetter >= "F" && rowLetter <= "J") {
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
    cmd: "analogRead",
    sample: 5,
  });
}

async function send_openai_message(message) {
  const eventHandler = new EventHandler(openai);
  eventHandler.on("event", eventHandler.onEvent.bind(eventHandler));

  if (current_token_usage > 8000) {
    openai_chat_history = [];
    current_token_usage = 0;

    openai_chat_history.push({
      role: "developer",
      content: SYSTEM_INSTRUCTION,
    });

    openai_chat_history.push({
      role: "developer",
      content: `the operation mode has been changed to <operation_mode> \n ${global_mode} \n </operation_mode>`,
    });
    mode_changed = false;

    if (!!schematics) {
      const update_schematics = `this is the .yaml representation of the schematics \n <schematics_yaml> \n ${
        schematics.schematics_yaml
      } \n </schematics_yaml> \n it tells you all the components that connects to each row. \n and this is the positional connections of the parts. \n <parts_connections> \n ${JSON.stringify(
        parts_connections
      )} \n </parts_connections>`;

      openai_chat_history.push({
        role: "developer",
        content: update_schematics,
      });
      schematic_file_change = false;
    }
  }

  if (openai_chat_history.length == 0) {
    openai_chat_history.push({
      role: "developer",
      content: SYSTEM_INSTRUCTION,
    });
  }

  if (mode_changed) {
    openai_chat_history.push({
      role: "developer",
      content: `the operation mode has been changed to <operation_mode> \n ${global_mode} \n </operation_mode>`,
    });
    mode_changed = false;
  }

  if (schematic_file_change) {
    const update_schematics = `this is the .yaml representation of the schematics \n <schematics_yaml> \n ${
      schematics.schematics_yaml
    } \n </schematics_yaml> \n it tells you all the components that connects to each row. \n and this is the positional connections of the parts. \n <parts_connections> \n ${JSON.stringify(
      parts_connections
    )} \n </parts_connections>`;

    openai_chat_history.push({
      role: "developer",
      content: update_schematics,
    });

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

    case "update_schematics":
      try {
        schematics = await update_schematics(command.netlist);
        parts_connections = yaml.dump(
          command.parts
            .filter(
              (part) =>
                part.part_name != "Arduino Uno (Rev3)" &&
                part.part_name != "Half breadboard"
            )
            .map((part) => {
              return {
                name: part.part_name,
                connected_to_row: part.rows.flatMap((row) => {
                  return row.connected_to
                    .filter((part) => part.part_label === "Breadboard1")
                    .map((part) => {
                      return `pin: ${
                        row.pin_name
                      } -> row: ${convert_pinname_to_row_num(part.pin_id)}`;
                    });
                }),
                id: part.id,
                label: part.label,
              };
            })
        );
        console.log("parts_connections", parts_connections);
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
        and this is the current schematics that the said test ran on. \n <schematics_yaml> \n ${
          schematics.schematics_yaml
        } \n </schematics_yaml> \n <parts_connections> \n ${parts_connections} \n </parts_connections> \n
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

        let rows = [];

        if (test.type === "self_observe") {
          const { row } = test.jsondata;
          rows.push(row);
          blink_rows(row, "blink");
        } else if (test.type === "measure_voltage") {
          const { blinkboard_adc_row, measure_row } = test.jsondata;
          rows.push(blinkboard_adc_row);
          rows.push(measure_row);
          blink_command_pin(blinkboard_adc_row, "blink");
          blink_row(measure_row, "blink");
        } else if (test.type === "switch_connection_suggestion") {
          // INSERT_YOUR_CODE
          // Determine if row_from is a number (row) or a command pin (like 'a0', 'd1', etc.)
          const { row_from, row_to } = test.jsondata;
          rows.push(row_from);
          rows.push(row_to);

          if (!isNaN(Number(row_from))) {
            blink_row(Number(row_from), "on");
          } else {
            blink_command_pin(row_from, "on");
          }

          if (!isNaN(Number(row_to))) {
            blink_row(Number(row_to), "blink2");
          } else {
            blink_command_pin(row_to, "blink2");
          }
        } else if (test.type === "high_low_voltage") {
          // INSERT_YOUR_CODE
          // Determine if high_low_row is a number (row) or a command pin (like 'a0', 'd1', etc.)
          const { high_low_row, blinkboard_digital_row } = test.jsondata;
          console.log("high_low_row", high_low_row);
          console.log("blinkboard_digital_row", blinkboard_digital_row);
          rows.push(high_low_row);
          rows.push(blinkboard_digital_row.toLowerCase());

          if (high_low_row && !isNaN(Number(high_low_row))) {
            blink_row(Number(high_low_row), "blink");
          }

          if (blinkboard_digital_row) {
            blink_command_pin(blinkboard_digital_row.toLowerCase(), "blink");
          }
        } else if (test.type === "new_component_suggestion") {
          const { connections } = test.jsondata;
          rows = [...rows, ...connections];
          blink_rows(connections, "on");
        } else if (test.type === "component_highlight") {
          const blinking_rows = test.jsondata?.rows || [];
          const pattern = test.jsondata?.pattern || "blink";
          rows = [...rows, ...blinking_rows];
          blink_rows(blinking_rows, pattern);
        }

        setTimeout(() => {
          for (const row of rows) {
            if (!isNaN(Number(row))) {
              blink_row(Number(row), "off");
            } else {
              blink_command_pin(row, "off");
            }
          }
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

        console.log("pins", pins);
        blink_component(
          pins.map((pin) => pin.connection),
          "on"
        );

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

    case "request_voltage_output":
      const { output_row, output_voltage } = command;
      console.log(`🔘 Received voltage output request for: ${output_row}`);
      console.log(`Voltage: ${output_voltage}`);

      write_json_to_port({
        cmd: "setV",
        value: output_voltage * 1000,
      });

      return {
        status: "success",
        message: "Voltage output requested",
        timestamp: Date.now(),
      };

    case "request_high_low":
      try {
        const { blinkboard_digital_row, voltage } = command;
        console.log(
          `🔘 Received high/low request for: ${blinkboard_digital_row}`
        );
        console.log(`Voltage: ${voltage}`);

        if (voltage === "high") {
          write_json_to_port({
            cmd: "setHigh",
            pin: blinkboard_digital_row,
          });
        } else if (voltage === "low") {
          write_json_to_port({
            cmd: "setLow",
            pin: blinkboard_digital_row,
          });
        }

        return {
          status: "success",
          message: "High/Low requested",
          timestamp: Date.now(),
        };
      } catch (error) {
        return createErrorResponse(error, 1000); // Line number for request_high_low
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

    case "code_saved":
      const { code, filename, platform } = command;
      console.log(`💾 Code saved: ${filename}`);
      console.log(`Platform: ${platform}`);
      console.log(`Code: ${code}`);

      if (code_file !== code) {
        code_file = code;
        code_file_change = true;
      }

      return {
        status: "success",
        message: "Code saved",
        timestamp: Date.now(),
      };

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
              ? component.pins.reduce(
                  (acc, pin) =>
                    acc +
                    `${convert_pinname_to_row_num(pin.connection)}(${
                      pin.name
                    }), `,
                  ""
                )
              : "No row connected";
            contextString += `${index + 1}. ${title} (ID: ${
              component.component_id
            }) - Connected at: ${row_numbers}\n`;
          });

          let query_text = `${message}${contextString}\n\nAdd any tests or suggestions if necessary. You can explain the test in your reply but you don't have to mention some trivial details like test_key`;
          console.log("query_text", query_text);
          // const response = await send_openai_message(query_text);
        } else {
          let query_text = `${message} \n Add any tests or suggestions if necessary. You can explain the test in your reply but you don't have to mention some trivial details like test_key`;
          // const response = await send_openai_message(query_text);
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
  // {
  //   id: "1",
  //   title: "Circuit Validation Tests",
  //   description:
  //     "Basic validation tests for circuit components and connections",
  //   tests: [
  //     // {
  //     //   name: "Component Connection Test",
  //     //   description: "Verify all components are properly connected",
  //     // },
  //     // {
  //     //   name: "Power Supply Test",
  //     //   description: "Check power supply connections and voltage levels",
  //     // },
  //     // {
  //     //   name: "Signal Flow Test",
  //     //   description: "Validate signal paths through the circuit",
  //     // },
  //     {
  //       id: "so_demo_1",
  //       type: "self_observe",
  //       title: "When you press the button, what does the LED do?",
  //       description:
  //         "Press and release the button a few times and describe the LED behavior.",
  //       jsondata: { row: [10] },
  //       userObservation: "",
  //       completed: false,
  //     },
  //     {
  //       id: "mv_demo_1",
  //       type: "measure_voltage",
  //       title: "Measure voltage at row 15 using A0",
  //       description:
  //         "Rotate the potentiometer from end to end while measuring the voltage.",
  //       jsondata: { blinkboard_adc_row: "a0", measure_row: 15 },
  //       blinkboardADCRow: "a0",
  //       measureRow: 15,
  //       completed: false,
  //       voltageData: [],
  //     },
  //     {
  //       id: "sc_demo_1",
  //       type: "switch_connection_suggestion",
  //       title: "Switch connection suggestion",
  //       description:
  //         "The student mistakenly connected pin 10 to pin 11. You should switch the connection to pin 12.",
  //       jsondata: { row_from: "10", row_to: "gnd" },
  //       row_from: "10",
  //       row_to: "gnd",
  //       userObservation: "",
  //       completed: false,
  //     },
  //     {
  //       id: "hl_demo_1",
  //       type: "high_low_voltage",
  //       title: "High/Low Voltage Test",
  //       description: "Test the high/low voltage of the circuit.",
  //       jsondata: {
  //         blinkboard_digital_row: "D0",
  //         high_low_row: 1,
  //         high_low_pattern: [
  //           { voltage: "high", duration: 1000 },
  //           { voltage: "low", duration: 1000 },
  //           { voltage: "high", duration: 500 },
  //           { voltage: "low", duration: 500 },
  //           { voltage: "high", duration: 1000 },
  //         ],
  //       },
  //       completed: false,
  //     },
  //     {
  //       id: "av_demo_1",
  //       type: "analog_voltage",
  //       title: "Output 1.5V to row 1",
  //       description: "Output 1.5V to row 1",
  //       jsondata: { output_row: 1, output_voltage: 1.5 },
  //       completed: false,
  //     },
  //     {
  //       id: "nc_demo_1",
  //       type: "new_component_suggestion",
  //       title: "Add a resistor to the circuit",
  //       description: "Add a resistor to the circuit",
  //       jsondata: {
  //         component_name: "resistor",
  //         component_value: "1k",
  //         connections: [1, 26],
  //       },
  //       completed: false,
  //     },
  //   ],
  //   timestamp: Date.now(),
  // },
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
