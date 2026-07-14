#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <WiFi.h>

#define PIR_PIN 0 // Menggunakan pin 0

#define DEBUG_LED_PIN 8 // Pin 8 is the standard built-in LED for ESP32-C3 SuperMini.

// ================= DEBUG LED TASK =================
enum LedNotificationState {
  LED_STATE_OFF = 0,
  LED_STATE_CONNECTING_WIFI = 1,
  LED_STATE_FINDING_SERVER = 2
};
volatile int ledNotificationState = LED_STATE_OFF;

void setDebugLed(bool on) {
  if (DEBUG_LED_PIN == PIR_PIN) return; // Prevent breaking pin config if pins conflict
  // C3 SuperMini LED is active LOW (0 = ON, 255 = OFF)
  analogWrite(DEBUG_LED_PIN, on ? 0 : 255);
}

void ledTask(void * pvParameters) {
  if (DEBUG_LED_PIN != PIR_PIN) {
    pinMode(DEBUG_LED_PIN, OUTPUT);
    digitalWrite(DEBUG_LED_PIN, HIGH); // Start OFF
  }
  
  int lastWrittenState = -1;
  for (;;) {
    int state = __atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST);
    if (state == LED_STATE_CONNECTING_WIFI) {
      lastWrittenState = 1;
      // 1 slow blink: 1000ms ON, 1000ms OFF
      setDebugLed(true);
      for (int i = 0; i < 10; i++) {
        vTaskDelay(pdMS_TO_TICKS(100));
        if (__atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST) != LED_STATE_CONNECTING_WIFI) break;
      }
      state = __atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST);
      setDebugLed(false);
      if (state == LED_STATE_CONNECTING_WIFI) {
        for (int i = 0; i < 10; i++) {
          vTaskDelay(pdMS_TO_TICKS(100));
          if (__atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST) != LED_STATE_CONNECTING_WIFI) break;
        }
      }
    } else if (state == LED_STATE_FINDING_SERVER) {
      lastWrittenState = 2;
      // 2 fast blinks
      setDebugLed(true);
      for (int i = 0; i < 2; i++) {
        vTaskDelay(pdMS_TO_TICKS(100));
        if (__atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST) != LED_STATE_FINDING_SERVER) break;
      }
      setDebugLed(false);
      for (int i = 0; i < 2; i++) {
        vTaskDelay(pdMS_TO_TICKS(100));
        if (__atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST) != LED_STATE_FINDING_SERVER) break;
      }
      if (__atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST) == LED_STATE_FINDING_SERVER) {
        setDebugLed(true);
        for (int i = 0; i < 2; i++) {
          vTaskDelay(pdMS_TO_TICKS(100));
          if (__atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST) != LED_STATE_FINDING_SERVER) break;
        }
        setDebugLed(false);
        for (int i = 0; i < 10; i++) {
          vTaskDelay(pdMS_TO_TICKS(100));
          if (__atomic_load_n(&ledNotificationState, __ATOMIC_SEQ_CST) != LED_STATE_FINDING_SERVER) break;
        }
      } else {
        setDebugLed(false);
      }
    } else {
      lastWrittenState = 0;
      if (DEBUG_LED_PIN != PIR_PIN) {
        setDebugLed(false);
      }
      vTaskDelay(pdMS_TO_TICKS(100)); // Update at 10Hz
    }
  }
}

// ================= WIFI =================
const char *ssid = "BatuKhan";
const char *password = "momoygemoy";

// ================= GATEWAY (UDP DISCOVERY) =================
String globalCustomSubnet = "192.168.1";
String resolvedGatewayIP = "";          // Menyimpan IP hasil resolve
const int backendPort = 3000; // GANTI dengan port backend Node.js Anda

// ================= IDENTITAS NODE =================
const String nodeLocation = "Pagar_Utara";
const String sensorName = "Node_01";

// ================= DEBOUNCE =================
const int REQUIRED_CONSECUTIVE_READS =
    4; // Harus 4x berturut-turut putus (1 detik) untuk mengirim alert
const int REQUIRED_CONSECUTIVE_NORMAL =
    4; // Harus 4x berturut-turut normal (1 detik) untuk me-reset status

int cutCounter = 0;
int normalCounter = 0;
bool alertSent = false;

// ================= WIFI =================
void connectWiFi() {
  Serial.print("Connecting WiFi");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi Connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  __atomic_store_n(&ledNotificationState, LED_STATE_FINDING_SERVER, __ATOMIC_SEQ_CST);
}

