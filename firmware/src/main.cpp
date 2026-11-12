/**
 * ============================================================================
 * IEEE PES DIU SBC - EEE Fest 2026
 * HIGH-PERFORMANCE WIRE BUZZ GAME CONTROLLER
 * Target: ESP32-S3 N16R8 (Dual Core Xtensa LX7, 16MB Flash, 8MB PSRAM)
 * ============================================================================
 */

#include <Arduino.h>

// ======================== HARDWARE PIN DEFINITIONS ==========================
// Safe pins on ESP32-S3 (Avoiding GPIO 26-32 reserved for Octal Flash/PSRAM!)
static const uint8_t PIN_WIRE_TOUCH   = 4;   // Player Wand loop & Wire Track (Active LOW)
static const uint8_t PIN_START_PAD    = 5;   // Start line touch pad / gate (Active LOW)
static const uint8_t PIN_FINISH_PAD   = 6;   // Finish line touch pad / gate (Active LOW)
static const uint8_t PIN_BUZZER       = 7;   // Buzzer output (PWM or Digital High)
static const uint8_t PIN_STATUS_LED   = 8;   // Visual Game Status LED
static const uint8_t PIN_RGB_DATA     = 48;  // On-board WS2812 RGB LED (DevKitC-1)

// ======================= PWM CONFIGURATION FOR BUZZER ========================
static const uint8_t  BUZZER_PWM_CHANNEL   = 0;
static const uint32_t BUZZER_PWM_FREQ      = 2000;
static const uint8_t  BUZZER_PWM_RES       = 8;   // 8-bit resolution (0-255)
static const bool     USE_TONE_PWM         = true; // True for passive tone buzzer

// ============================= GAME STATE ENUM ===============================
enum GameState {
  STATE_IDLE = 0,
  STATE_COUNTDOWN,
  STATE_PLAYING,
  STATE_GAMEOVER,
  STATE_FINISHED
};

// ============================= GAME MODES ====================================
// Mode 1: Sudden Death (One touch = immediate Game Over & time recorded)
// Mode 2: Precision Multi-Touch (Counts touches + total time, computes score)
enum GameMode {
  MODE_SUDDEN_DEATH = 1,
  MODE_MULTI_TOUCH  = 2
};

// ========================== STATE VARIABLES ==================================
volatile GameState  currentState      = STATE_IDLE;
volatile GameMode   currentMode       = MODE_SUDDEN_DEATH;
volatile uint32_t   gameStartTime     = 0;
volatile uint32_t   gameEndTime       = 0;
volatile uint32_t   totalTouchCount   = 0;
volatile uint32_t   lastTouchTime     = 0;
volatile uint32_t   touchDebounceMs   = 40;  // High performance anti-chatter filter
volatile bool       isCurrentlyTouching = false;
volatile uint32_t   currentTouchStartMs = 0;
volatile uint32_t   totalTouchDurationMs = 0;

String currentPlayerName = "Guest";
String currentPlayerId   = "000-00-0000";

uint32_t lastHeartbeatTime = 0;
uint32_t buzzerOffTime     = 0;
bool     buzzerActive      = false;

// ========================= BUZZER HELPER FUNCTIONS ===========================
void buzzerTone(uint32_t freq, uint32_t durationMs = 0) {
  if (freq == 0) {
    ledcWriteTone(BUZZER_PWM_CHANNEL, 0);
    digitalWrite(PIN_BUZZER, LOW);
    buzzerActive = false;
    return;
  }
  
  ledcWriteTone(BUZZER_PWM_CHANNEL, freq);
  buzzerActive = true;
  if (durationMs > 0) {
    buzzerOffTime = millis() + durationMs;
  } else {
    buzzerOffTime = 0;
  }
}

void buzzerStop() {
  buzzerTone(0);
}

void playBuzzerPattern(const char* pattern) {
  if (strcmp(pattern, "FAIL") == 0) {
    // Funny descending game over buzz
    buzzerTone(350); delay(120);
    buzzerTone(280); delay(120);
    buzzerTone(200); delay(200);
    buzzerTone(130); delay(350);
    buzzerStop();
  } else if (strcmp(pattern, "WIN") == 0) {
    // Victorious fanfare
    buzzerTone(523); delay(100); // C5
    buzzerTone(659); delay(100); // E5
    buzzerTone(784); delay(100); // G5
    buzzerTone(1046); delay(300); // C6
    buzzerStop();
  } else if (strcmp(pattern, "START") == 0) {
    buzzerTone(880, 150);
  } else if (strcmp(pattern, "TICK") == 0) {
    buzzerTone(440, 80);
  }
}

