#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ESPmDNS.h>
#include "esp_camera.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// AI Thinker ESP32-CAM Pinout
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define V_SYNC_GPIO_NUM   25
#define H_REF_GPIO_NUM    23
#define P_CLK_GPIO_NUM    22

// WiFi credentials
const char* ssid = "BatuKhan";
const char* password = "momoygemoy";

const uint8_t left_pir_pin = 13;
const uint8_t middle_pir_pin = 15;
const uint8_t right_pir_pin = 14;

volatile bool left_pir = false;
volatile bool middle_pir = false;
volatile bool right_pir = false;

bool prev_state_left_pir = false;
bool prev_state_middle_pir = false;
bool prev_state_right_pir = false;

WebSocketsClient webSocket;
bool isConnected = false;
unsigned long lastSignalSent = 0;

int getSignalBars(long rssi) {
  if (rssi >= -55) return 5;
  if (rssi >= -65) return 4;
  if (rssi >= -75) return 3;
  if (rssi >= -85) return 2;
  if (rssi >= -95) return 1;
  return 0;
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WSc] Disconnected!");
      isConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WSc] Connected to url: %s\n", payload);
      isConnected = true;
      break;
    case WStype_TEXT:
      Serial.printf("[WSc] get text: %s\n", payload);
      break;
    case WStype_BIN:
      // Binary data received from server (not expected from camera usually)
      break;
    case WStype_ERROR:
      Serial.printf("[WSc] Error: %s\n", payload);
      break;
  }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector
  
  Serial.begin(115200);
  if(psramFound())
  {
    Serial.println("psram enabled");
  }
  else 
  {
    Serial.println("psram are not enabled");
  }

  pinMode(left_pir_pin, INPUT_PULLDOWN);
  pinMode(middle_pir_pin, INPUT_PULLDOWN);
  pinMode(right_pir_pin, INPUT_PULLDOWN);

  // Camera configuration
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = P_CLK_GPIO_NUM;
  config.pin_vsync = V_SYNC_GPIO_NUM;
  config.pin_href = H_REF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 21000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Use VGA resolution (640x480)
  config.frame_size = FRAMESIZE_HVGA;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12; // 0-63, lower is higher quality
  config.fb_count = 2;

  // Initialize Camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // TEMPORARY: Hardcoded IP address
  IPAddress serverIP;
  serverIP.fromString("10.173.11.206");

  // Get MAC address and send it as a custom header
  String mac = WiFi.macAddress();
  String headers = "X-MAC-Address: " + mac;
  webSocket.setExtraHeaders(headers.c_str());

  // Connect to WebSocket
  webSocket.beginSSL(serverIP.toString().c_str(), 3000, "/camera", "", "");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void check_pins()
{
  bool current_state = digitalRead(left_pir_pin);
  if(current_state != true && prev_state_left_pir != true) return;
  left_pir = true;
  prev_state_left_pir = current_state;

  current_state = digitalRead(middle_pir_pin);
  if(current_state != true && prev_state_middle_pir != true) return;
  middle_pir = true;
  prev_state_middle_pir = current_state;

  current_state = digitalRead(right_pir_pin);
  if(current_state != true && prev_state_right_pir != true) return;
  right_pir = true;
  prev_state_right_pir = current_state;

}

void loop() {
  webSocket.loop();

  if (isConnected) {    
    // Send signal strength every 5 seconds
    if (millis() - lastSignalSent > 8000) {
      lastSignalSent = millis();
      int bars = getSignalBars(WiFi.RSSI());
      String msg = "{\"type\":\"signal\",\"bars\":" + String(bars) + "}";
      webSocket.sendTXT(msg);
      Serial.printf("Signal: %ld dBm (%d bars)\n", WiFi.RSSI(), bars);
    }

    camera_fb_t * fb = NULL;

    //camera flush - skip a few frames to get the latest
    fb = esp_camera_fb_get();
    esp_camera_fb_return(fb);
    fb = esp_camera_fb_get();
    esp_camera_fb_return(fb);
    
    fb = esp_camera_fb_get();
    // if (!fb) {
    //   Serial.println("Camera capture failed");
    //   return;
    // }

    // Send the JPEG frame as binary data
    webSocket.sendBIN(fb->buf, fb->len);

    // Return the frame buffer back to the driver for reuse
    esp_camera_fb_return(fb);

    delay(10);
  }
}
