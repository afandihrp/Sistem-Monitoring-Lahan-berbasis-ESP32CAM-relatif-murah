#!/bin/bash
echo "Memeriksa dan menginstal library yang kurang..."
pip install -r requirements.txt

echo "Menyalakan Server AI Gateway..."
python app.py