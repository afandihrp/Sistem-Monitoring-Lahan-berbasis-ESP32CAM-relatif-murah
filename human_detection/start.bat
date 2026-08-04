@echo off
if exist "pc_env\Scripts\python.exe" (
    .\pc_env\Scripts\python.exe app.py
) else if exist "ai_env\Scripts\python.exe" (
    .\ai_env\Scripts\python.exe app.py
) else (
    python app.py
)
