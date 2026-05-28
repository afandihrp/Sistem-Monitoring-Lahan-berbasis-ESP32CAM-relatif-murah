#!/bin/bash
SSH_PASS="123123"

sshpass -p "$SSH_PASS" rsync -avz --progress ./backendAndTelegramBot/src momoy@momoy.local:/home/momoy/Desktop/backendAndTelegramBot

sshpass -p "$SSH_PASS" rsync -avz --progress ./cameraKiosk/src momoy@momoy.local:/home/momoy/Desktop/cameraKiosk


#scp -r ./backendAndTelegramBot/src/ momoy@momoy.local:/home/momoy/Desktop/backendAndTelegramBot
#
#bash 123123
#
#scp -r ./cameraKiosk/src/ momoy@momoy.local:/home/momoy/Desktop/cameraKiosk
#
#bash 123123