// ======================== HARDWARE INTERRUPT HANDLERS =======================
void IRAM_ATTR onWireTouchISR() {
  // Ultra-fast ISR detection
  uint32_t now = millis();
  int pinVal = digitalRead(PIN_WIRE_TOUCH);

  if (pinVal == LOW) {
    // Touch closed (GND to Wand)
    if (!isCurrentlyTouching && (now - lastTouchTime >= touchDebounceMs)) {
      isCurrentlyTouching = true;
      lastTouchTime = now;
      currentTouchStartMs = now;
    }
  } else {
    // Touch released (Open circuit)
    if (isCurrentlyTouching) {
      isCurrentlyTouching = false;
      totalTouchDurationMs += (now - currentTouchStartMs);
    }
  }
}

// ============================ SERIAL PROTOCOL ================================
void sendJsonEvent(const String& event, const String& extraJson = "") {
  String out = "{\"event\":\"" + event + "\"";
  if (extraJson.length() > 0) {
    out += "," + extraJson;
  }
  out += "}";
  Serial.println(out);
}

void sendStatus() {
  uint32_t elapsed = (currentState == STATE_PLAYING) ? (millis() - gameStartTime) : (gameEndTime - gameStartTime);
  String extra = "\"state\":\"";
  switch (currentState) {
    case STATE_IDLE:      extra += "IDLE"; break;
    case STATE_COUNTDOWN: extra += "COUNTDOWN"; break;
    case STATE_PLAYING:   extra += "PLAYING"; break;
    case STATE_GAMEOVER:  extra += "GAMEOVER"; break;
    case STATE_FINISHED:  extra += "FINISHED"; break;
  }
  extra += "\",\"mode\":" + String((int)currentMode);
  extra += ",\"touches\":" + String(totalTouchCount);
  extra += ",\"elapsed_ms\":" + String(elapsed);
  extra += ",\"player\":\"" + currentPlayerName + "\"";
  sendJsonEvent("STATUS", extra);
}

// ============================ GAME LOGIC =====================================
void startGame(GameMode mode, const String& player = "Guest", const String& studentId = "") {
  currentMode = mode;
  currentPlayerName = player;
  currentPlayerId = studentId;
  totalTouchCount = 0;
  totalTouchDurationMs = 0;
  isCurrentlyTouching = false;
  gameStartTime = millis();
  gameEndTime = 0;
  currentState = STATE_PLAYING;
  digitalWrite(PIN_STATUS_LED, HIGH);

  playBuzzerPattern("START");

  String extra = "\"mode\":" + String((int)currentMode) +
                 ",\"player\":\"" + currentPlayerName + "\"" +
                 ",\"student_id\":\"" + currentPlayerId + "\"" +
                 ",\"time_ms\":0";
  sendJsonEvent("START", extra);
}

void triggerGameOver(const String& reason = "TOUCH") {
  if (currentState != STATE_PLAYING) return;
  gameEndTime = millis();
  currentState = STATE_GAMEOVER;
  digitalWrite(PIN_STATUS_LED, LOW);

  uint32_t elapsed = gameEndTime - gameStartTime;

  String extra = "\"mode\":" + String((int)currentMode) +
                 ",\"reason\":\"" + reason + "\"" +
                 ",\"touches\":" + String(totalTouchCount) +
                 ",\"time_ms\":" + String(elapsed) +
                 ",\"player\":\"" + currentPlayerName + "\"" +
                 ",\"student_id\":\"" + currentPlayerId + "\"";
  sendJsonEvent("GAMEOVER", extra);

  playBuzzerPattern("FAIL");
}

void triggerFinish() {
  if (currentState != STATE_PLAYING) return;
  gameEndTime = millis();
  currentState = STATE_FINISHED;
  digitalWrite(PIN_STATUS_LED, LOW);

  uint32_t elapsed = gameEndTime - gameStartTime;
  
  // Scoring algorithm for Mode 2:
  // Base 10,000 pts - (500 pts per touch) - (time_ms / 10)
  int32_t calculatedScore = 10000 - ((int32_t)totalTouchCount * 500) - ((int32_t)elapsed / 10);
  if (calculatedScore < 0) calculatedScore = 0;

  String extra = "\"mode\":" + String((int)currentMode) +
                 ",\"touches\":" + String(totalTouchCount) +
                 ",\"time_ms\":" + String(elapsed) +
                 ",\"score\":" + String(calculatedScore) +
                 ",\"player\":\"" + currentPlayerName + "\"" +
                 ",\"student_id\":\"" + currentPlayerId + "\"";
  sendJsonEvent("FINISH", extra);

  playBuzzerPattern("WIN");
}

