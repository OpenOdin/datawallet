# OpenOdin Data Wallet Browser Extension 

This is the official OpenOdin Data Wallet browser extension for Mozilla Firefox and Google Chrome.

## Current status
WARNING: The Data Wallet does currently *not* encrypt wallets stored in browser local stoage.  
Encryption will be added before any official release.  

Currently the Data Wallet works in Mozilla Firefox and needs to be sideloaded as a temporary extension in developer mode to be used.  

## Build
```sh
npm i
npm run build-firefox
# or, for chrome, do:
npm run build-chrome
```

Open `./dist/manifest.json` as a temporary extension in developer mode.  

## Release
_Tags_ are inspired by the SemVer.org convention. The version is expected to match the following regular expression:
```
[0-9]+.[0-9]+.[0-9]+
```

Create a new tag from _GitHub_ so that the artifacts get automatically built by _GitHub Action_.  
To do so, draft a new release here: [https://github.com/OpenOdin/datawallet/releases/new](https://github.com/OpenOdin/datawallet/releases/new).
