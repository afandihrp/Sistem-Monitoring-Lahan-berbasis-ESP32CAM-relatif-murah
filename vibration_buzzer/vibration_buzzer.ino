#define SENSOR_PIN 0
#define BUZZER_PIN 2

void setup() {
  // Initialize serial communication for debugging
  Serial.begin(115200);
  delay(1000); // Wait a moment for serial to initialize
  
  // Configure pins
  pinMode(SENSOR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Ensure buzzer is off initially
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("ESP32-C3 Vibration Sensor & Buzzer initialized.");
}

void loop() {
  // Read the state of the SW-420 vibration sensor
  int sensorState = digitalRead(SENSOR_PIN);
  
  // SW-420 typically outputs HIGH (or pulses HIGH/LOW) when vibration is detected.
  if (sensorState == HIGH) {
    Serial.println("Vibration Detected! Triggering Buzzer...");
    
    // Turn on the buzzer
    digitalWrite(BUZZER_PIN, HIGH);
    
    // Keep the buzzer on for 2 seconds
    delay(100);
    
    // Turn off the buzzer after the delay
    digitalWrite(BUZZER_PIN, LOW);
    
    Serial.println("Buzzer off. Monitoring...");
  }
  
  // Small delay to prevent rapid continuous readings and allow stability
  delay(10);
}