// ================= RESOLVE GATEWAY (UDP DISCOVERY) =================
bool resolveGatewayIP() {
  IPAddress foundIP;
  foundIP.fromString("0.0.0.0");
  
  WiFiUDP discUdp;
  if(discUdp.begin(3005)) {
    String localIP = WiFi.localIP().toString();
    String localSubnet = localIP.substring(0, localIP.lastIndexOf('.'));
    
    // Tier 0: Subnet Broadcast Scan
    Serial.println("[DISC] Tier 0: Scanning via Subnet Broadcast on port 3005");
    IPAddress broadcastIP;
    broadcastIP.fromString("255.255.255.255");
    discUdp.beginPacket(broadcastIP, 3005);
    discUdp.print("discovery_ping");
    discUdp.endPacket();
    
    unsigned long startBroadcastWait = millis();
    while(millis() - startBroadcastWait < 500) {
      if(discUdp.parsePacket()) {
        char packetBuffer[255];
        int len = discUdp.read(packetBuffer, 255);
        if (len > 0) packetBuffer[len] = 0;
        if(String(packetBuffer) == "discovery_ack") {
          foundIP = discUdp.remoteIP();
          Serial.printf("[DISC] Success! Backend found at %s via Tier 0 Broadcast\n", foundIP.toString().c_str());
          break;
        }
      }
      delay(10);
    }
    
    // Tier 1: Local Subnet Scan (if broadcast failed)
    if (foundIP.toString() == "0.0.0.0") {
      Serial.printf("[DISC] Tier 1: Scanning local subnet %s.x on port 3005\n", localSubnet.c_str());
      for(int i = 1; i < 255; i++) {
        IPAddress target;
        target.fromString(localSubnet + "." + String(i));
        discUdp.beginPacket(target, 3005);
        discUdp.print("discovery_ping");
        discUdp.endPacket();
        
        if(discUdp.parsePacket()) {
          char packetBuffer[255];
          int len = discUdp.read(packetBuffer, 255);
          if (len > 0) packetBuffer[len] = 0;
          if(String(packetBuffer) == "discovery_ack") {
            foundIP = discUdp.remoteIP();
            Serial.printf("[DISC] Success! Backend found at %s via Local Subnet Scan\n", foundIP.toString().c_str());
            break;
          }
        }
        delay(40);
      }
      
      if (foundIP.toString() == "0.0.0.0") {
        unsigned long startWait = millis();
        while(millis() - startWait < 2000) {
          if(discUdp.parsePacket()) {
            char packetBuffer[255];
            int len = discUdp.read(packetBuffer, 255);
            if (len > 0) packetBuffer[len] = 0;
            if(String(packetBuffer) == "discovery_ack") {
              foundIP = discUdp.remoteIP();
              Serial.printf("[DISC] Success! Backend found at %s via Local Subnet Scan (Wait Phase)\n", foundIP.toString().c_str());
              break;
            }
          }
          delay(10);
        }
      }
    }
    
    // Tier 2: Custom Subnet Scan
    if (foundIP.toString() == "0.0.0.0") {
      Serial.printf("[DISC] Tier 2: Scanning custom subnet %s.x on port 3005\n", globalCustomSubnet.c_str());
      for(int i = 1; i < 255; i++) {
        IPAddress target;
        target.fromString(globalCustomSubnet + "." + String(i));
        discUdp.beginPacket(target, 3005);
        discUdp.print("discovery_ping");
        discUdp.endPacket();
        
        if(discUdp.parsePacket()) {
          char packetBuffer[255];
          int len = discUdp.read(packetBuffer, 255);
          if (len > 0) packetBuffer[len] = 0;
          if(String(packetBuffer) == "discovery_ack") {
            foundIP = discUdp.remoteIP();
            Serial.printf("[DISC] Success! Backend found at %s via Custom Subnet Scan\n", foundIP.toString().c_str());
            break;
          }
        }
        delay(40);
      }
      
      if (foundIP.toString() == "0.0.0.0") {
        unsigned long startWait = millis();
        while(millis() - startWait < 2000) {
          if(discUdp.parsePacket()) {
            char packetBuffer[255];
            int len = discUdp.read(packetBuffer, 255);
            if (len > 0) packetBuffer[len] = 0;
            if(String(packetBuffer) == "discovery_ack") {
              foundIP = discUdp.remoteIP();
              Serial.printf("[DISC] Success! Backend found at %s via Custom Subnet Scan (Wait Phase)\n", foundIP.toString().c_str());
              break;
            }
          }
          delay(10);
        }
      }
    }
    discUdp.stop();
  }

  if (foundIP.toString() == "0.0.0.0") {
    Serial.println("UDP Discovery failed! Gateway not found.");
    return false;
  } else {
    resolvedGatewayIP = foundIP.toString();
    Serial.print("Gateway IP resolved: ");
    Serial.println(resolvedGatewayIP);
    return true;
  }
}