void resetGame() {
  currentState = STATE_IDLE;
  totalTouchCount = 0;
  totalTouchDurationMs = 0;
  isCurrentlyTouching = false;
  gameStartTime = 0;
  gameEndTime = 0;
  buzzerStop();
  digitalWrite(PIN_STATUS_LED, LOW);
  sendJsonEvent("RESET", "\"state\":\"IDLE\"");
}

// ======================== COMMAND PARSER =====================================
void parseSerialCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd.equalsIgnoreCase("PING")) {
    sendJsonEvent("PONG", "\"uptime_ms\":" + String(millis()));
    return;
  }

  if (cmd.equalsIgnoreCase("STATUS")) {
    sendStatus();
    return;
  }

  if (cmd.equalsIgnoreCase("RESET")) {
    resetGame();
    return;
  }

  if (cmd.startsWith("SET_MODE")) {
    int m = cmd.substring(8).toInt();
    if (m == 1 || m == 2) {
      currentMode = (GameMode)m;
      sendJsonEvent("MODE_CHANGED", "\"mode\":" + String(m));
    }
    return;
  }

  if (cmd.startsWith("BUZZ")) {
    int dur = cmd.substring(4).toInt();
    if (dur <= 0) dur = 300;
    buzzerTone(2000, dur);
    sendJsonEvent("BUZZ_TEST", "\"duration_ms\":" + String(dur));
    return;
  }

  if (cmd.startsWith("START")) {
    // Format: START [mode] [name] [id]
    int modeNum = (int)currentMode;
    String pName = "Guest";
    String pId = "";

    int firstSpace = cmd.indexOf(' ');
    if (firstSpace > 0) {
      String rest = cmd.substring(firstSpace + 1);
      int secondSpace = rest.indexOf(' ');
      if (secondSpace > 0) {
        modeNum = rest.substring(0, secondSpace).toInt();
        if (modeNum != 1 && modeNum != 2) modeNum = 1;
        String playerPart = rest.substring(secondSpace + 1);
        int thirdSpace = playerPart.indexOf(' ');
        if (thirdSpace > 0) {
          pName = playerPart.substring(0, thirdSpace);
          pId = playerPart.substring(thirdSpace + 1);
        } else {
          pName = playerPart;
        }
      } else {
        int m = rest.toInt();
        if (m == 1 || m == 2) modeNum = m;
        else pName = rest;
      }
    }
    startGame((GameMode)modeNum, pName, pId);
    return;
  }

  if (cmd.equalsIgnoreCase("STOP")) {
    triggerGameOver("STOPPED_BY_ADMIN");
    return;
  }

  if (cmd.equalsIgnoreCase("FINISH")) {
    triggerFinish();
    return;
  }

  // JSON parsing fallback
  if (cmd.startsWith("{") && cmd.endsWith("}")) {
    if (cmd.indexOf("\"cmd\":\"START\"") >= 0 || cmd.indexOf("\"cmd\": \"START\"") >= 0) {
      GameMode m = currentMode;
      if (cmd.indexOf("\"mode\":1") >= 0) m = MODE_SUDDEN_DEATH;
      else if (cmd.indexOf("\"mode\":2") >= 0) m = MODE_MULTI_TOUCH;
      
      String p = "Guest";
      int pIdx = cmd.indexOf("\"player\":\"");
      if (pIdx >= 0) {
        int endP = cmd.indexOf("\"", pIdx + 10);
        if (endP > 0) p = cmd.substring(pIdx + 10, endP);
      }

      String id = "";
      int idIdx = cmd.indexOf("\"student_id\":\"");
      if (idIdx >= 0) {
        int endId = cmd.indexOf("\"", idIdx + 14);
        if (endId > 0) id = cmd.substring(idIdx + 14, endId);
      }
      startGame(m, p, id);
      return;
    }

    if (cmd.indexOf("\"cmd\":\"RESET\"") >= 0) {
      resetGame();
      return;
    }

    if (cmd.indexOf("\"cmd\":\"FINISH\"") >= 0) {
      triggerFinish();
      return;
    }

    if (cmd.indexOf("\"cmd\":\"STOP\"") >= 0) {
      triggerGameOver("STOPPED_BY_ADMIN");
      return;
    }

    if (cmd.indexOf("\"cmd\":\"SET_MODE\"") >= 0) {
      if (cmd.indexOf("\"mode\":1") >= 0) currentMode = MODE_SUDDEN_DEATH;
      else if (cmd.indexOf("\"mode\":2") >= 0) currentMode = MODE_MULTI_TOUCH;
      sendJsonEvent("MODE_CHANGED", "\"mode\":" + String((int)currentMode));
      return;
    }
  }
}

