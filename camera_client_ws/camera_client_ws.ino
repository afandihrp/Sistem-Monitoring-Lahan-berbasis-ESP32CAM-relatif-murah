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

// Flash LED GPIO (AI Thinker ESP32-CAM: GPIO 4)
#define FLASH_GPIO_NUM 4

// Flag untuk on-demand capture via Telegram
volatile bool pendingOnDemandCapture = false;

// Global camera config agar bisa dipakai ulang saat reinit
camera_config_t app_cam_config;

// Terapkan pengaturan sensor setelah setiap init/reinit
void applySensorSettings() {
  sensor_t * s = esp_camera_sensor_get();
  if (!s) return;
  
  // Set default resolution to HVGA (Downscale from FHD pre-allocation)
  s->set_framesize(s, FRAMESIZE_HVGA);

  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 2);
    s->set_saturation(s, -2);
  } else if (s->id.PID == OV2640_PID) {
    // Reset AWB, AEC, AGC agar warna dan eksposur stabil setelah reinit
    s->set_whitebal(s, 1);       // Enable auto white balance
    s->set_awb_gain(s, 1);      // Enable AWB gain
    s->set_wb_mode(s, 0);       // 0=Auto WB
    s->set_exposure_ctrl(s, 1); // Enable auto exposure
    s->set_aec2(s, 1);          // Enable AEC DSP
    s->set_gain_ctrl(s, 1);     // Enable auto gain
    s->set_bpc(s, 1);           // Black pixel correction
    s->set_wpc(s, 1);           // White pixel correction
    s->set_lenc(s, 1);          // Lens correction
  }
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
  app_cam_config.xclk_freq_hz  = 8000000; // 20MHz default for FHD bandwidth
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
  applySensorSettings();
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

  // Get MAC address and send it as a custom header
  String mac = WiFi.macAddress();
  String headers = "X-MAC-Address: " + mac;
  webSocket.setExtraHeaders(headers.c_str());

  // Connect to WebSocket using the resolved IP
  webSocket.beginSSL(serverIP.toString().c_str(), 3000, "/camera", "", "");
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
  s->set_framesize(s, FRAMESIZE_FHD);
  delay(500); // Tunggu sensor stabil

  // Nyalakan flash SEBELUM flush frames agar AEC kamera bisa menyesuaikan
  Serial.println("[2] Flash ON — flushing frames for AEC adjustment...");
  digitalWrite(FLASH_GPIO_NUM, HIGH);

  // Buang 5 frame — cukup untuk AEC konvergen
  for (int i = 0; i < 5; i++) {
    camera_fb_t * discard = esp_camera_fb_get();
    if (discard) {
      esp_camera_fb_return(discard);
    }
    delay(150);
  }

  // === STEP 2: Ambil frame FHD dengan flash menyala ===
  Serial.println("[3] Capturing frame with flash...");
  camera_fb_t * fb = esp_camera_fb_get();
  digitalWrite(FLASH_GPIO_NUM, LOW);  // Matikan flash setelah frame diambil
  Serial.println("[3] Flash OFF.");

  if (!fb) {
    Serial.println("[ERR] Failed to get FHD frame!");
    s->set_framesize(s, FRAMESIZE_HVGA); // Restore streaming mode
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

  // === STEP 4: Kembali ke mode streaming HVGA ===
  Serial.println("[7] Restoring HVGA streaming mode...");
  s->set_framesize(s, FRAMESIZE_HVGA);
  Serial.println("=== captureAndUpload END ===");
}


void check_sensor(uint8_t pin, bool &prev_state, String label) {
  bool current_state = digitalRead(pin);
  if (current_state == HIGH && prev_state == LOW) {
    // Kirim notifikasi motion ke server via WebSocket
    String msg = "{\"type\":\"motion\",\"sensor\":\"" + label + "\"}";
    webSocket.sendTXT(msg);
    Serial.println("Motion detected: " + label);

    // Capture dan upload foto high-res
    captureAndUpload(label);

    prev_state = HIGH;
  } else if (current_state == LOW && prev_state == HIGH) {
    prev_state = LOW;
  }
}

void check_pins()
{
  check_sensor(left_pir_pin, prev_state_left_pir, "left");
  check_sensor(middle_pir_pin, prev_state_middle_pir, "middle");
  check_sensor(right_pir_pin, prev_state_right_pir, "right");
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

