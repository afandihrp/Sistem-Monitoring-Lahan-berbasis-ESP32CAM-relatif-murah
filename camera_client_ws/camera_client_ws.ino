#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
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

// Servo Configuration
#define SERVO_PIN 12
#define SERVO_LEDC_CH 1
#define SERVO_LEDC_TIMER 1
#define SERVO_LEDC_RES 13 // 13-bit resolution (8192)
#define SERVO_LEDC_FREQ 50 // 50Hz for standard servos

// Servo Positions
uint8_t SERVO_POS_LEFT = 155;
uint8_t SERVO_POS_MIDDLE = 90;
uint8_t SERVO_POS_RIGHT = 0;
uint8_t SERVO_POS_DEFAULT = 90;

// WiFi credentials
// const char* ssid = "Tenda03";
// const char* password = "BRHtenda68";

const char* ssid = "BatuKhan";
const char* password = "momoygemoy";

// Security API Key
const char* apiKey = "momo_gemoy_api_key_123";

const uint8_t left_pir_pin = 13;
const uint8_t middle_pir_pin = 15;
const uint8_t right_pir_pin = 14;

volatile bool left_pir = false;
volatile bool middle_pir = false;
volatile bool right_pir = false;

bool prev_state_left_pir = false;
bool prev_state_middle_pir = false;
bool prev_state_right_pir = false;

// Flash LED GPIO (AI Thinker ESP32-CAM: GPIO 4)
#define FLASH_GPIO_NUM 4

// Flag untuk on-demand capture via Telegram
volatile bool pendingOnDemandCapture = false;

// Flag untuk servo control
volatile int pendingServoAngle = -1;

// Global camera config agar bisa dipakai ulang saat reinit
camera_config_t app_cam_config;

// Camera Configurator Parameters (defaults matching backend startup)
String cam_resolution = "HVGA";
int cam_quality = 12;
int cam_brightness = 0;
int cam_contrast = 0;
int cam_saturation = 0;
bool cam_awb = true;
bool cam_aec = true;
bool cam_agc = true;
bool cam_hmirror = false;
bool cam_vflip = false;
String cam_specialEffect = "None";
int cam_xclk = 8000000;
bool cam_flashOnCapture = true;

void applyCameraConfig() {
  sensor_t * s = esp_camera_sensor_get();
  if (!s) return;

  // 1. Resolution
  framesize_t framesize = FRAMESIZE_HVGA;
  if (cam_resolution == "UXGA") framesize = FRAMESIZE_UXGA;
  else if (cam_resolution == "SVGA") framesize = FRAMESIZE_SVGA;
  else if (cam_resolution == "VGA") framesize = FRAMESIZE_VGA;
  else if (cam_resolution == "HVGA") framesize = FRAMESIZE_HVGA;
  else if (cam_resolution == "QVGA") framesize = FRAMESIZE_QVGA;
  s->set_framesize(s, framesize);

  // 2. Quality
  s->set_quality(s, cam_quality);

  // 3. Image Tuning
  s->set_brightness(s, cam_brightness);
  s->set_contrast(s, cam_contrast);
  s->set_saturation(s, cam_saturation);

  // 4. AWB, AEC, AGC
  s->set_whitebal(s, cam_awb ? 1 : 0);
  s->set_awb_gain(s, cam_awb ? 1 : 0);
  s->set_exposure_ctrl(s, cam_aec ? 1 : 0);
  s->set_gain_ctrl(s, cam_agc ? 1 : 0);

  // 5. Mirror & Flip
  s->set_hmirror(s, cam_hmirror ? 1 : 0);
  s->set_vflip(s, cam_vflip ? 1 : 0);

  // 6. Special Effect
  int effectVal = 0;
  if (cam_specialEffect == "Negative") effectVal = 1;
  else if (cam_specialEffect == "Grayscale") effectVal = 2;
  else if (cam_specialEffect == "Red Tint") effectVal = 3;
  else if (cam_specialEffect == "Green Tint") effectVal = 4;
  else if (cam_specialEffect == "Blue Tint") effectVal = 5;
  else if (cam_specialEffect == "Sepia") effectVal = 6;
  s->set_special_effect(s, effectVal);

  // 7. XCLK (set via LEDC timer, value in MHz)
  s->set_xclk(s, LEDC_TIMER_0, cam_xclk / 1000000);

  Serial.println("[CAM] Camera configurations successfully applied to sensor.");
}