// ============================ ARDUINO SETUP ==================================
void setup() {
  Serial.begin(115200);
  
  // Wait briefly for serial initialization on ESP32-S3
  delay(500);

  // Configure Inputs with Internal Pull-Ups for active-low grounding
  pinMode(PIN_WIRE_TOUCH, INPUT_PULLUP);
  pinMode(PIN_START_PAD, INPUT_PULLUP);
  pinMode(PIN_FINISH_PAD, INPUT_PULLUP);

  // Configure Outputs
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Configure PWM Buzzer Channel
  ledcSetup(BUZZER_PWM_CHANNEL, BUZZER_PWM_FREQ, BUZZER_PWM_RES);
  ledcAttachPin(PIN_BUZZER, BUZZER_PWM_CHANNEL);
  buzzerStop();

  // Attach Interrupt for Touch Sensor (Both Falling and Rising for duration tracking)
  attachInterrupt(digitalPinToInterrupt(PIN_WIRE_TOUCH), onWireTouchISR, CHANGE);

  // Welcome Boot Sign-off
  String bootMsg = "\"device\":\"ESP32-S3-WIRE-BUZZ\","
                   "\"version\":\"2.0.0\","
                   "\"board\":\"ESP32-S3-N16R8\","
                   "\"org\":\"IEEE PES DIU SBC\","
                   "\"event_name\":\"EEE Fest 2026\","
                   "\"state\":\"READY\"";
  sendJsonEvent("READY", bootMsg);
}

// ============================ ARDUINO LOOP ===================================
void loop() {
  uint32_t now = millis();

  // 1. Process Incoming Serial Commands
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    parseSerialCommand(line);
  }

  // 2. Timed Buzzer Turn-off
  if (buzzerActive && buzzerOffTime > 0 && now >= buzzerOffTime) {
    buzzerStop();
  }

  // 3. Touch Handling during Active Game
  static bool lastTouchReportState = false;
  if (currentState == STATE_PLAYING) {
    // If hardware ISR detected touch
    if (isCurrentlyTouching) {
      if (!lastTouchReportState) {
        lastTouchReportState = true;
        totalTouchCount++;

        uint32_t elapsed = now - gameStartTime;

        // In Mode 1: Instant Sudden Death!
        if (currentMode == MODE_SUDDEN_DEATH) {
          triggerGameOver("TOUCH");
        } else {
          // Mode 2: Multi-Touch counter + momentary buzzer alert
          buzzerTone(2500, 150); // Sharp buzz
          String touchMsg = "\"count\":" + String(totalTouchCount) +
                            ",\"time_ms\":" + String(elapsed) +
                            ",\"mode\":2";
          sendJsonEvent("TOUCH", touchMsg);
        }
      }
    } else {
      lastTouchReportState = false;
    }

    // Check Finish Pad contact (Active LOW)
    if (digitalRead(PIN_FINISH_PAD) == LOW) {
      delay(20); // Quick debounce
      if (digitalRead(PIN_FINISH_PAD) == LOW) {
        triggerFinish();
      }
    }
  }

  // 4. Heartbeat Broadcast every 2000ms
  if (now - lastHeartbeatTime >= 2000) {
    lastHeartbeatTime = now;
    if (currentState == STATE_IDLE) {
      sendJsonEvent("HEARTBEAT", "\"status\":\"IDLE\",\"mode\":" + String((int)currentMode));
    } else if (currentState == STATE_PLAYING) {
      sendStatus();
    }
  }

  // Yield to RTOS watchdog
  delay(5);
}
