#!/bin/bash

# Script to generate PWA icons from SVG
# You can run this if you have ImageMagick installed
# For now, we'll create placeholder icons

echo "Creating PWA icons..."

# Create icon sizes needed for PWA
sizes=(72 96 128 144 152 180 192 384 512)

for size in "${sizes[@]}"; do
  echo "Creating ${size}x${size} icon..."
  # For now, just copy the SVG as placeholder
  cp icon-192x192.svg "icon-${size}x${size}.svg"
done

echo "Icons created! Replace with proper PNG/ICO files for production."
