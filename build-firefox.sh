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

npx webpack -c webpack.RPC-config.js

npx webpack -c webpack.background-script-config.firefox.js

npx webpack -c webpack.content-script-config.js

npx webpack -c ./webpack.popup-config.js && cp ./src/extension/popup/popup.html ./dist

cp ./src/extension/manifest.json ./dist && cp -r ./src/extension/icons ./dist

cp ./node_modules/openodin/build/src/signatureoffloader/signatureOffloader-worker-browser.js ./dist
