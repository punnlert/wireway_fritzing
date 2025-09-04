#![allow(dead_code)]

use clap::Parser;
use minidom::*;
use std::{
    collections::HashSet,
    fmt::Display,
    fs::{self, File},
    hash::Hash,
    io::Write,
    path::PathBuf,
};

use serde::Serialize;

use regex::Regex;

// Removed write_base module reference

#[derive(Debug, Parser)]
struct XMLParser {
    // if yaml is true, the output will be in yaml format
    #[arg(short, long, default_value_t = false)]
    yaml: bool,

    // the xml string to parse
    #[arg(short, long)]
    xml: String,
}

#[derive(Clone, Hash, Eq, PartialEq, Debug, Serialize)]
struct Pin {
    row: usize,
    // parts: Vec<Part>,
}

#[derive(Clone, Hash, Eq, PartialEq, Debug, Serialize)]
struct Part {
    name: String,
    label: String,
    title: String,
    id: usize,
}

#[derive(Clone, Hash, Eq, PartialEq, Debug, Serialize)]
struct Netlist {
    last_id: usize,
    nets: Vec<Net>,
}

#[derive(Clone, Hash, Eq, PartialEq, Debug, Serialize)]
struct Net {
    row_connection_id: usize,
    is_ground: bool,
    is_power: bool,
    rows: Vec<Pin>,
}

impl Net {
    fn new(row_connection_id: usize) -> Self {
        Self { row_connection_id, is_ground: false, is_power: false, rows: Vec::new() }
    }

    fn add_rows(&mut self, rows: &Vec<Pin>) {
        self.rows.extend(rows.clone());
    }

    fn set_ground(&mut self) {
        self.is_ground = true;
    }

    fn set_power(&mut self) {
        self.is_power = true;
    }
}

impl Netlist {
    fn new() -> Self {
        Self {
            last_id: 0,
            nets: Vec::new(),
        }
    }

    fn add_net(&mut self, net: Net) {
        self.nets.push(net);
    }

    fn get_next_id(&mut self) -> usize {
        self.last_id += 1;
        self.last_id
    }
}

impl Pin {
    fn new(row: usize) -> Self {
        Self {
            row,
            // parts: Vec::new(),
        }
    }

    // fn add_parts(&mut self, parts: &HashSet<Part>) {
    //     self.parts.extend(parts.clone());
    // }
}

impl Part {
    fn new(name: String, label: String, title: String, id: usize) -> Self {
        Self {
            name,
            label,
            title,
            id,
        }
    }
}

impl Display for Pin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "pin {}", self.row)
    }
}

impl Display for Part {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "label: {}, title; {}", self.name, self.title,)
    }
}

fn generate_net_pin(element: &Element, netlist: &mut Netlist) {
    match element.name() {
        "netlist" => {
            element.children().for_each(|net| {
                generate_net_pin(&net, netlist);
            });
        }
        "net" => {
            let mut connected_pin: HashSet<Pin> = HashSet::new();
            let mut connected_part: HashSet<Part> = HashSet::new();
            let mut connected_to_ground = false;
            let mut connected_to_power = false;
            element.children().for_each(|connector| {
                connector.children().for_each(|part| {
                    let breadboard_regex = Regex::new(r"^Breadboard.*").unwrap();
                    let pin_regex = Regex::new(r"pin(?P<row>\d{1,2})(?P<col>[A-Z])").unwrap();

                    let connector_id = connector.attr("id").unwrap();

                    let Some(label) = part.attr("label") else {
                        return;
                    };
                    let Some(title) = part.attr("title") else {
                        return;
                    };

                    if breadboard_regex.is_match(label) {
                        let Some(caps) = pin_regex.captures(connector_id) else {
                            return;
                        };
                        let row: usize = caps["row"].parse().expect("expect number as row");
                        let col = &caps["col"];

                        match col {
                            "A" | "B" | "C" | "D" | "E" => {
                                let pin = Pin::new(row);
                                connected_pin.insert(pin);
                            }
                            "F" | "G" | "H" | "I" | "J" => {
                                let pin = Pin::new(row + 25);
                                connected_pin.insert(pin);
                            }
                            "W" | "Y" => {
                                connected_to_power = true;
                                let pin = Pin::new(51);
                                connected_pin.insert(pin);
                            }
                            "X" | "Z" => {
                                connected_to_ground = true;
                                let pin = Pin::new(52);
                                connected_pin.insert(pin);
                            }
                            _ => {
                                panic!("doesnt exist")
                            }
                        }
                    } else {
                        let connection_name = connector
                            .attr("name")
                            .expect("should have name for connector");

                        let part = Part::new(
                            connection_name.to_string(),
                            label.to_string(),
                            title.to_string(),
                            part.attr("id").expect("should have id").parse().expect("should be usize"),
                        );
                        connected_part.insert(part);
                    }
                });
            });

            if connected_part.is_empty() {
                return;
            }

            let rows_connections = connected_pin.iter().map(|pin| {
                let new_pin = pin.clone();
                // new_pin.add_parts(&connected_part);
                new_pin
            }).collect::<Vec<Pin>>();

            let mut net = Net::new(netlist.get_next_id());
            net.add_rows(&rows_connections);
            if connected_to_ground {
                net.set_ground();
            }
            if connected_to_power {
                net.set_power();
            }
            netlist.add_net(net);
        }
        "connector" => todo!(),
        "part" => todo!(),
        _ => panic!("unknown name"),
    }
}

fn get_extension_from_path(path: &PathBuf) -> Option<&str> {
    path.extension().and_then(|s| s.to_str())
}

fn parse_xml_string_to_yaml(xml_string: &String) {
    let root: Result<minidom::Element> = xml_string.parse();
    match root {
        Ok(xml_element) => {
            let mut netlist = Netlist::new();

            generate_net_pin(&xml_element, &mut netlist);

            let mut yaml = std::io::stdout();

            for pin in netlist.nets.iter() {
                let _unused = writeln!(
                    yaml,
                    "{}\n\n",
                    serde_yml::to_string(&pin).expect("can't parse some pin")
                );
            }

        }
        Err(xml_error) => {
            println!("{}", xml_error);
        }
    }
}

fn parse_xml_string_to_json(xml_string: &String) {
    let root: Result<minidom::Element> = xml_string.parse();
    match root {
        Ok(xml_element) => {
            let mut netlist = Netlist::new();

            generate_net_pin(&xml_element, &mut netlist);

            let mut json = std::io::stdout();

            writeln!(json, "{}", serde_json::to_string(&netlist).expect("can't parse some pin"));
        }
        Err(xml_error) => {
            println!("{}", xml_error);
        }
    }
}

fn main() {
    let cli = XMLParser::parse();

    let xml_string = cli.xml;

    if cli.yaml {
        parse_xml_string_to_yaml(&xml_string);
    } else {
        parse_xml_string_to_json(&xml_string);
    }

    // if let Ok(path_exists) = fs::exists(&path) {
    //     if path_exists {
    //         if let Ok(meta) = fs::metadata(&path) {
    //             if meta.is_file() && (get_extension_from_path(&path) == Some("xml")) {
    //                 let xml_string = fs::read_to_string(&path).unwrap_or("".to_string());
    //                 parse_xml_string(&xml_string, path.file_stem().unwrap().to_str().unwrap());
    //             } else {
    //                 panic!("not .xml file path")
    //             }
    //         }
    //     } else {
    //         panic!("path doesn't exist");
    //     }
    // } else {
    //     panic!("error reading directory");
    // }
}
