#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiManager.h>
#include <ESPmDNS.h>
#include "board_config.h"

#define TRIGGER_PIN 0

void startCameraServer();
void setupLedFlash();

unsigned long lastPrint = 0;
char deviceName[32];

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("BOOT START");

  uint64_t chipid = ESP.getEfuseMac();
  snprintf(deviceName, sizeof(deviceName), "fleetmate-cam-%04X", (uint16_t)(chipid >> 32));

  pinMode(TRIGGER_PIN, INPUT_PULLUP);
  delay(50);
  bool forceReset = (digitalRead(TRIGGER_PIN) == LOW);

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
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("CAMERA INIT FAILED: 0x%x\n", err);
  } else {
    Serial.println("Camera init OK");
    sensor_t *s = esp_camera_sensor_get();
    s->set_framesize(s, FRAMESIZE_96X96);
    s->set_special_effect(s, 2);
  }

#if defined(LED_GPIO_NUM)
  setupLedFlash();
#endif

  WiFi.setHostname(deviceName);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  if (forceReset) {
    Serial.println("Boot button held - resetting WiFi config");
    wm.resetSettings();
  }

  bool connected = wm.startConfigPortal(deviceName, "fleetmate123");

  if (!connected) {
    Serial.println("Failed to connect, restarting");
    ESP.restart();
  }

  Serial.println("========================================");
  Serial.print("DEVICE NAME: ");
  Serial.println(deviceName);
  Serial.print("IP ADDRESS: ");
  Serial.println(WiFi.localIP());
  Serial.println("========================================");

  if (MDNS.begin(deviceName)) {
    Serial.printf("mDNS started: http://%s.local\n", deviceName);
  } else {
    Serial.println("mDNS failed to start");
  }

  if (err == ESP_OK) {
    startCameraServer();
    Serial.println("Camera server started");
  }
}

void loop() {
  if (millis() - lastPrint > 10000) {
    Serial.printf("IP: %s  |  http://%s.local\n", WiFi.localIP().toString().c_str(), deviceName);
    lastPrint = millis();
  }
  delay(100);
}