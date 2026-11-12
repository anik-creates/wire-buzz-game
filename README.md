# ⚡ Wire Buzz Arena • EEE Fest 2026
### Organized by IEEE PES DIU SBC & Department of EEE, Daffodil International University

An interactive, competition-grade Wire Buzz Game engineered for **ESP32-S3 N16R8** with an animated web presentation system, mobile QR queue management, dual game modes, and browser-direct Web Serial COM communication.

---

## 🌟 Live Web Application Links
* 🖥️ **Projector Presenter Screen:** `index.html` (Stage arena, live stopwatch, countdown, animated Red Game Over, victory confetti, intermission leaderboard)
* 📱 **Mobile Player Registration (QR Landing):** `register.html` (Follow IEEE PES DIU SBC Facebook page, enter student details, get queue ticket)
* 🛠️ **Admin Dashboard:** `admin.html` (On-the-spot mode switching, queue management, hardware COM port monitor, reports archive, CSV/JSON export)

---

## 🎮 Game Modes
1. **Mode 1: Sudden Death (One-Touch Knockout)**
   * One single touch to the wire line triggers an immediate Game Over alarm!
   * Records millisecond survival time.
   * Full-screen animated Red-Themed Alert with funny game over sound & TTS voice announcement.
2. **Mode 2: Touch Master (Precision Scoring)**
   * Tracks total touches + elapsed time.
   * High-performance 40ms hardware debouncing.
   * Computes final score: $\text{Score} = \max(0, 10000 - (\text{touches} \times 500) - \frac{\text{time}_{\text{ms}}}{10})$.

---

## 🔌 Hardware Setup (ESP32-S3 N16R8)
Detailed connection diagrams, resistor values, and filter capacitors are documented in [docs/CONNECTION_DIAGRAM.md](docs/CONNECTION_DIAGRAM.md).

* **GPIO 4:** Player Wand / Loop Handle (`INPUT_PULLUP` + 1kΩ protection + 100nF filter)
* **GND:** Stationary Wire Track (Grounded for maximum EMI noise immunity)
* **GPIO 6:** Finish Line Gate Pad
* **GPIO 7:** Buzzer Output (2N2222 NPN Transistor driver)
* **GPIO 8:** Status LED
* **USB (COM16):** CH343 High-Speed Serial at 115200 baud via Web Serial API

---

## 🚀 Flashing the ESP32-S3 with PlatformIO
The firmware is built using PlatformIO for Arduino ESP32.

```bash
cd firmware
pio run --target upload --upload-port COM16
```

---

## 📡 Web Serial API (Zero Drivers Needed!)
Open `index.html` or `admin.html` in **Google Chrome** or **Microsoft Edge**, click **Connect COM**, select **COM16** (USB-Enhanced-SERIAL CH343), and the site connects directly to the microcontroller with zero server or driver installations!
