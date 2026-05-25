import cv2
import numpy as np
import ai_edge_litert.interpreter as tflite
import config

class PersonDetector:
    def __init__(self):
        print(f"[INFO] Menggunakan library: ai_edge_litert")
        print(f"[INFO] Menginisialisasi PersonDetector dengan model: {config.MODEL_PATH}")
        self.interpreter = tflite.Interpreter(model_path=config.MODEL_PATH, num_threads=config.NUM_THREADS)
        self.interpreter.allocate_tensors()

        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()

        self.input_shape = self.input_details[0]['shape']
        self.input_height = self.input_shape[1]
        self.input_width = self.input_shape[2]
        self.input_dtype = self.input_details[0]['dtype']

        # Inspeksi dimensi output untuk auto-verifikasi model (80-class vs 1-class)
        output_shape = self.output_details[0]['shape']
        # YOLOv8 output tensor biasanya berdimensi [1, channels, boxes] (misal: [1, 84, 8400] atau [1, 5, 8400])
        # channels mewakili 4 koordinat box + jumlah class
        num_channels = output_shape[1] if output_shape[1] < output_shape[2] else output_shape[2]
        num_classes = num_channels - 4
        
        if num_classes == 1:
            print(f"[INFO] Loaded model output channels: {num_channels} (Detected Person-Only model)")
        else:
            print(f"[INFO] Loaded model output channels: {num_channels} (Detected {num_classes}-class COCO model)")

    def run_inference(self, img_bgr):
        # Preprocessing
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (self.input_width, self.input_height), interpolation=cv2.INTER_LINEAR)
        img_input = np.expand_dims(img_resized, axis=0)

        if self.input_dtype == np.float32:
            img_input = img_input.astype(np.float32) / 255.0
        else:
            img_input = img_input.astype(self.input_dtype)

        # Inferensi
        self.interpreter.set_tensor(self.input_details[0]['index'], img_input)
        self.interpreter.invoke()

        output_data = self.interpreter.get_tensor(self.output_details[0]['index'])
        output_data = np.squeeze(output_data)

        # Transpose: (84, 8400) → (8400, 84)
        if output_data.shape[0] < output_data.shape[1]:
            output_data = output_data.T

        orig_h, orig_w = img_bgr.shape[:2]

        # 1. Ambil class scores (kolom index 4 ke atas)
        class_scores = output_data[:, 4:]
        
        # 2. Cari class dengan score tertinggi untuk setiap bounding box
        class_ids = np.argmax(class_scores, axis=1)
        class_confs = class_scores[np.arange(len(class_scores)), class_ids]

        # 3. Filter hanya untuk class 0 (person) dan confidence > CONF_THRESHOLD
        mask = (class_ids == 0) & (class_confs > config.CONF_THRESHOLD)
        
        boxes = []
        confidences = []

        if np.any(mask):
            matching_rows = output_data[mask]
            matching_confs = class_confs[mask]
            
            xc = matching_rows[:, 0]
            yc = matching_rows[:, 1]
            w  = matching_rows[:, 2]
            h  = matching_rows[:, 3]
            
            x1 = ((xc - w / 2) * orig_w).astype(np.int32)
            y1 = ((yc - h / 2) * orig_h).astype(np.int32)
            x2 = ((xc + w / 2) * orig_w).astype(np.int32)
            y2 = ((yc + h / 2) * orig_h).astype(np.int32)
            
            boxes = np.column_stack((x1, y1, x2, y2)).tolist()
            confidences = matching_confs.tolist()

        # NMS (Non-Maximum Suppression)
        final_boxes = []
        if len(boxes) > 0:
            indices = cv2.dnn.NMSBoxes(
                boxes, confidences,
                score_threshold=config.CONF_THRESHOLD,
                nms_threshold=config.NMS_THRESHOLD
            )
            if len(indices) > 0:
                for i in indices.flatten():
                    x1, y1, x2, y2 = boxes[i]
                    final_boxes.append({
                        "confidence": round(confidences[i], 2),
                        "posisi": [
                            round(float(x1 / orig_w), 4),
                            round(float(y1 / orig_h), 4),
                            round(float(x2 / orig_w), 4),
                            round(float(y2 / orig_h), 4)
                        ]
                    })

        # Bersihkan memori tensor dan input
        del img_rgb, img_resized, img_input, output_data
        return final_boxes
