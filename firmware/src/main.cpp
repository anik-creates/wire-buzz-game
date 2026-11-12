/**
 * ============================================================================
 * EEE Fest 2026 - Wire Buzz Game Controller (Direct Wire Mode)
 * Organized by IEEE PES DIU SBC
 * 
 * Hardware Wiring (NO Resistors, NO Capacitors - ONLY WIRES!):
 * - Player Wand/Loop : Connected directly to ESP32 GND (Moving ground contact)
 * - Bent Wire Track  : Connected directly to ESP32 GPIO 4 (Internal INPUT_PULLUP)
 * - Finish Line Pad  : Connected directly to ESP32 GPIO 6 (Internal INPUT_PULLUP)
 * - Buzzer           : Connected directly to ESP32 GPIO 7 (+) and GND (-)
 * - Status LED       : GPIO 8
 * ============================================================================
 */

#include <Arduino.h>

// Direct-wire pin definitions
static const uint8_t PIN_WIRE_TOUCH = 4;  // Bent Wire Track (INPUT_PULLUP, touched by grounded wand)
static const uint8_t PIN_FINISH_PAD = 6;  // Finish Line Contact (INPUT_PULLUP, touched by grounded wand)
static const uint8_t PIN_BUZZER     = 7;  // Buzzer Output (PWM or Active High)
static const uint8_t PIN_STATUS_LED = 8;  // Visual Game Status Indicator

// PWM configuration for Buzzer
static const uint8_t  BUZZER_PWM_CHANNEL = 0;
static const uint32_t BUZZER_PWM_FREQ    = 2400;
static const uint8_t  BUZZER_PWM_RES     = 8;

enum GameState {
  STATE_IDLE = 0,
  STATE_COUNTDOWN,
  STATE_PLAYING,
  STATE_GAMEOVER,
  STATE_FINISHED
};

enum GameMode {
  MODE_SUDDEN_DEATH = 1, // 1 touch = immediate Game Over
  MODE_MULTI_TOUCH  = 2  // Counts touches + time, generates score
};

volatile GameState currentState       = STATE_IDLE;
volatile GameMode  currentMode        = MODE_SUDDEN_DEATH;
volatile uint32_t  gameStartTime      = 0;
volatile uint32_t  gameEndTime        = 0;
volatile uint32_t  totalTouchCount    = 0;
volatile uint32_t  lastTouchDebounce  = 0;
volatile bool      isCurrentlyTouching = false;

String currentPlayerName = "Ready Player";
String currentPlayerId   = "231-15-0000";

uint32_t lastHeartbeatTime = 0;
uint32_t buzzerOffTime     = 0;
bool     buzzerActive      = false;

// Buzzer Controller (Supports both Active 3.3V/5V buzzers and Passive tone buzzers)
void buzzerOn(uint32_t freq = 2400, uint32_t durationMs = 0) {
  ledcWriteTone(BUZZER_PWM_CHANNEL, freq);
  digitalWrite(PIN_BUZZER, HIGH);
  buzzerActive = true;
  buzzerOffTime = (durationMs > 0) ? (millis() + durationMs) : 0;
}

void buzzerOff() {
  ledcWriteTone(BUZZER_PWM_CHANNEL, 0);
  digitalWrite(PIN_BUZZER, LOW);
  buzzerActive = false;
  buzzerOffTime = 0;
}

void playSfx(const char* sfx) {
  if (strcmp(sfx, "FAIL") == 0) {
    buzzerOn(320); delay(150);
    buzzerOn(250); delay(150);
    buzzerOn(180); delay(220);
    buzzerOn(120); delay(380);
    buzzerOff();
  } else if (strcmp(sfx, "WIN") == 0) {
    buzzerOn(523); delay(100);
    buzzerOn(659); delay(100);
    buzzerOn(784); delay(100);
    buzzerOn(1046); delay(350);
    buzzerOff();
  } else if (strcmp(sfx, "START") == 0) {
    buzzerOn(880, 180);
  } else if (strcmp(sfx, "TOUCH") == 0) {
    buzzerOn(2600, 150);
  }
}