// Map angle (0-180) to Duty Cycle (13-bit: 0-8191)
// Standard Servo: 500us (0 deg) to 2400us (180 deg) at 20ms period (50Hz)
// 500us / 20000us * 8192 = 205
// 2400us / 20000us * 8192 = 983
void setServoAngle(uint8_t angle) {
  if (angle > 180) angle = 180;
  
  // Invert servo PWM control: 0 maps to 983, 180 maps to 205
  int duty = map(angle, 0, 180, 983, 205);
  ledcWrite(SERVO_PIN, duty); // Use PIN directly in Core 3.x
  Serial.printf("[SERVO] Angle set to %d (Duty: %d)\n", angle, duty);
}

WebSocketsClient webSocket;
bool isConnected = false;
unsigned long lastSignalSent = 0;
IPAddress serverIP;

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
      {
        String cmd = String((char*)payload);
        // Set flag saja, JANGAN panggil captureAndUpload langsung dari sini!
        // Memanggil fungsi berat di dalam WS callback akan memblokir library
        // dan menyebabkan koneksi disconnect.
        if (cmd.indexOf("\"capture_request\"") >= 0) {
          Serial.println("[WSc] On-demand capture queued.");
          pendingOnDemandCapture = true;
        } else if (cmd.indexOf("\"servo_control\"") >= 0) {
          int valueIdx = cmd.indexOf("\"value\":") + 8;
          int endIdx = cmd.indexOf("}", valueIdx);
          if (valueIdx > 8 && endIdx > valueIdx) {
            String valStr = cmd.substring(valueIdx, endIdx);
            valStr.trim();
            pendingServoAngle = valStr.toInt();
            Serial.printf("[WSc] Servo angle received: %d\n", pendingServoAngle);
          }
        } else if (cmd.indexOf("\"servo_config_update\"") >= 0) {
           int leftIdx = cmd.indexOf("\"leftPirAngle\":");
           int middleIdx = cmd.indexOf("\"middlePirAngle\":");
           int rightIdx = cmd.indexOf("\"rightPirAngle\":");
           int defaultIdx = cmd.indexOf("\"defaultAngle\":");
           
           if (leftIdx != -1) SERVO_POS_LEFT = cmd.substring(leftIdx + 15).toInt();
           if (middleIdx != -1) SERVO_POS_MIDDLE = cmd.substring(middleIdx + 17).toInt();
           if (rightIdx != -1) SERVO_POS_RIGHT = cmd.substring(rightIdx + 16).toInt();
           if (defaultIdx != -1) SERVO_POS_DEFAULT = cmd.substring(defaultIdx + 15).toInt();
           
           Serial.printf("[WSc] Servo config updated via WS: L=%d, M=%d, R=%d, D=%d\n", SERVO_POS_LEFT, SERVO_POS_MIDDLE, SERVO_POS_RIGHT, SERVO_POS_DEFAULT);
           // Set the servo to the new default immediately (ledcWrite is fast and non-blocking)
           setServoAngle(SERVO_POS_DEFAULT);
        } else if (cmd.indexOf("\"camera_config_update\"") >= 0) {
           int resIdx = cmd.indexOf("\"resolution\":\"");
           if (resIdx != -1) {
             int start = resIdx + 14;
             int end = cmd.indexOf("\"", start);
             if (end != -1) cam_resolution = cmd.substring(start, end);
           }

           int qualIdx = cmd.indexOf("\"quality\":");
           if (qualIdx != -1) {
             int start = qualIdx + 10;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_quality = cmd.substring(start, end).toInt();
           }

           int brightIdx = cmd.indexOf("\"brightness\":");
           if (brightIdx != -1) {
             int start = brightIdx + 13;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_brightness = cmd.substring(start, end).toInt();
           }

           int contrastIdx = cmd.indexOf("\"contrast\":");
           if (contrastIdx != -1) {
             int start = contrastIdx + 11;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_contrast = cmd.substring(start, end).toInt();
           }

           int satIdx = cmd.indexOf("\"saturation\":");
           if (satIdx != -1) {
             int start = satIdx + 13;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_saturation = cmd.substring(start, end).toInt();
           }

           int awbIdx = cmd.indexOf("\"awb\":");
           if (awbIdx != -1) {
             int start = awbIdx + 6;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_awb = (cmd.substring(start, end).indexOf("true") != -1);
           }

           int aecIdx = cmd.indexOf("\"aec\":");
           if (aecIdx != -1) {
             int start = aecIdx + 6;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_aec = (cmd.substring(start, end).indexOf("true") != -1);
           }

           int agcIdx = cmd.indexOf("\"agc\":");
           if (agcIdx != -1) {
             int start = agcIdx + 6;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_agc = (cmd.substring(start, end).indexOf("true") != -1);
           }

           int hmirrorIdx = cmd.indexOf("\"hmirror\":");
           if (hmirrorIdx != -1) {
             int start = hmirrorIdx + 10;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_hmirror = (cmd.substring(start, end).indexOf("true") != -1);
           }

           int vflipIdx = cmd.indexOf("\"vflip\":");
           if (vflipIdx != -1) {
             int start = vflipIdx + 8;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_vflip = (cmd.substring(start, end).indexOf("true") != -1);
           }

           int effectIdx = cmd.indexOf("\"specialEffect\":\"");
           if (effectIdx != -1) {
             int start = effectIdx + 17;
             int end = cmd.indexOf("\"", start);
             if (end != -1) cam_specialEffect = cmd.substring(start, end);
           }

           int xclkIdx = cmd.indexOf("\"xclk\":");
           if (xclkIdx != -1) {
             int start = xclkIdx + 7;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_xclk = cmd.substring(start, end).toInt();
           }

           int flashIdx = cmd.indexOf("\"flashOnCapture\":");
           if (flashIdx != -1) {
             int start = flashIdx + 17;
             int end = cmd.indexOf(",", start);
             if (end == -1) end = cmd.indexOf("}", start);
             if (end != -1) cam_flashOnCapture = (cmd.substring(start, end).indexOf("true") != -1);
           }

           Serial.printf("[WSc] Camera config updated: Res=%s, Qual=%d, Bright=%d, Contrast=%d, Sat=%d, AWB=%d, AEC=%d, AGC=%d, Mirror=%d, Flip=%d, Effect=%s, XCLK=%d, Flash=%d\n",
                         cam_resolution.c_str(), cam_quality, cam_brightness, cam_contrast, cam_saturation, cam_awb, cam_aec, cam_agc, cam_hmirror, cam_vflip, cam_specialEffect.c_str(), cam_xclk, cam_flashOnCapture);

           // XCLK is changed at runtime via s->set_xclk() inside applyCameraConfig()

           applyCameraConfig();
         }
      }
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
  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW); // Flash mati saat startup

  // Init Servo PWM (ESP32 Core 3.x API)
  ledcAttach(SERVO_PIN, SERVO_LEDC_FREQ, SERVO_LEDC_RES);
  setServoAngle(SERVO_POS_DEFAULT); // Start at center position

  // Isi pin config ke app_cam_config global (dipakai ulang saat deinit/reinit)
  app_cam_config.ledc_channel  = LEDC_CHANNEL_0;
  app_cam_config.ledc_timer    = LEDC_TIMER_0;
  app_cam_config.pin_d0        = Y2_GPIO_NUM;
  app_cam_config.pin_d1        = Y3_GPIO_NUM;
  app_cam_config.pin_d2        = Y4_GPIO_NUM;
  app_cam_config.pin_d3        = Y5_GPIO_NUM;
  app_cam_config.pin_d4        = Y6_GPIO_NUM;
  app_cam_config.pin_d5        = Y7_GPIO_NUM;
  app_cam_config.pin_d6        = Y8_GPIO_NUM;
  app_cam_config.pin_d7        = Y9_GPIO_NUM;
  app_cam_config.pin_xclk      = XCLK_GPIO_NUM;
  app_cam_config.pin_pclk      = P_CLK_GPIO_NUM;
  app_cam_config.pin_vsync     = V_SYNC_GPIO_NUM;
  app_cam_config.pin_href      = H_REF_GPIO_NUM;
  app_cam_config.pin_sscb_sda  = SIOD_GPIO_NUM;
  app_cam_config.pin_sscb_scl  = SIOC_GPIO_NUM;
  app_cam_config.pin_pwdn      = PWDN_GPIO_NUM;
  app_cam_config.pin_reset     = RESET_GPIO_NUM;
  app_cam_config.xclk_freq_hz  = 8000000; // Default 8MHz, will be overridden by backend config
  app_cam_config.pixel_format  = PIXFORMAT_JPEG;
  app_cam_config.grab_mode     = CAMERA_GRAB_LATEST;
  app_cam_config.fb_location   = CAMERA_FB_IN_PSRAM;
  app_cam_config.frame_size    = FRAMESIZE_FHD; // PRE-ALLOCATE FHD MEMORY AT BOOT
  app_cam_config.jpeg_quality  = 2; 
  app_cam_config.fb_count      = 2; 

  // Init kamera
  esp_err_t err = esp_camera_init(&app_cam_config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Init failed: 0x%x\n", err);
    return;
  }
  
  // Apply sensor settings (this will downscale to HVGA for streaming)
  applyCameraConfig();
  Serial.println("Camera ready: Pre-allocated FHD, Streaming at HVGA.");


  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Resolve gateway.local via mDNS
  if (!MDNS.begin("esp32-cam")) {
    Serial.println("Error setting up MDNS responder!");
  }
  
  Serial.println("Resolving gateway.local...");
  serverIP = MDNS.queryHost("gateway");
  
  while (serverIP.toString() == "0.0.0.0") {
    Serial.println("mDNS query failed, retrying...");
    delay(1000);
    serverIP = MDNS.queryHost("gateway");
  }
  
  Serial.printf("Resolved gateway.local to: %s\n", serverIP.toString().c_str());

  // Get MAC address and construct connection path with query parameters
  String mac = WiFi.macAddress();
  String path = "/camera?mac=" + mac + "&apiKey=" + String(apiKey);

  // Connect to WebSocket using the resolved IP and query string path
  webSocket.beginSSL(serverIP.toString().c_str(), 3000, path.c_str(), "", "");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

