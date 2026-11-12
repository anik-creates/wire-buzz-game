# ESP32-S3 Direct-Wire Connection Diagram & Setup Guide
### EEE Fest 2026 • Organized by IEEE PES DIU SBC

## 1. Direct-Wire Philosophy (Zero Extra Components)
This setup requires **NO external resistors and NO capacitors** — **ONLY RAW WIRES**:
* The ESP32-S3's internal pull-up resistors (`INPUT_PULLUP`) maintain a steady 3.3V HIGH state when wires are in mid-air.
* The **Player Wand** is connected directly to **GND** (safe 0V moving contact).
* When the grounded wand touches the bent wire track (**GPIO 4**) or the finish line contact (**GPIO 6**), it immediately pulls that pin to **GND (LOW)**, triggering ultra-low latency hardware events.

---

## 2. Pinout & Direct-Wire Table

| Wire Line | Physical Connection | ESP32-S3 Pin | Firmware Configuration | Logic Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Player Wand / Ring** | Direct wire from handheld ring held by player | **GND** | Direct Ground Contact | 0V Ground Plane |
| **Bent Wire Track (Maze)** | Direct wire from stationary bent wire track | **GPIO 4** | `pinMode(4, INPUT_PULLUP)` | Touch = Drops to LOW |
| **Finish Line Contact** | Direct wire from finish ring / pad at end of maze | **GPIO 6** | `pinMode(6, INPUT_PULLUP)` | Touch = Drops to LOW |
| **Buzzer (+)** | Red wire of Active/Passive buzzer | **GPIO 7** | Digital Output / PWM Tone | 2400Hz Audible Alerts |
| **Buzzer (-)** | Black wire of buzzer | **GND** | Common Ground | Common Ground |
| **USB Data Cable** | High-speed USB-C to Laptop USB Port | **COM16** | 115200 Baud Web Serial | Realtime Game Controller |

> [!CAUTION]
> **OCTAL PSRAM/FLASH SAFETY ON N16R8:**  
> On ESP32-S3 N16R8, **GPIO 26 through GPIO 32** are internally connected to high-speed Octal memory. Never touch or connect wires to GPIO 26–32! GPIO 4, 6, 7, and 8 are completely safe.

---

## 3. Direct-Wire ASCII Wiring Diagram

```
================================================================================
          ESP32-S3 N16R8 DIRECT-WIRE BUZZ GAME (NO RESISTOR, NO CAPACITOR)
================================================================================

   [ Player Wand (Handheld Ring) ] ---------------> ESP32 GND (Safe 0V Contact)
                                                        |
   [ Bent Wire Track (Stationary Maze) ] ---------> ESP32 GPIO 4 (INPUT_PULLUP)
                                                        |
   [ Finish Line Contact (End of Maze) ] ---------> ESP32 GPIO 6 (INPUT_PULLUP)
                                                        |
   [ Buzzer (+) Pin ] ----------------------------> ESP32 GPIO 7 (Output)
                                                        |
   [ Buzzer (-) Pin ] ----------------------------> ESP32 GND
================================================================================
```

---

## 4. Hardware Verification & Live Diagnostics
The firmware provides instant feedback during both idle and active match states:
1. **Pre-Game Sensor Testing (in IDLE):**
   - Touching the wand to the **Bent Wire Track (GPIO 4)** gives a short 80ms chirp on the buzzer and sends `{"event":"TOUCH_TEST","state":"TRACK_CONTACT_OK"}` to the screen.
   - Touching the wand to the **Finish Line (GPIO 6)** gives a 120ms beep on the buzzer and sends `{"event":"FINISH_TEST","state":"FINISH_CONTACT_OK"}` to the screen.
   - This lets you test the wires before starting any contestant's run.
2. **Active Match Play (Started via Spacebar):**
   - **Mode 1 (Sudden Death):** The first contact with GPIO 4 immediately stops the clock, fires the Red Themed Game Over screen play, and sounds the fail alert.
   - **Mode 2 (Touch Master):** Each touch to GPIO 4 increments the touch counter, pulses the buzzer, and updates the precision score.
   - **Finish Line Contact (GPIO 6):** Touching GPIO 6 immediately concludes the run, triggers the **Victory Confetti & Clapping Celebration**, calculates final score, and launches the intermission leaderboard!