// ================= SEND ALERT =================
void sendAlert() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return;
  }

  if (resolvedGatewayIP == "") {
    Serial.println("Gagal mengirim alert: IP Gateway belum direseolve.");
    return;
  }

  // --- PERCOBAAN 1: HTTP ---
  WiFiClient clientHttp;
  HTTPClient http;
  
  String urlHttp = "http://" + resolvedGatewayIP + ":" + String(backendPort) +
                   "/api/tripwire" + "?location=" + nodeLocation +
                   "&sensor=" + sensorName;

  Serial.print("Mencoba HTTP -> ");
  Serial.println(urlHttp);

  http.begin(clientHttp, urlHttp);
  int httpCode = http.GET();
  
  Serial.print("HTTP Response: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println("Response dari Server: " + payload);
  } else {
    Serial.println("Koneksi HTTP Gagal.");
  }
  
  http.end();
}

// ================= SEND PING =================
unsigned long lastPingTime = 0;

void sendPing() {
  if (WiFi.status() != WL_CONNECTED || resolvedGatewayIP == "") {
    return;
  }

  WiFiClient clientHttp;
  HTTPClient http;
  
  String mac = WiFi.macAddress();
  long rssi = WiFi.RSSI();
  
  String urlHttp = "http://" + resolvedGatewayIP + ":" + String(backendPort) +
                   "/api/ping?deviceId=" + sensorName +
                   "&mac=" + mac +
                   "&rssi=" + String(rssi);

  http.begin(clientHttp, urlHttp);
  int httpCode = http.GET();
  
  // We can ignore the response to save time/memory, just checking if it sent successfully
  if (httpCode <= 0) {
    Serial.println("Ping HTTP Gagal.");
  }
  
  http.end();
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  delay(2000);

  Serial.println("=== NODE PAGAR START ===");

  // Start LED Task
  xTaskCreate(ledTask, "LED Task", 2048, NULL, 1, NULL);
  __atomic_store_n(&ledNotificationState, LED_STATE_CONNECTING_WIFI, __ATOMIC_SEQ_CST);

  pinMode(PIR_PIN, INPUT);

  connectWiFi();

  // Standby dan block execution sampai IP Gateway berhasil diresolve
  while (!resolveGatewayIP()) {
    Serial.println("Menunggu gateway via UDP Discovery...");
    delay(2000);
  }
  Serial.println("Gateway ditemukan. Sistem standby memonitor tripwire...");
  
  __atomic_store_n(&ledNotificationState, LED_STATE_OFF, __ATOMIC_SEQ_CST);
}

// ================= LOOP =================
void loop() {
  if (millis() - lastPingTime >= 5000) {
    lastPingTime = millis();
    sendPing();
  }

  int pirState = digitalRead(PIR_PIN);

  Serial.printf("PIR State=%d\n", pirState);

  if (pirState == HIGH) { // Alarm dipicu saat PIR HIGH
    cutCounter++;
    normalCounter = 0; // Reset counter normal karena tegangan di atas threshold

    Serial.print("Anomaly Counter: ");
    Serial.println(cutCounter);

    if (cutCounter >= REQUIRED_CONSECUTIVE_READS && !alertSent) {
      Serial.println("ANOMALY DETECTED - ALARM TRIGGERED");

      sendAlert();

      alertSent = true;
    }
  } else {
    normalCounter++;
    cutCounter = 0; // Reset counter pemicu karena tegangan di bawah threshold

    // Reset status alert hanya jika tegangan benar-benar stabil di bawah threshold selama
    // beberapa waktu (debounce recovery)
    if (normalCounter >= REQUIRED_CONSECUTIVE_NORMAL) {
      if (alertSent) {
        Serial.println("SYSTEM RECOVERED - NORMAL (Alert Reset)");
        alertSent = false;
      }
      normalCounter = REQUIRED_CONSECUTIVE_NORMAL; // Mencegah overflow
    }
  }

  delay(250);
}
