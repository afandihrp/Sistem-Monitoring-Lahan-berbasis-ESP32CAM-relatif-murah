#include <ESPmDNS.h> // Tambahkan library mDNS
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#define ADC_PIN 2

// ================= WIFI =================
const char *ssid = "Tenda03";
const char *password = "BRHtenda68";

// ================= GATEWAY (mDNS) =================
const char *targetHostname = "gateway"; // Tanpa ".local"
String resolvedGatewayIP = ""; // Menyimpan IP hasil resolve
const int backendPort = 3000;  // GANTI dengan port backend Node.js Anda

// ================= IDENTITAS NODE =================
const String nodeLocation = "Pagar_Utara";
const String sensorName = "Node_01";

// ================= ADC =================
const float VREF = 3.3;
const int ADC_MAX = 4095;

// ================= THRESHOLD =================
// Sesuaikan jika hasil pengujian berubah
const float CUT_THRESHOLD = 2.0;

// ================= DEBOUNCE =================
const int REQUIRED_CONSECUTIVE_READS = 5;

int cutCounter = 0;
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
}

// ================= RESOLVE mDNS =================
bool resolveGatewayIP() {
  Serial.print("Resolving mDNS for ");
  Serial.print(targetHostname);
  Serial.println(".local ...");

  // Mencari IP dari target
  IPAddress gatewayIP = MDNS.queryHost(targetHostname);

  if (gatewayIP.toString() == "0.0.0.0") {
    Serial.println("mDNS resolution failed! Gateway not found.");
    return false;
  } else {
    resolvedGatewayIP = gatewayIP.toString();
    Serial.print("Gateway IP resolved: ");
    Serial.println(resolvedGatewayIP);
    return true;
  }
}

// ================= SEND ALERT =================
void sendAlert(float voltage) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return;
  }

  if (resolvedGatewayIP == "") {
    Serial.println("Gagal mengirim alert: IP Gateway belum direseolve.");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // Bypass validasi sertifikat lokal

  HTTPClient http;

  // Membuat URL HTTPS yang sesuai dengan backend Express Anda
  String url = "https://" + resolvedGatewayIP + ":" + String(backendPort) +
               "/api/tripwire" + "?location=" + nodeLocation +
               "&sensor=" + sensorName;

  /* * Opsional: Jika Anda ingin tetap mengirim data voltage ke backend,
   * Anda bisa menambahkannya di akhir URL seperti ini:
   * "&voltage=" + String(voltage, 2);
   * Walaupun backend saat ini belum membacanya, data tetap akan terkirim.
   */

  Serial.print("Sending Alert -> ");
  Serial.println(url);

  http.begin(client, url);

  // Melakukan HTTP GET request sesuai dengan `router.get` di backend
  int httpCode = http.GET();

  Serial.print("HTTP Response: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println("Response dari Server: " + payload);
  }

  http.end();
}

// ================= READ ADC =================
float readVoltage() {
  long sum = 0;

  for (int i = 0; i < 20; i++) {
    sum += analogRead(ADC_PIN);
    delay(5);
  }

  int rawADC = sum / 20;

  return ((float)rawADC / ADC_MAX) * VREF;
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  delay(2000);

  Serial.println("=== NODE PAGAR START ===");

  analogReadResolution(12);
  analogSetPinAttenuation(ADC_PIN, ADC_11db);

  connectWiFi();

  // Inisialisasi mDNS untuk ESP32 (memberikan nama hostname untuk ESP ini
  // sendiri)
  if (!MDNS.begin("node-pagar")) {
    Serial.println("Error setting up MDNS responder!");
  } else {
    Serial.println("mDNS responder started.");
  }

  // Standby dan block execution sampai IP Gateway berhasil diresolve
  while (!resolveGatewayIP()) {
    Serial.println("Menunggu gateway.local...");
    delay(2000);
  }
  Serial.println("Gateway ditemukan. Sistem standby memonitor tripwire...");
}

// ================= LOOP =================
void loop() {
  float voltage = readVoltage();

  Serial.print("Voltage: ");
  Serial.println(voltage, 3);

  if (voltage >= CUT_THRESHOLD) {
    cutCounter++;

    Serial.print("Cut Counter: ");
    Serial.println(cutCounter);

    if (cutCounter >= REQUIRED_CONSECUTIVE_READS && !alertSent) {
      Serial.println("CABLE CUT CONFIRMED");

      sendAlert(voltage);

      alertSent = true;
    }
  } else {
    cutCounter = 0;
    alertSent = false;
  }

  delay(500);
}