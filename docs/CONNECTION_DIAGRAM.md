# ESP32-S3 Direct-Wire Connection Diagram & Quick Setup Guide
### EEE Fest 2026 • IEEE PES DIU SBC

## 1. Direct-Wire Philosophy (Zero Extra Components)
This setup requires **NO external resistors and NO capacitors** — **ONLY RAW WIRES**:
* The ESP32-S3's internal pull-up resistors (`INPUT_PULLUP`) maintain a steady HIGH state when wires are in mid-air.
* When two wires touch, they immediately pull the pin to **GND (LOW)**, triggering ultra-low latency hardware events.

---

## 2. Pinout & Direct-Wire Table

| Wire Line | Physical Connection | ESP32-S3 Pin | Firmware Logic |
| :--- | :--- | :--- | :--- |
| **Bent Maze Wire** | Direct raw wire from stationary maze track | **GND** | Continuous ground plane |
| **Player Wand / Loop** | Direct raw wire from handheld loop ring | **GPIO 4** | `INPUT_PULLUP` (Touch = Active LOW) |
| **Finish Line Pad** | Direct raw wire from finish ring / cup | **GPIO 6** | `INPUT_PULLUP` (Touch = Active LOW) |
| **Buzzer (+)** | Red wire of Active/Passive buzzer | **GPIO 7** | Digital Output / PWM Tone |
| **Buzzer (-)** | Black wire of buzzer | **GND** | Common Ground |
| **USB Data Cable** | USB-C to Computer USB Port | **COM16** | 115200 Baud Web Serial |

> [!CAUTION]
> **OCTAL PSRAM/FLASH SAFETY ON N16R8:**  
> On ESP32-S3 N16R8, **GPIO 26 through GPIO 32** are internally connected to high-speed Octal memory. Never touch or connect wires to GPIO 26–32!

---

## 3. Direct-Wire ASCII Wiring Diagram

```
================================================================================
          ESP32-S3 N16R8 DIRECT-WIRE BUZZ GAME (NO RESISTOR, NO CAPACITOR)
================================================================================

   [ Player Wand (Loop) ] ---------------------------> GPIO 4 (Internal Pull-Up)
                                                           |
   [ Bent Wire Track (Maze) ] -----------------------> GND
                                                           |
   [ Finish Line Contact ] --------------------------> GPIO 6 (Internal Pull-Up)
                                                           |
   [ Buzzer (+) Pin ] -------------------------------> GPIO 7 (Output)
                                                           |
   [ Buzzer (-) Pin ] -------------------------------> GND

================================================================================
```

---

## 4. How the Direct-Wire System Works
1. **Idle State:**  
   The Wand loop is held in mid-air. GPIO 4 is held at 3.3V by the internal pull-up resistor.
2. **Contact / Scrape Detection:**  
   When the player's loop touches the bent wire, the circuit to GND completes. GPIO 4 drops to 0V (LOW).
   * **Mode 1 (Sudden Death):** The first touch immediately stops the timer, fires the Red Themed Game Over screen play, and triggers the sad trombone buzzer tone!
   * **Mode 2 (Touch Master):** Counts each distinct touch, pulses the buzzer on GPIO 7, updates live score, and keeps the timer running.
3. **Finish Line Detection:**  
   When the loop wand touches the finish gate contact on GPIO 6, GPIO 6 drops to LOW, instantly triggering the **Victory Confetti & Clapping Celebration**!
