const { spawn } = require("child_process");
const path = require("path");

// Test the Rust binary integration
console.log("Testing Rust binary integration...");

const rustBinaryPath = path.join(
  __dirname,
  "../parse-schematics/target/release/parse-schematics"
);
console.log("Rust binary path:", rustBinaryPath);

// Test with a simple XML input
const testXml = `<?xml version='1.0' encoding='UTF-8'?>
<netlist sketch="Untitled Sketch.fzz" date="Sun Aug 17 21:27:06 2025" xmlns="net">
 <net>
  <connector name="pin9W" id="pin9W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21W" id="pin21W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3W" id="pin3W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22W" id="pin22W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4W" id="pin4W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10W" id="pin10W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23W" id="pin23W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5W" id="pin5W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11W" id="pin11W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24W" id="pin24W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6W" id="pin6W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12W" id="pin12W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25W" id="pin25W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7W" id="pin7W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13W" id="pin13W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27W" id="pin27W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15W" id="pin15W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28W" id="pin28W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16W" id="pin16W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29W" id="pin29W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17W" id="pin17W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18W" id="pin18W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19W" id="pin19W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30W" id="pin30W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin31W" id="pin31W">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9Y" id="pin9Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="Pin 0" id="connector0">
   <part label="R3" title="10000Ω Resistor" id="854111620"/>
  </connector>
  <connector name="Pin 0" id="connector0">
   <part label="R2" title="10000Ω Resistor" id="854111320"/>
  </connector>
  <connector name="Pin 0" id="connector0">
   <part label="R4" title="10000Ω Resistor" id="854111800"/>
  </connector>
  <connector name="pin21Y" id="pin21Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3Y" id="pin3Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22Y" id="pin22Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4Y" id="pin4Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10Y" id="pin10Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23Y" id="pin23Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5Y" id="pin5Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11Y" id="pin11Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24Y" id="pin24Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6Y" id="pin6Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12Y" id="pin12Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25Y" id="pin25Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7Y" id="pin7Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13Y" id="pin13Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27Y" id="pin27Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15Y" id="pin15Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28Y" id="pin28Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16Y" id="pin16Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29Y" id="pin29Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17Y" id="pin17Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18Y" id="pin18Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19Y" id="pin19Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30Y" id="pin30Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin31Y" id="pin31Y">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="5V" id="connector87">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="pin7X" id="pin7X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21X" id="pin21X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3X" id="pin3X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22X" id="pin22X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4X" id="pin4X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10X" id="pin10X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23X" id="pin23X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5X" id="pin5X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11X" id="pin11X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24X" id="pin24X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6X" id="pin6X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12X" id="pin12X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25X" id="pin25X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13X" id="pin13X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27X" id="pin27X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9X" id="pin9X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15X" id="pin15X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28X" id="pin28X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16X" id="pin16X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29X" id="pin29X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17X" id="pin17X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18X" id="pin18X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19X" id="pin19X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30X" id="pin30X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin31X" id="pin31X">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7Z" id="pin7Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="P$1" id="connector0">
   <part label="R1" title="PHOTOCELL" id="854110680"/>
  </connector>
  <connector name="P$1" id="connector0">
   <part label="R6" title="PHOTOCELL" id="854112240"/>
  </connector>
  <connector name="P$1" id="connector0">
   <part label="R5" title="PHOTOCELL" id="854111940"/>
  </connector>
  <connector name="pin21Z" id="pin21Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3Z" id="pin3Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22Z" id="pin22Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4Z" id="pin4Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10Z" id="pin10Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23Z" id="pin23Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5Z" id="pin5Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11Z" id="pin11Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24Z" id="pin24Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6Z" id="pin6Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12Z" id="pin12Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25Z" id="pin25Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13Z" id="pin13Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27Z" id="pin27Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9Z" id="pin9Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15Z" id="pin15Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28Z" id="pin28Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16Z" id="pin16Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29Z" id="pin29Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17Z" id="pin17Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18Z" id="pin18Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19Z" id="pin19Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30Z" id="pin30Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin31Z" id="pin31Z">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1G" id="pin1G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1F" id="pin1F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1H" id="pin1H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1I" id="pin1I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1J" id="pin1J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="red anode" id="connector0">
   <part label="LED1" title="Red (633nm) LED" id="854108160"/>
  </connector>
  <connector name="GND" id="connector88">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
  <connector name="GND" id="connector57">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
  <connector name="GND" id="connector89">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="pin21C" id="pin21C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21A" id="pin21A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21B" id="pin21B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21D" id="pin21D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21E" id="pin21E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="P$2" id="connector1">
   <part label="R1" title="PHOTOCELL" id="854110680"/>
  </connector>
  <connector name="Pin 1" id="connector1">
   <part label="R2" title="10000Ω Resistor" id="854111320"/>
  </connector>
  <connector name="A2" id="connector2">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="pin17D" id="pin17D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17A" id="pin17A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17B" id="pin17B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17C" id="pin17C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17E" id="pin17E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="P$2" id="connector1">
   <part label="R5" title="PHOTOCELL" id="854111940"/>
  </connector>
  <connector name="Pin 1" id="connector1">
   <part label="R3" title="10000Ω Resistor" id="854111620"/>
  </connector>
  <connector name="A1" id="connector1">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="pin13C" id="pin13C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13A" id="pin13A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13B" id="pin13B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13D" id="pin13D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13E" id="pin13E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="P$2" id="connector1">
   <part label="R6" title="PHOTOCELL" id="854112240"/>
  </connector>
  <connector name="Pin 1" id="connector1">
   <part label="R4" title="10000Ω Resistor" id="854111800"/>
  </connector>
  <connector name="A0" id="connector0">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="pin2F" id="pin2F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin2G" id="pin2G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin2H" id="pin2H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin2I" id="pin2I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin2J" id="pin2J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="common cathode" id="connector1">
   <part label="LED1" title="Red (633nm) LED" id="854108160"/>
  </connector>
  <connector name="D6 PWM" id="connector67">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="pin3F" id="pin3F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3G" id="pin3G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3H" id="pin3H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3I" id="pin3I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3J" id="pin3J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="green anode" id="connector2">
   <part label="LED1" title="Red (633nm) LED" id="854108160"/>
  </connector>
  <connector name="D5 PWM" id="connector66">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="pin4F" id="pin4F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4G" id="pin4G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4H" id="pin4H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4I" id="pin4I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4J" id="pin4J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="blue anode" id="connector3">
   <part label="LED1" title="Red (633nm) LED" id="854108160"/>
  </connector>
  <connector name="D3 PWM" id="connector64">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="A3" id="connector3">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D7" id="connector68">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D4" id="connector65">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D2" id="connector63">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D1/TX" id="connector62">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D0/RX" id="connector61">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="3V3" id="connector86">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="A5/SCL" id="connector60">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
  <connector name="A5/SCL" id="connector5">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="RESET" id="connector85">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="ioref" id="connector84">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="A4/SDA" id="connector59">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
  <connector name="A4/SDA" id="connector4">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="AREF" id="connector58">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D13/SCK" id="connector56">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D12/MISO" id="connector55">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D11 PWM/MOSI" id="connector54">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D10 PWM/SS" id="connector53">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D9 PWM" id="connector52">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="D8" id="connector51">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="N/C" id="connector91">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="VIN" id="connector90">
   <part label="Part1" title="Arduino Uno (Rev3)" id="854108760"/>
  </connector>
 </net>
 <net>
  <connector name="pin1E" id="pin1E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1A" id="pin1A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1B" id="pin1B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1C" id="pin1C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin1D" id="pin1D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin30J" id="pin30J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30F" id="pin30F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30G" id="pin30G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30H" id="pin30H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30I" id="pin30I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin30E" id="pin30E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30A" id="pin30A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30B" id="pin30B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30C" id="pin30C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin30D" id="pin30D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin19J" id="pin19J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19F" id="pin19F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19G" id="pin19G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19H" id="pin19H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19I" id="pin19I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin19E" id="pin19E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19A" id="pin19A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19B" id="pin19B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19C" id="pin19C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin19D" id="pin19D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin18J" id="pin18J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18F" id="pin18F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18G" id="pin18G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18H" id="pin18H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18I" id="pin18I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin18E" id="pin18E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18A" id="pin18A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18B" id="pin18B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18C" id="pin18C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin18D" id="pin18D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin17J" id="pin17J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17F" id="pin17F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17G" id="pin17G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17H" id="pin17H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin17I" id="pin17I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin29J" id="pin29J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29F" id="pin29F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29G" id="pin29G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29H" id="pin29H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29I" id="pin29I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin29E" id="pin29E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29A" id="pin29A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29B" id="pin29B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29C" id="pin29C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin29D" id="pin29D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin16J" id="pin16J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16F" id="pin16F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16G" id="pin16G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16H" id="pin16H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16I" id="pin16I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin16E" id="pin16E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16A" id="pin16A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16B" id="pin16B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16C" id="pin16C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin16D" id="pin16D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin28J" id="pin28J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28F" id="pin28F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28G" id="pin28G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28H" id="pin28H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28I" id="pin28I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin28E" id="pin28E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28A" id="pin28A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28B" id="pin28B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28C" id="pin28C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin28D" id="pin28D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin15J" id="pin15J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15F" id="pin15F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15G" id="pin15G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15H" id="pin15H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15I" id="pin15I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin15E" id="pin15E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15A" id="pin15A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15B" id="pin15B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15C" id="pin15C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin15D" id="pin15D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin9J" id="pin9J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9F" id="pin9F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9G" id="pin9G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9H" id="pin9H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9I" id="pin9I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin9E" id="pin9E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9A" id="pin9A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9B" id="pin9B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9C" id="pin9C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin9D" id="pin9D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin27J" id="pin27J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27F" id="pin27F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27G" id="pin27G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27H" id="pin27H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27I" id="pin27I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin27E" id="pin27E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27A" id="pin27A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27B" id="pin27B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27C" id="pin27C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin27D" id="pin27D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin14J" id="pin14J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin14F" id="pin14F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin14G" id="pin14G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin14H" id="pin14H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin14I" id="pin14I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin14E" id="pin14E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin14A" id="pin14A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin14B" id="pin14B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin14C" id="pin14C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin14D" id="pin14D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin8J" id="pin8J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin8F" id="pin8F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin8G" id="pin8G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin8H" id="pin8H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin8I" id="pin8I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin8E" id="pin8E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin8A" id="pin8A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin8B" id="pin8B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin8C" id="pin8C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin8D" id="pin8D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin26J" id="pin26J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin26F" id="pin26F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin26G" id="pin26G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin26H" id="pin26H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin26I" id="pin26I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin26E" id="pin26E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin26A" id="pin26A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin26B" id="pin26B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin26C" id="pin26C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin26D" id="pin26D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin13J" id="pin13J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13F" id="pin13F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13G" id="pin13G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13H" id="pin13H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin13I" id="pin13I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin7J" id="pin7J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7F" id="pin7F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7G" id="pin7G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7H" id="pin7H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7I" id="pin7I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin7E" id="pin7E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7A" id="pin7A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7B" id="pin7B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7C" id="pin7C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin7D" id="pin7D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin25J" id="pin25J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25F" id="pin25F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25G" id="pin25G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25H" id="pin25H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25I" id="pin25I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin25E" id="pin25E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25A" id="pin25A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25B" id="pin25B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25C" id="pin25C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin25D" id="pin25D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin12J" id="pin12J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12F" id="pin12F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12G" id="pin12G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12H" id="pin12H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12I" id="pin12I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin12E" id="pin12E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12A" id="pin12A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12B" id="pin12B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12C" id="pin12C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin12D" id="pin12D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin6J" id="pin6J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6F" id="pin6F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6G" id="pin6G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6H" id="pin6H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6I" id="pin6I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin6E" id="pin6E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6A" id="pin6A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6B" id="pin6B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6C" id="pin6C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin6D" id="pin6D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin24J" id="pin24J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24F" id="pin24F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24G" id="pin24G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24H" id="pin24H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24I" id="pin24I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin24E" id="pin24E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24A" id="pin24A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24B" id="pin24B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24C" id="pin24C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin24D" id="pin24D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin11J" id="pin11J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11F" id="pin11F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11G" id="pin11G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11H" id="pin11H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11I" id="pin11I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin11E" id="pin11E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11A" id="pin11A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11B" id="pin11B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11C" id="pin11C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin11D" id="pin11D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin5J" id="pin5J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5F" id="pin5F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5G" id="pin5G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5H" id="pin5H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5I" id="pin5I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin5E" id="pin5E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5A" id="pin5A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5B" id="pin5B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5C" id="pin5C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin5D" id="pin5D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin23J" id="pin23J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23F" id="pin23F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23G" id="pin23G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23H" id="pin23H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23I" id="pin23I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin23E" id="pin23E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23A" id="pin23A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23B" id="pin23B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23C" id="pin23C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin23D" id="pin23D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin10J" id="pin10J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10F" id="pin10F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10G" id="pin10G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10H" id="pin10H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10I" id="pin10I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin10E" id="pin10E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10A" id="pin10A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10B" id="pin10B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10C" id="pin10C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin10D" id="pin10D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin4E" id="pin4E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4A" id="pin4A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4B" id="pin4B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4C" id="pin4C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin4D" id="pin4D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin22J" id="pin22J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22F" id="pin22F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22G" id="pin22G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22H" id="pin22H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22I" id="pin22I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin22E" id="pin22E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22A" id="pin22A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22B" id="pin22B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22C" id="pin22C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin22D" id="pin22D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin3E" id="pin3E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3A" id="pin3A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3B" id="pin3B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3C" id="pin3C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin3D" id="pin3D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin21J" id="pin21J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21F" id="pin21F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21G" id="pin21G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21H" id="pin21H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin21I" id="pin21I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin2E" id="pin2E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin2A" id="pin2A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin2B" id="pin2B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin2C" id="pin2C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin2D" id="pin2D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin20J" id="pin20J">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin20F" id="pin20F">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin20G" id="pin20G">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin20H" id="pin20H">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin20I" id="pin20I">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
 <net>
  <connector name="pin20E" id="pin20E">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin20A" id="pin20A">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin20B" id="pin20B">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin20C" id="pin20C">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
  <connector name="pin20D" id="pin20D">
   <part label="Breadboard2" title="Half breadboard" id="854108060"/>
  </connector>
 </net>
</netlist>
`;

console.log("Test XML:", testXml);

// Spawn the Rust process with XML as command line argument
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
  console.log(`Rust process exited with code ${code}`);
  if (code === 0) {
    console.log("✅ Success! YAML output:");
    console.log(yamlOutput);
  } else {
    console.log("❌ Failed! Error output:");
    console.log(errorOutput);
  }
});

rustProcess.on("error", (error) => {
  console.error("❌ Failed to start Rust process:", error);
});
