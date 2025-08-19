// Test the namespace addition logic
const testXml = `<netlist>
  <net>
    <connector id="pin1A">
      <part name="test" label="Breadboard" title="Test Part"/>
    </connector>
  </net>
</netlist>`;

console.log("Original XML:");
console.log(testXml);

// Add Fritzing namespace if it's missing
let processedXml = testXml;
if (!testXml.includes("xmlns=")) {
  // Find the root element and add xmlns attribute
  const rootMatch = testXml.match(/<(\w+)/);
  if (rootMatch) {
    const rootTag = rootMatch[1];
    const xmlnsAttr = `xmlns="http://fritzing.org/fritzing-0.9.3"`;
    processedXml = testXml.replace(`<${rootTag}`, `<${rootTag} ${xmlnsAttr}`);
    console.log("\n✅ Added Fritzing namespace to XML");
  }
}

console.log("\nProcessed XML:");
console.log(processedXml);

// Test with the Rust binary
const { spawn } = require("child_process");
const path = require("path");

const rustBinaryPath = path.join(
  __dirname,
  "../parse-schematics/target/release/parse-schematics"
);
console.log("\nTesting with Rust binary:", rustBinaryPath);

const rustProcess = spawn(rustBinaryPath, [processedXml]);

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

    // Try to parse the YAML output
    try {
      const yaml = require("yaml");
      const schematics = yaml.parse(yamlOutput);
      console.log("✅ Parsed schematics:", schematics);
    } catch (parseError) {
      console.log("❌ Failed to parse YAML:", parseError.message);
    }
  } else {
    console.log("❌ Failed! Error output:");
    console.log(errorOutput);
  }
});

rustProcess.on("error", (error) => {
  console.error("❌ Failed to start Rust process:", error);
});
