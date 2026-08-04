#!/bin/bash
cd "$(dirname "$0")"
if [ -d "pc_env" ]; then
    source pc_env/bin/activate
elif [ -d "ai_env" ]; then
    source ai_env/bin/activate
fi
python3 app.py
