// Test with more realistic Fritzing XML structure
const testXml = `<netlist xmlns="http://fritzing.org/fritzing-0.9.3">
  <net name="Net1" id="net1">
    <connector id="pin1A" name="connector1">
      <part name="Breadboard" label="Breadboard" title="Breadboard"/>
    </connector>
    <connector id="pin2B" name="connector2">
      <part name="LED" label="LED" title="Light Emitting Diode"/>
    </connector>
  </net>
  <net name="Net2" id="net2">
    <connector id="pin3C" name="connector3">
      <part name="Resistor" label="220Ω" title="Resistor"/>
    </connector>
  </net>
</netlist>`;

console.log("Testing with realistic Fritzing XML:");
console.log(testXml);

// Test with the Rust binary
const { spawn } = require("child_process");
const path = require("path");

const rustBinaryPath = path.join(
  __dirname,
  "../parse-schematics/target/release/parse-schematics"
);
console.log("\nTesting with Rust binary:", rustBinaryPath);

const rustProcess = spawn(rustBinaryPath, [testXml]);

let yamlOutput = "";
let errorOutput = "";

rustProcess.stdout.on("data", (data) => {
  yamlOutput += data.toString();
  console.log("Rust stdout:", data.toString());
});

rustProcess.stderr.on("data", (data) => {
  errorOutput += data.toString();
  console.log("Rust stderr:", data.toString());
});

rustProcess.on("close", (code) => {
  console.log(`\nRust process exited with code ${code}`);
  if (code === 0) {
    console.log("✅ Success! YAML output:");
    console.log(yamlOutput);

    if (yamlOutput.trim()) {
      // Try to parse the YAML output
      try {
        const yaml = require("yaml");
        const schematics = yaml.parse(yamlOutput);
        console.log("✅ Parsed schematics:", schematics);
      } catch (parseError) {
        console.log("❌ Failed to parse YAML:", parseError.message);
      }
    } else {
      console.log("⚠️  No YAML output produced");
    }
  } else {
    console.log("❌ Failed! Error output:");
    console.log(errorOutput);
  }
});

rustProcess.on("error", (error) => {
  console.error("❌ Failed to start Rust process:", error);
});