// Fungsi capture & upload yang bisa dipanggil dari PIR maupun on-demand
void captureAndUpload(String label) {
  Serial.println("=== captureAndUpload START: " + label + " ===");

  sensor_t * s = esp_camera_sensor_get();
  if (!s) {
    Serial.println("[ERR] Could not get sensor pointer!");
    return;
  }

  // === STEP 1: Switch sensor ke FHD (Memory sudah ter-reserve di setup) ===
  Serial.println("[1] Switching to FHD resolution...");

 
  if (s->id.PID == OV3660_PID) {
    s->set_framesize(s, FRAMESIZE_FHD); // OV3660 supports Full HD (1920x1080)
  } else if (s->id.PID == OV2640_PID) {
    s->set_framesize(s, FRAMESIZE_UXGA); // OV2640 physical limit is UXGA (1600x1200)
  }

  // Override quality to high quality (10) for capture, independent of streaming setting
  s->set_quality(s, 10);

  delay(500); // Tunggu sensor stabil

  // Conditionally enable flash based on camera config
  if (cam_flashOnCapture) {
    Serial.println("[2] Flash ON — flushing frames for AEC adjustment...");
    digitalWrite(FLASH_GPIO_NUM, HIGH);
  } else {
    Serial.println("[2] Flash DISABLED by config — flushing frames...");
  }

  // Buang 2 frame — cukup untuk AEC konvergen
  for (int i = 0; i < 2; i++) {
    camera_fb_t * discard = esp_camera_fb_get();
    if (discard) {
      esp_camera_fb_return(discard);
    }
    delay(150);
  }

  // === STEP 2: Ambil frame FHD ===
  Serial.println("[3] Capturing frame...");
  camera_fb_t * fb = esp_camera_fb_get();
  if (cam_flashOnCapture) {
    digitalWrite(FLASH_GPIO_NUM, LOW);  // Matikan flash setelah frame diambil
    Serial.println("[3] Flash OFF.");
  }

  if (!fb) {
    Serial.println("[ERR] Failed to get FHD frame!");
    applyCameraConfig(); // Restore configured streaming mode
    return;
  }
  Serial.printf("[4] FHD frame captured: %d bytes\n", fb->len);



  // === STEP 3: Upload ke server ===
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String uploadUrl = "https://" + serverIP.toString() + ":3000/upload?sensor=" + label + "&ip=" + WiFi.localIP().toString();
  Serial.println("[5] Posting to: " + uploadUrl);
  http.setTimeout(20000);
  http.begin(client, uploadUrl);
  http.addHeader("Content-Type", "image/jpeg");
  int httpResponseCode = http.POST(fb->buf, fb->len);
  if (httpResponseCode > 0) {
    Serial.printf("[6] Upload SUCCESS: HTTP %d\n", httpResponseCode);
  } else {
    Serial.printf("[6] Upload FAILED: %s\n", http.errorToString(httpResponseCode).c_str());
  }
  http.end();
  esp_camera_fb_return(fb);

  // === STEP 4: Kembali ke mode streaming yang terkonfigurasi ===
  Serial.println("[7] Restoring configured streaming mode...");
  applyCameraConfig();
  Serial.println("=== captureAndUpload END ===");
}


