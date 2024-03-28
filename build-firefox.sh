#!/usr/bin/env sh
#
# Build the browser extension for Mozilla Firefox.

set -e

BROWSERIFY="npx browserify --s module \
    -i ./node_modules/openodin/build/src/datastreamer/FileStreamWriter.js \
    -i ./node_modules/openodin/build/src/datastreamer/FileStreamReader.js \
    -i sqlite3 \
    -i postgresql-client"

rm -rf ./dist/* ./build

npx tsc

$BROWSERIFY ./node_modules/openodin/build/src/util/RPC.js -o ./build/lib/RPC.js

$BROWSERIFY ./build/extension/background-script.js -o ./dist/background-script.js

$BROWSERIFY ./build/extension/content-script.js -o ./dist/content-script.js

npx webpack -c ./webpack.popup-config.js && cp ./src/extension/popup/popup.html ./dist

cp ./src/extension/manifest.json ./dist && cp -r ./src/extension/icons ./dist

cp ./node_modules/openodin/build/src/signatureoffloader/signatureOffloader-worker-browser.js ./dist
