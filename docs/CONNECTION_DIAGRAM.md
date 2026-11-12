# ESP32-S3 N16R8 Wire Buzz Game - Hardware Connection Diagram & Engineering Guide

## 1. Overview & Board Specifications
* **Microcontroller:** ESP32-S3-WROOM-1 / DevKitC-1 (Dual-Core Xtensa LX7 @ 240 MHz)
* **Memory Architecture:** **N16R8** (16MB Octal SPI Flash, 8MB Octal PSRAM)
* **USB Interface:** CH343 High-Speed USB-to-UART bridge on **COM16** (115200 bps)
* **Host Interface:** Web Serial API (Direct browser-to-ESP32 communication via Google Chrome / Microsoft Edge)

---

## 2. Critical ESP32-S3 N16R8 Pinout Rules & Safety
> [!CAUTION]
> **FORBIDDEN PINS (GPIO 26 – GPIO 32):** On the **N16R8** module, GPIO 26 through GPIO 32 are internally connected to the high-speed **Octal Flash** and **Octal PSRAM** bus. **NEVER connect any external wires, sensors, or buzzers to GPIO 26-32**, or the ESP32-S3 will instantly suffer memory bus faults and kernel crash loops!

> [!IMPORTANT]
> **STRAPPING PINS TO AVOID FOR SENSORS:**
> * `GPIO 0`: Bootloader strapping pin (must not be pulled low on power-on).
> * `GPIO 45, 46`: VDD_SPI and ROM log strapping pins.
> * `GPIO 19, 20`: Native USB D- and D+.

### Recommended High-Performance Pin Mapping:
| Component | ESP32-S3 Pin | Mode | Voltage | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Player Wand (Loop Handle)** | **GPIO 4** | `INPUT_PULLUP` + Ext 10kΩ | 3.3V Logic | Connects to metal loop wand. Active LOW when contacting track |
| **Wire Buzz Track (Maze)** | **GND** | Ground Plane | 0V (Earth) | The stationary bent wire track is grounded for noise immunity |
| **Start Pad / Gate (Optional)** | **GPIO 5** | `INPUT_PULLUP` + Ext 10kΩ | 3.3V Logic | Resting pad at start of maze. Active LOW |
| **Finish Pad / Gate** | **GPIO 6** | `INPUT_PULLUP` + Ext 10kΩ | 3.3V Logic | Touch ring or contact cup at end of maze. Active LOW |
| **Buzzer Output** | **GPIO 7** | Output (LEDC PWM) | 3.3V / 5V | Drives NPN transistor (2N2222) for active or passive buzzer |
| **Status LED (Green/Red)** | **GPIO 8** | Digital Output | 3.3V | Visual indicator (ON = Game active, OFF = Idle/Over) |
| **Onboard RGB Neopixel** | **GPIO 48** | WS2812 Data | 3.3V | Onboard DevKitC-1 RGB indicator |

---

## 3. Best Performance Circuit Schematic

```
================================================================================
                    ESP32-S3 N16R8 WIRE BUZZ CIRCUIT DIAGRAM
================================================================================

                               +3.3V
                                 |
                                [10kΩ Pull-Up]
                                 |
 [Player Wand / Loop] -----+-----+-----[1kΩ Resistor]-----> ESP32 GPIO 4
                           |
                        [100nF] (0.1µF Ceramic Filter Capacitor)
                           |
                          GND
                           |
 [Bent Wire Track] --------+------------------------------> ESP32 GND


--------------------------------------------------------------------------------
                         BUZZER DRIVER CIRCUIT
--------------------------------------------------------------------------------

                         +5V (VIN)
                           |
                         +---+
                         | + |  Buzzer (Active or Passive)
                         | - |  [Flyback Diode 1N4148 / 1N4007 across +/-]
                         +---+
                           |
                           | Collector
                     +-----C
                     |       B (Base) <-----[1kΩ Resistor]----- ESP32 GPIO 7
      2N2222 / SS8050|
           NPN       +-----E (Emitter)
                           |
                          GND


--------------------------------------------------------------------------------
                         FINISH LINE GATE CIRCUIT
--------------------------------------------------------------------------------

                               +3.3V
                                 |
                                [10kΩ Pull-Up]
                                 |
 [Finish Contact Cup] -----+-----+-----[1kΩ Resistor]-----> ESP32 GPIO 6
                           |
                        [100nF]
                           |
                          GND
================================================================================
```

---

## 4. Why This Circuit Provides the Best Performance

1. **Stationary Wire Track Connected to GND (Not 3.3V!):**
   * Connecting the long, winding copper/brass track to **GND** shields the entire maze against 50Hz/60Hz AC ambient electromagnetic interference (EMI) from venue lighting, projector power cords, and nearby cellphones.
   * If the track were connected to 3.3V, it would act as a massive transmitting/receiving antenna, causing false triggers.

2. **1kΩ Series Resistor (ESD & Surge Protection):**
   * Metal-to-metal contact between the loop and track creates mechanical sparks and static electricity (ESD). The 1kΩ resistor limits inrush current into the ESP32 pin, preventing pin damage.

3. **100nF (0.1µF) Ceramic Capacitor (Hardware Low-Pass Debounce):**
   * Forms an RC filter ($RC = 1\text{k}\Omega \times 100\text{nF} = 100\mu\text{s}$) that shunts high-frequency mechanical vibration and micro-arcs directly to ground before they ever reach the CPU.

4. **Dual-Layer Software Debounce in Firmware:**
   * In `firmware/src/main.cpp`, a 40ms hysteresis window filters out contact chatter while tracking continuous contact duration.

5. **Transistor-Buffered Buzzer:**
   * Buzzers draw 30mA to 80mA, which exceeds the ESP32-S3 GPIO maximum rating (40mA absolute max, 20mA recommended). The 2N2222 NPN transistor protects the ESP32 and delivers maximum acoustic volume!

---

## 5. Bill of Materials (BOM)

| Item | Component | Specification | Quantity |
| :--- | :--- | :--- | :--- |
| 1 | Microcontroller | ESP32-S3 DevKitC-1 N16R8 | 1 |
| 2 | Resistors | 10kΩ 1/4W (Pull-ups) | 3 |
| 3 | Resistors | 1kΩ 1/4W (Protection & Base) | 3 |
| 4 | Capacitors | 100nF (0.1µF) 50V Ceramic | 2 |
| 5 | Transistor | 2N2222 or SS8050 NPN | 1 |
| 6 | Diode | 1N4148 or 1N4007 | 1 |
| 7 | Buzzer | 5V Active or Passive Buzzer | 1 |
| 8 | Maze Track | 2mm – 3mm Bare Copper / Brass Wire | ~1.5 meters |
| 9 | Wand Loop | 14 AWG Insulated Wire with 20mm Ring | 1 |
| 10 | USB Cable | USB-C to USB-A Data Cable | 1 |