void check_sensor(uint8_t pin, bool &prev_state, String label, uint8_t angle) {
  bool current_state = digitalRead(pin);
  if (current_state == HIGH && prev_state == LOW) {
    // Move servo to the direction of motion
    setServoAngle(angle);

    // Kirim notifikasi motion ke server via WebSocket
    String msg = "{\"type\":\"motion\",\"sensor\":\"" + label + "\"}";
    webSocket.sendTXT(msg);
    Serial.println("Motion detected: " + label);

    // Capture dan upload foto high-res
    captureAndUpload(label);
    
    // Move back to default position (middle)
    setServoAngle(SERVO_POS_DEFAULT);

    prev_state = HIGH;
  } else if (current_state == LOW && prev_state == HIGH) {
    prev_state = LOW;
  }
}

void check_pins()
{
  check_sensor(left_pir_pin, prev_state_left_pir, "left", SERVO_POS_LEFT);
  check_sensor(middle_pir_pin, prev_state_middle_pir, "middle", SERVO_POS_MIDDLE);
  check_sensor(right_pir_pin, prev_state_right_pir, "right", SERVO_POS_RIGHT);
}

unsigned long lastPinDebug = 0;

void loop() {
  webSocket.loop();

  // Proses on-demand capture DI SINI (di main loop, bukan di WS callback)
  // agar webSocket.loop() bisa bekerja normal selama flush buffer
  if (pendingOnDemandCapture) {
    pendingOnDemandCapture = false;
    captureAndUpload("capture");
  }

  // Proses servo move
  if (pendingServoAngle != -1) {
    int angle = pendingServoAngle;
    pendingServoAngle = -1; // Reset
    setServoAngle(angle);
  }

  check_pins();

  // Debug: Print pin states every 2 seconds
  if (millis() - lastPinDebug > 2000) {
    lastPinDebug = millis();
    Serial.printf("PIR Raw: L=%d, M=%d, R=%d\n", 
                  digitalRead(left_pir_pin), 
                  digitalRead(middle_pir_pin), 
                  digitalRead(right_pir_pin));
  }

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


    // Ambil frame untuk dikirim ke kiosk
    fb = esp_camera_fb_get();
    if (!fb) {
      // Buffer sedang dipakai (misal saat captureAndUpload), skip frame ini
      delay(10);
      return;
    }

    // Kirim frame JPEG ke kiosk via WebSocket
    webSocket.sendBIN(fb->buf, fb->len);
    esp_camera_fb_return(fb);

    // delay(200);
  }
}

