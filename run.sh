#!/usr/bin/env bash
rm -rf .tmp
rm -rf media/scans
docker compose down -v
docker compose up -d --build