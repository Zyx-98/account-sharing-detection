#!/bin/bash

if [ -z "$1" ]; then
  echo "Error: Migration name is required."
  echo "Usage: npm run migration:create migration_name"
  exit 1
fi

npx typeorm migration:create src/database/migrations/$1
