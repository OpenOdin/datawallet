#!/usr/bin/env sh
#
# Build the browser extension for Google Chrome.
#
# The difference from building for Firefox is that since the Chrome manifest version 3 extension
# background-script run in a service worker the code must be single threaded, as web workers are
# not supported in service workers.
#
# This means that browserify in this script ignores the "web-worker" package and also we skip to
# copy the file signatureOffloader-worker-browser.js to the dist directory since it will never be
# loaded.

set -e

BROWSERIFY="npx browserify --s module \
    -i ./node_modules/openodin/build/src/datastreamer/FileStreamWriter.js \
    -i ./node_modules/openodin/build/src/datastreamer/FileStreamReader.js \
    -i sqlite3 \
    -i postgresql-client \
    -i web-worker"

rm -rf ./dist/* ./build

npx tsc

$BROWSERIFY ./node_modules/openodin/build/src/util/RPC.js -o ./build/lib/RPC.js

$BROWSERIFY ./build/extension/background-script.js -o ./dist/background-script.js

$BROWSERIFY ./build/extension/content-script.js -o ./dist/content-script.js

npx webpack -c ./webpack.popup-config.js && cp ./src/extension/popup/popup.html ./dist

cp ./src/extension/manifest.json ./dist && cp -r ./src/extension/icons ./dist
