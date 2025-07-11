#!/bin/bash

mkdir -p ./csvs/zims

ZIM_COUNT=$(find ./csvs/zims -type f -name "*.zim" | wc -l)

if [ "$ZIM_COUNT" -eq 0 ]; then
    echo "No ZIM files found. Downloading..."
    wget -q https://download.kiwix.org/zim/devdocs/devdocs_en_go_2025-04.zim -P ./csvs/zims
    wget -q https://download.kiwix.org/zim/devdocs/devdocs_en_bash_2025-04.zim -P ./csvs/zims
    wget -q https://download.kiwix.org/zim/devdocs/devdocs_en_c_2025-04.zim -P ./csvs/zims
else
    echo "ZIM files already exist. No download needed."
fi
