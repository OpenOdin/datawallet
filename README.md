# OpenOdin Datawallet Browser Extension 

This is the official [OpenOdin](https://github.com/OpenOdin/) Datawallet browser extension for Mozilla Firefox and Google Chrome.

With this browser add-on you can authenticate to sites running OpenOdin applications and keeping your cryptographic keys secure.

## Screenshots
![datawallet-1](https://github.com/user-attachments/assets/d5b961c3-39f5-4b6a-a268-41de7c3ccf2e)

![datawallet-2](https://github.com/user-attachments/assets/854930a1-2f77-47cf-a468-2e408bb4b029)

![datawallet-3](https://github.com/user-attachments/assets/b43e6f06-9cc4-4d30-bdff-1449f1ad4681)

![datawallet-4](https://github.com/user-attachments/assets/26342117-99f4-4d6e-a330-20acb4665227)

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

## Trying it out

Try out the add-on by running the OpenOdin webchat application, follow the instructions here: [https://github.com/OpenOdin/openodin/wiki/How-to-use](https://github.com/OpenOdin/openodin/wiki/How-to-use]

## License

Apache II License.

## Release

Auto built releases for Mozilla Firefox and Google Chrome can be found here: [https://github.com/OpenOdin/datawallet/releases](https://github.com/OpenOdin/datawallet/releases)

_Tags_ are inspired by the SemVer.org convention. The version is expected to match the following regular expression:
```
[0-9]+.[0-9]+.[0-9]+
```

Create a new tag from _GitHub_ so that the artifacts get automatically built by _GitHub Action_.  
To do so, draft a new release here: [https://github.com/OpenOdin/datawallet/releases/new](https://github.com/OpenOdin/datawallet/releases/new).
