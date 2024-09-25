#!/usr/bin/env sh
#
# Build the popup components

npx riot ./src/extension/popup/popup-dialog-unlock-vault.riot
npx riot ./src/extension/popup/popup-dialog-error.riot
npx riot ./src/extension/popup/popup-dialog-confirm.riot
npx riot ./src/extension/popup/popup-dialog-import-key.riot

npx riot ./src/extension/popup/popup-connection.riot
npx riot ./src/extension/popup/popup-manage-wallet.riot
npx riot ./src/extension/popup/popup-wallets.riot
npx riot ./src/extension/popup/popup-front.riot
npx riot ./src/extension/popup/popup-main.riot
