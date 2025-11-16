#!/bin/bash
# Script to update package-lock.json with missing dependencies

echo "Updating package-lock.json..."
npm install

echo "Done! The package-lock.json has been updated."
echo "Please commit and push the updated package-lock.json file."

