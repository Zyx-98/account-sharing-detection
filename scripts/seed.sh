#!/bin/sh

seed_directory="src/database/seeds"


if [ -n "$1" ]; then
    seed_file="$seed_directory/$1.seed.ts"
else
    seed_file="$seed_directory/database.seed.ts"
fi

ts-node -r tsconfig-paths/register $seed_file
