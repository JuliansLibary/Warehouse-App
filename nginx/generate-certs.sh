#!/bin/sh
# Generates a self-signed certificate for local development.
# For production, replace with a real certificate (Let's Encrypt / CA).

mkdir -p "$(dirname "$0")/certs"

openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
  -keyout "$(dirname "$0")/certs/server.key" \
  -out "$(dirname "$0")/certs/server.crt" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Self-signed certificate created in nginx/certs/"
