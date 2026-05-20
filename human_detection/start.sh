#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
  echo "Membuat virtual environment Python..."
  python3 -m venv venv || python -m venv venv
fi

source venv/bin/activate

echo "Memeriksa dan menginstal library yang kurang..."
pip3 install -r requirements.txt || pip install -r requirements.txt

echo "Menyalakan Server AI Gateway..."
python3 app.py || python app.py