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

rm -rf ./dist/* ./build

npx tsc

npx webpack -c webpack.RPC-config.js

npx webpack -c webpack.background-script-config.chrome.js

npx webpack -c webpack.content-script-config.js

npx webpack -c ./webpack.popup-config.js && cp ./src/extension/popup/popup.html ./dist

cp ./src/extension/manifest.json ./dist && cp -r ./src/extension/icons ./dist