// JSON Serial Output
void sendJson(const String& event, const String& extra = "") {
  String out = "{\"event\":\"" + event + "\"";
  if (extra.length() > 0) {
    out += "," + extra;
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
  sendJson("STATUS", extra);
}

void startGame(GameMode mode, const String& player = "Player", const String& studentId = "") {
  currentMode = mode;
  currentPlayerName = player;
  currentPlayerId = studentId;
  totalTouchCount = 0;
  isCurrentlyTouching = false;
  lastTouchDebounce = millis();
  gameStartTime = millis();
  gameEndTime = 0;
  currentState = STATE_PLAYING;
  digitalWrite(PIN_STATUS_LED, HIGH);

  playSfx("START");

  String extra = "\"mode\":" + String((int)currentMode) +
                 ",\"player\":\"" + currentPlayerName + "\"" +
                 ",\"student_id\":\"" + currentPlayerId + "\"" +
                 ",\"time_ms\":0";
  sendJson("START", extra);
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
  sendJson("GAMEOVER", extra);

  playSfx("FAIL");
}

void triggerFinish() {
  uint32_t elapsed = 0;
  if (currentState == STATE_PLAYING) {
    gameEndTime = millis();
    elapsed = gameEndTime - gameStartTime;
  } else {
    elapsed = 15000;
  }
  
  currentState = STATE_FINISHED;
  digitalWrite(PIN_STATUS_LED, LOW);

  int32_t score = 10000 - ((int32_t)totalTouchCount * 500) - ((int32_t)elapsed / 10);
  if (score < 0) score = 0;

  String extra = "\"mode\":" + String((int)currentMode) +
                 ",\"touches\":" + String(totalTouchCount) +
                 ",\"time_ms\":" + String(elapsed) +
                 ",\"score\":" + String(score) +
                 ",\"player\":\"" + currentPlayerName + "\"" +
                 ",\"student_id\":\"" + currentPlayerId + "\"";
  sendJson("FINISH", extra);

  playSfx("WIN");
}

void resetGame() {
  currentState = STATE_IDLE;
  totalTouchCount = 0;
  isCurrentlyTouching = false;
  gameStartTime = 0;
  gameEndTime = 0;
  buzzerOff();
  digitalWrite(PIN_STATUS_LED, LOW);
  sendJson("RESET", "\"state\":\"IDLE\"");
}

void parseSerialCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd.equalsIgnoreCase("PING")) {
    sendJson("PONG", "\"uptime_ms\":" + String(millis()));
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
      sendJson("MODE_CHANGED", "\"mode\":" + String(m));
    }
    return;
  }
  if (cmd.startsWith("BUZZ")) {
    int dur = cmd.substring(4).toInt();
    if (dur <= 0) dur = 250;
    buzzerOn(2400, dur);
    sendJson("BUZZ_TEST", "\"duration_ms\":" + String(dur));
    return;
  }
  if (cmd.startsWith("START")) {
    int modeNum = (int)currentMode;
    String pName = "Player";
    String pId = "";
    int s1 = cmd.indexOf(' ');
    if (s1 > 0) {
      String rest = cmd.substring(s1 + 1);
      int s2 = rest.indexOf(' ');
      if (s2 > 0) {
        modeNum = rest.substring(0, s2).toInt();
        if (modeNum != 1 && modeNum != 2) modeNum = 1;
        String playerPart = rest.substring(s2 + 1);
        int s3 = playerPart.indexOf(' ');
        if (s3 > 0) {
          pName = playerPart.substring(0, s3);
          pId = playerPart.substring(s3 + 1);
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

  // JSON commands
  if (cmd.startsWith("{") && cmd.endsWith("}")) {
    if (cmd.indexOf("\"cmd\":\"START\"") >= 0 || cmd.indexOf("\"cmd\": \"START\"") >= 0) {
      GameMode m = currentMode;
      if (cmd.indexOf("\"mode\":1") >= 0) m = MODE_SUDDEN_DEATH;
      else if (cmd.indexOf("\"mode\":2") >= 0) m = MODE_MULTI_TOUCH;
      String p = "Player";
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
    if (cmd.indexOf("\"cmd\":\"RESET\"") >= 0) { resetGame(); return; }
    if (cmd.indexOf("\"cmd\":\"FINISH\"") >= 0) { triggerFinish(); return; }
    if (cmd.indexOf("\"cmd\":\"STOP\"") >= 0) { triggerGameOver("STOPPED_BY_ADMIN"); return; }
    if (cmd.indexOf("\"cmd\":\"SET_MODE\"") >= 0) {
      if (cmd.indexOf("\"mode\":1") >= 0) currentMode = MODE_SUDDEN_DEATH;
      else if (cmd.indexOf("\"mode\":2") >= 0) currentMode = MODE_MULTI_TOUCH;
      sendJson("MODE_CHANGED", "\"mode\":" + String((int)currentMode));
      return;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(400);

  // Direct Wire Setup:
  // Wand is GND (held by player).
  // Wire track is GPIO 4 (INPUT_PULLUP).
  // Finish line is GPIO 6 (INPUT_PULLUP).
  pinMode(PIN_WIRE_TOUCH, INPUT_PULLUP);
  pinMode(PIN_FINISH_PAD, INPUT_PULLUP);

  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Initialize Buzzer PWM
  ledcSetup(BUZZER_PWM_CHANNEL, BUZZER_PWM_FREQ, BUZZER_PWM_RES);
  ledcAttachPin(PIN_BUZZER, BUZZER_PWM_CHANNEL);
  buzzerOff();

  // Boot announcement
  sendJson("READY", "\"device\":\"ESP32-S3-WIRE-BUZZ\",\"wand\":\"GND\",\"track\":4,\"finish\":6,\"buzzer\":7");
}

void loop() {
  uint32_t now = millis();

  // 1. Process Incoming Serial Commands
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    parseSerialCommand(line);
  }

  // 2. Timed Buzzer Turn-Off
  if (buzzerActive && buzzerOffTime > 0 && now >= buzzerOffTime) {
    buzzerOff();
  }

  // 3. Finish Line Detection on GPIO 6 (Active-Low: Touched by GND Wand)
  // Finish line ALWAYS takes absolute priority over wire touches!
  static uint32_t lastFinishTriggerTime = 0;
  bool isFinishActive = (digitalRead(PIN_FINISH_PAD) == LOW);

  if (isFinishActive) {
    if (now - lastFinishTriggerTime >= 200) {
      lastFinishTriggerTime = now;
      if (currentState == STATE_PLAYING) {
        triggerFinish();
      } else {
        // Immediate auditory & serial confirmation for sensor testing in IDLE
        buzzerOn(2800, 160);
        sendJson("FINISH_TEST", "\"state\":\"FINISH_CONTACT_OK\",\"pin\":6");
      }
    }
    // Finish line reached! NEVER trigger wire touch or Game Over when finish is contacted!
    return;
  }

  // 4. Wire Touch Detection on GPIO 4 (Active-Low: Touched by GND Wand)
  static uint32_t lastTrackTestTime = 0;
  if (digitalRead(PIN_WIRE_TOUCH) == LOW) {
    if (currentState == STATE_PLAYING) {
      if (!isCurrentlyTouching && (now - lastTouchDebounce >= 20)) {
        isCurrentlyTouching = true;
        lastTouchDebounce = now;
        totalTouchCount++;

        uint32_t elapsed = now - gameStartTime;

        if (currentMode == MODE_SUDDEN_DEATH) {
          triggerGameOver("TOUCH");
        } else {
          // Mode 2: Multi-Touch pulse alert
          buzzerOn(2400, 150);
          sendJson("TOUCH", "\"count\":" + String(totalTouchCount) + ",\"time_ms\":" + String(elapsed) + ",\"mode\":2");
        }
      }
    } else {
      // In IDLE: immediate auditory & serial confirmation that track wire works
      if (now - lastTrackTestTime >= 250) {
        lastTrackTestTime = now;
        buzzerOn(1800, 80);
        sendJson("TOUCH_TEST", "\"state\":\"TRACK_CONTACT_OK\",\"pin\":4");
      }
    }
  } else {
    if (isCurrentlyTouching && (now - lastTouchDebounce >= 15)) {
      isCurrentlyTouching = false;
    }
  }

  // 5. Heartbeat every 2000ms
  if (now - lastHeartbeatTime >= 2000) {
    lastHeartbeatTime = now;
    if (currentState == STATE_IDLE) {
      sendJson("HEARTBEAT", "\"status\":\"IDLE\",\"mode\":" + String((int)currentMode));
    } else if (currentState == STATE_PLAYING) {
      sendStatus();
    }
  }

  delay(4);
}
