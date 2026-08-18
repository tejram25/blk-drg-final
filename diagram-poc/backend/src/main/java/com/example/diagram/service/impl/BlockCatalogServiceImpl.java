package com.example.diagram.service.impl;

import com.example.diagram.service.BlockCatalogService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * The block catalog that feeds the Angular palette.
 * Hardcoded for the POC; move to a table later so the palette can be managed
 * without redeploying (the {@link BlockCatalogService} interface keeps callers
 * insulated from that change).
 */
@Service
public class BlockCatalogServiceImpl implements BlockCatalogService {

    @Override
    public List<Map<String, String>> blockTypes() {
        return List.of(
                Map.of("key", "processor",  "label", "Main Processor",   "color", "#1d4ed8", "category", "Blocks", "icon", "developer_board"),
                Map.of("key", "ai",         "label", "AI Models",        "color", "#3730a3", "category", "Blocks", "icon", "psychology"),
                Map.of("key", "memory",     "label", "Memory",           "color", "#0e7490", "category", "Blocks", "icon", "memory"),
                Map.of("key", "sensor",     "label", "Sensor",           "color", "#15803d", "category", "Blocks", "icon", "sensors"),
                Map.of("key", "camera",     "label", "Camera",           "color", "#166534", "category", "Blocks", "icon", "photo_camera"),
                Map.of("key", "motor",      "label", "BLDC Motor Ctrl",  "color", "#b45309", "category", "Blocks", "icon", "rotate_right"),
                Map.of("key", "battery",    "label", "Battery / BMS",    "color", "#a16207", "category", "Blocks", "icon", "battery_charging_full"),
                Map.of("key", "dcdc",       "label", "DC/DC Converter",  "color", "#c2410c", "category", "Blocks", "icon", "electrical_services"),
                Map.of("key", "comms",      "label", "Comm Module",      "color", "#6d28d9", "category", "Blocks", "icon", "wifi"),
                Map.of("key", "antenna",    "label", "Antenna",          "color", "#7c3aed", "category", "Blocks", "icon", "cell_tower"),
                Map.of("key", "rectangle",     "label", "Rectangle",     "color", "#ffffff", "category", "Shapes", "shape", "basic-rectangle"),
                Map.of("key", "square",        "label", "Square",        "color", "#ffffff", "category", "Shapes", "shape", "basic-square"),
                Map.of("key", "rounded",       "label", "Rounded",       "color", "#ffffff", "category", "Shapes", "shape", "basic-rounded"),
                Map.of("key", "circle",        "label", "Circle",        "color", "#ffffff", "category", "Shapes", "shape", "basic-circle"),
                Map.of("key", "ellipse",       "label", "Ellipse",       "color", "#ffffff", "category", "Shapes", "shape", "basic-ellipse"),
                Map.of("key", "diamond",       "label", "Diamond",       "color", "#ffffff", "category", "Shapes", "shape", "basic-diamond"),
                Map.of("key", "triangle",      "label", "Triangle",      "color", "#ffffff", "category", "Shapes", "shape", "basic-triangle"),
                Map.of("key", "parallelogram", "label", "Parallelogram", "color", "#ffffff", "category", "Shapes", "shape", "basic-parallelogram"),
                Map.of("key", "cylinder",      "label", "Database",      "color", "#ffffff", "category", "Shapes", "shape", "basic-cylinder"),
                Map.of("key", "hexagon",       "label", "Hexagon",       "color", "#ffffff", "category", "Shapes", "shape", "basic-hexagon"),
                Map.of("key", "process",       "label", "Process",       "color", "#ffffff", "category", "Shapes", "shape", "basic-process"),
                Map.of("key", "step",          "label", "Step",          "color", "#ffffff", "category", "Shapes", "shape", "basic-step"),
                Map.of("key", "trapezoid",     "label", "Trapezoid",     "color", "#ffffff", "category", "Shapes", "shape", "basic-trapezoid"),
                Map.of("key", "document",      "label", "Document",      "color", "#ffffff", "category", "Shapes", "shape", "basic-document"),
                Map.of("key", "note",          "label", "Note",          "color", "#ffffff", "category", "Shapes", "shape", "basic-note"),
                Map.of("key", "cloud",         "label", "Cloud",         "color", "#ffffff", "category", "Shapes", "shape", "basic-cloud"),
                Map.of("key", "callout",       "label", "Callout",       "color", "#ffffff", "category", "Shapes", "shape", "basic-callout"),
                Map.of("key", "actor",         "label", "Actor",         "color", "#ffffff", "category", "Shapes", "shape", "basic-actor"),
                Map.of("key", "text",          "label", "Text",          "color", "#ffffff", "category", "Shapes", "shape", "basic-text"),
                Map.of("key", "resistor",   "label", "Resistor",         "color", "#e2e8f0", "category", "Electrical", "shape", "elec-resistor"),
                Map.of("key", "capacitor",  "label", "Capacitor",        "color", "#e2e8f0", "category", "Electrical", "shape", "elec-capacitor"),
                Map.of("key", "inductor",   "label", "Inductor",         "color", "#e2e8f0", "category", "Electrical", "shape", "elec-inductor"),
                Map.of("key", "diode",      "label", "Diode",            "color", "#e2e8f0", "category", "Electrical", "shape", "elec-diode"),
                Map.of("key", "led",        "label", "LED",              "color", "#e2e8f0", "category", "Electrical", "shape", "elec-led"),
                Map.of("key", "npn",        "label", "NPN Transistor",   "color", "#e2e8f0", "category", "Electrical", "shape", "elec-npn"),
                Map.of("key", "ground",     "label", "Ground",           "color", "#e2e8f0", "category", "Electrical", "shape", "elec-ground"),
                Map.of("key", "vdc",        "label", "DC Source",        "color", "#e2e8f0", "category", "Electrical", "shape", "elec-vdc"),
                Map.of("key", "vac",        "label", "AC Source",        "color", "#e2e8f0", "category", "Electrical", "shape", "elec-vac"),
                Map.of("key", "switch",     "label", "Switch",           "color", "#e2e8f0", "category", "Electrical", "shape", "elec-switch"),
                Map.of("key", "fuse",       "label", "Fuse",             "color", "#e2e8f0", "category", "Electrical", "shape", "elec-fuse"),
                Map.of("key", "pnp",        "label", "PNP Transistor",   "color", "#e2e8f0", "category", "Electrical", "shape", "elec-pnp"),
                Map.of("key", "nmos",       "label", "N-MOSFET",         "color", "#e2e8f0", "category", "Electrical", "shape", "elec-nmos"),
                Map.of("key", "zener",      "label", "Zener Diode",      "color", "#e2e8f0", "category", "Electrical", "shape", "elec-zener"),
                Map.of("key", "pot",        "label", "Potentiometer",    "color", "#e2e8f0", "category", "Electrical", "shape", "elec-pot"),
                Map.of("key", "cap-pol",    "label", "Polarized Cap",    "color", "#e2e8f0", "category", "Electrical", "shape", "elec-cap-pol"),
                Map.of("key", "cell",       "label", "Battery Cell",     "color", "#e2e8f0", "category", "Electrical", "shape", "elec-cell"),
                Map.of("key", "opamp",      "label", "Op-Amp",           "color", "#e2e8f0", "category", "Electrical", "shape", "elec-opamp"),
                Map.of("key", "crystal",    "label", "Crystal",          "color", "#e2e8f0", "category", "Electrical", "shape", "elec-crystal"),
                Map.of("key", "pushbutton", "label", "Push Button",      "color", "#e2e8f0", "category", "Electrical", "shape", "elec-pushbutton"),
                Map.of("key", "lamp",       "label", "Lamp",             "color", "#e2e8f0", "category", "Electrical", "shape", "elec-lamp"),
                Map.of("key", "ammeter",    "label", "Ammeter",          "color", "#e2e8f0", "category", "Electrical", "shape", "elec-ammeter"),
                Map.of("key", "voltmeter",  "label", "Voltmeter",        "color", "#e2e8f0", "category", "Electrical", "shape", "elec-voltmeter"),
                Map.of("key", "motor-sym",  "label", "DC Motor",         "color", "#e2e8f0", "category", "Electrical", "shape", "elec-motor"),
                Map.of("key", "ic555",      "label", "555 Timer IC",     "color", "#e2e8f0", "category", "Electrical", "shape", "elec-ic555"),
                Map.of("key", "lm741",      "label", "LM741 Op-Amp",     "color", "#e2e8f0", "category", "Electrical", "shape", "elec-lm741"),
                Map.of("key", "reg7805",    "label", "7805 Regulator",   "color", "#e2e8f0", "category", "Electrical", "shape", "elec-7805"),
                Map.of("key", "lm317",      "label", "LM317 Regulator",  "color", "#e2e8f0", "category", "Electrical", "shape", "elec-lm317"),
                Map.of("key", "nand7400",   "label", "7400 NAND",        "color", "#e2e8f0", "category", "Electrical", "shape", "elec-7400"),
                Map.of("key", "inv7404",    "label", "7404 Inverter",    "color", "#e2e8f0", "category", "Electrical", "shape", "elec-7404"),
                Map.of("key", "sr74hc595",  "label", "74HC595 Shift Reg","color", "#e2e8f0", "category", "Electrical", "shape", "elec-74hc595"),
                Map.of("key", "l293d",      "label", "L293D Motor Drv",  "color", "#e2e8f0", "category", "Electrical", "shape", "elec-l293d"),
                Map.of("key", "pc817",      "label", "PC817 Optocoupler","color", "#e2e8f0", "category", "Electrical", "shape", "elec-pc817"),
                Map.of("key", "mcu",        "label", "ATmega328 MCU",    "color", "#e2e8f0", "category", "Electrical", "shape", "elec-mcu"),
                Map.of("key", "esp32",      "label", "ESP32 Module",     "color", "#e2e8f0", "category", "Electrical", "shape", "elec-esp32"),
                Map.of("key", "robot-arm",  "label", "Robotic Arm",      "color", "#e2e8f0", "category", "Animated", "shape", "anim-robot-arm"),
                Map.of("key", "siren",      "label", "Siren Light",      "color", "#e2e8f0", "category", "Animated", "shape", "anim-siren"),
                Map.of("key", "fan",        "label", "Fan",              "color", "#e2e8f0", "category", "Animated", "shape", "anim-fan"),
                Map.of("key", "conveyor",   "label", "Conveyor",         "color", "#e2e8f0", "category", "Animated", "shape", "anim-conveyor"),
                Map.of("key", "gear",       "label", "Gear Motor",       "color", "#e2e8f0", "category", "Animated", "shape", "anim-gear"),
                Map.of("key", "antenna-t",  "label", "Antenna Tower",    "color", "#e2e8f0", "category", "Animated", "shape", "anim-antenna"),
                Map.of("key", "pump",       "label", "Pump",             "color", "#e2e8f0", "category", "Animated", "shape", "anim-pump"),
                Map.of("key", "stack-light","label", "Stack Light",      "color", "#e2e8f0", "category", "Animated", "shape", "anim-stack-light"),
                Map.of("key", "piston",     "label", "Piston",           "color", "#e2e8f0", "category", "Animated", "shape", "anim-piston"),
                Map.of("key", "tank",       "label", "Liquid Tank",      "color", "#e2e8f0", "category", "Animated", "shape", "anim-tank"),
                Map.of("key", "drone",      "label", "Drone",            "color", "#e2e8f0", "category", "Animated", "shape", "anim-drone"),
                Map.of("key", "glow-battery", "label", "Battery (Charging)", "color", "#e2e8f0", "category", "Animated", "shape", "anim-glow-battery"),
                Map.of("key", "inverter",   "label", "Inverter",         "color", "#e2e8f0", "category", "Animated", "shape", "anim-inverter"),
                Map.of("key", "transformer","label", "Transformer",      "color", "#e2e8f0", "category", "Animated", "shape", "anim-transformer"),
                Map.of("key", "solar",      "label", "Solar Panel",      "color", "#e2e8f0", "category", "Animated", "shape", "anim-solar"),
                Map.of("key", "wind-turbine","label", "Wind Turbine",    "color", "#e2e8f0", "category", "Animated", "shape", "anim-wind-turbine"),
                Map.of("key", "generator",  "label", "Generator",        "color", "#e2e8f0", "category", "Animated", "shape", "anim-generator"),
                Map.of("key", "ev-charger", "label", "EV Charger",       "color", "#e2e8f0", "category", "Animated", "shape", "anim-ev-charger"),
                Map.of("key", "pylon",      "label", "Power Pylon",      "color", "#e2e8f0", "category", "Animated", "shape", "anim-pylon"),
                Map.of("key", "relay",      "label", "Relay",            "color", "#e2e8f0", "category", "Animated", "shape", "anim-relay"),
                Map.of("key", "heater",     "label", "Heater",           "color", "#e2e8f0", "category", "Animated", "shape", "anim-heater"),
                Map.of("key", "bulb",       "label", "Bulb",             "color", "#e2e8f0", "category", "Animated", "shape", "anim-bulb")
        );
    }
}
