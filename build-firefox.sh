#!/usr/bin/env sh
#
# Build the browser extension for Mozilla Firefox.

set -e

rm -rf ./dist/* ./build

npx tsc

npx webpack -c webpack.RPC-config.js

npx webpack -c webpack.background-script-config.firefox.js

npx webpack -c webpack.content-script-config.js

sh build-popup.sh

npx webpack -c ./webpack.popup-config.js && cp ./src/extension/popup/popup.html ./dist

cp ./src/extension/manifest-firefox.json ./dist/manifest.json && cp -r ./src/extension/icons ./src/extension/popup/gfx ./dist

cp ./node_modules/openodin/build/src/signatureoffloader/signatureOffloader-worker-browser.js ./dist
