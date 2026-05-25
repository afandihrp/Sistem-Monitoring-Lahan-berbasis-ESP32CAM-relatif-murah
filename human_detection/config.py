# Configuration settings for the human detection subsystem

MODEL_PATH = "yolov8n_int8.tflite"

# Detection and NMS Hyperparameters
CONF_THRESHOLD = 0.25
NMS_THRESHOLD = 0.45

# Performance and Hardware
NUM_THREADS = 4

# WebSocket Server Configuration
HOST = "0.0.0.0"
PORT = 5000
MAX_WS_SIZE = 20 * 1024 * 1024  # 20 MB
