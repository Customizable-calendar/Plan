#!/bin/bash
# 더블클릭하면 stage 최신 코드로 개발 서버를 켜요. (scripts/stage.mjs)
cd "$(dirname "$0")" && pnpm stage "$@"
