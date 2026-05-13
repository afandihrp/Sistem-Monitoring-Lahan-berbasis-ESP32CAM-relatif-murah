#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ESPmDNS.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// WiFi credentials - REPLACE WITH YOUR ACTUAL CREDENTIALS
const char* ssid = "BatuKhan";
const char* password = "momoygemoy";

WebSocketsClient webSocket;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WSc] Disconnected!");
      break;
    case WStype_CONNECTED:
      Serial.printf("[WSc] Connected to url: %s\n", payload);
      break;
    case WStype_TEXT:
      Serial.printf("[WSc] get text: %s\n", payload);
      break;
    case WStype_BIN:
      Serial.printf("[WSc] get binary length: %u\n", length);
      break;
    case WStype_ERROR:
      Serial.printf("[WSc] Error: %s\n", payload);
      break;
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      break;
  }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector
  
  Serial.begin(115200);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  if (!MDNS.begin("esp32-cam")) {
    Serial.println("Error setting up MDNS responder!");
  }

  // Resolve gateway.local
  // Serial.println("Resolving gateway.local...");
  // IPAddress serverIP = MDNS.queryHost("gateway");

  // TEMPORARY: Hardcoded IP address
  IPAddress serverIP;
  serverIP.fromString("192.168.11.168"); // <-- REPLACE 'X' WITH YOUR PC'S LOCAL WI-FI IP

  if (serverIP.toString() == "0.0.0.0") {
    Serial.println("Could not resolve gateway.local. Check mDNS publishing on server.");
    // Fallback: You might want to hardcode the IP here if mDNS fails
    return;
  }

  Serial.print("Resolved gateway.local to: ");
  Serial.println(serverIP);

  // Configure WebSocket connection
  // Get MAC address and send it as a custom header
  String mac = WiFi.macAddress();
  Serial.print("MAC Address: ");
  Serial.println(mac);
  
  // Set custom header for MAC identification
  String headers = "X-MAC-Address: " + mac;
  webSocket.setExtraHeaders(headers.c_str());

  // Bypass SSL certificate validation for self-signed certs
  webSocket.beginSSL(serverIP.toString().c_str(), 3000, "/camera", "", "");

  // Bypass SSL certificate validation for self-signed certs
  // This is required since the server uses 'server.key' and 'server.cert'
  // webSocket.setCACert(nullptr); // Some versions use this
  // In modern arduinoWebSockets, we use WiFiClientSecure and set it there, 
  // but webSocket.beginSSL handles it. If it fails, custom client setup is needed.

  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
}
