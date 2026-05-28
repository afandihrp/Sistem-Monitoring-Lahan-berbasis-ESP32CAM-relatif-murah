# Configuration settings for the human detection subsystem

MODEL_PATH = "yolo11n_int8.tflite"

# Detection and NMS Hyperparameters
CONF_THRESHOLD = 0.25
NMS_THRESHOLD = 0.45

# Performance and Hardware
NUM_THREADS = 2

# WebSocket Client Configuration (Target Backend)
BACKEND_HOST = "gateway.local"
BACKEND_PORT = 5000
MAX_WS_SIZE = 20 * 1024 * 1024  # 20 MB
