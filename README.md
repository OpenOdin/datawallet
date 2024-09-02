# OpenOdin Datawallet Browser Extension 

This is the official [OpenOdin](https://github.com/OpenOdin/) Datawallet browser extension for Mozilla Firefox and Google Chrome.

With this browser add-on you can authenticate to sites running OpenOdin applications and keeping your cryptographic keys secure.

## Development Status

The Datawallet is in a working state and considered beta.

## Install

```sh
npm i
```

## Build for Firefox

```sh
npm run build-firefox
```

## Build for Google Chrome

```sh
npm run build-chrome
```

## Run in developer mode

Open `./dist/manifest.json` as a temporary extension in developer mode either in Firefox or Chrome (depending for which you built).  

## License

Apache II License.


## Release
_Tags_ are inspired by the SemVer.org convention. The version is expected to match the following regular expression:
```
[0-9]+.[0-9]+.[0-9]+
```

Create a new tag from _GitHub_ so that the artifacts get automatically built by _GitHub Action_.  
To do so, draft a new release here: [https://github.com/OpenOdin/datawallet/releases/new](https://github.com/OpenOdin/datawallet/releases/new).
