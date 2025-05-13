#!/bin/bash

# Script to copy necessary resources for Docker build

# Create resources directory if it doesn't exist
mkdir -p resources

# Copy prompt template
cp ../prompt_template.txt resources/

# Copy Vosk model if it exists
if [ -d "../vosk-model-small-cn" ]; then
    echo "Copying Vosk model..."
    cp -R ../vosk-model-small-cn resources/
else
    echo "Vosk model not found. Please download it and extract to ../vosk-model-small-cn"
    exit 1
fi

echo "Resources copied successfully" 