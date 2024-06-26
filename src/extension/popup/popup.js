//eslint-disable-next-line @typescript-eslint/no-var-requires
const {RPC} = require("../../../build/lib/RPC.js");

import * as riot from "riot";

import { minidenticon } from 'minidenticons'

import PopupMain from "./popup-main.riot";
import PopupConnection from "./popup-connection.riot";
import PopupWallets from "./popup-wallets.riot";
import PopupManageWallet from "./popup-manage-wallet.riot";

riot.register("popup-connection", PopupConnection);
riot.register("popup-wallets", PopupWallets);
riot.register("popup-manage-wallet", PopupManageWallet);

import PopupFront from "./popup-front.riot";
riot.register("popup-front", PopupFront);

import "./popup.css";

// Need to call minidenticon to activate it.
minidenticon();

async function main() {

    const popupElement = document.querySelector("#popup");

    if (!popupElement) {
        console.error("popup div not existing");
        return;
    }

    const rpcId = "0";  // This is not required to be random from popup.

    //eslint-disable-next-line no-undef
    const browserHandle = typeof(browser) !== "undefined" ? browser : chrome;

    // Connect to background-script
    const port = browserHandle.runtime.connect({ name: `openodin-popup-to-background_${rpcId}` });

    const postMessage = (message) => {
        port.postMessage(message);
    };

    const listenMessage = (listener) => {
        port.onMessage.addListener( message => {
            listener(message);
        });
    };

    const rpc = new RPC(postMessage, listenMessage, rpcId);

    const tab = (await browserHandle.tabs.query({active: true, currentWindow: true}))[0];

    const tabId = tab?.id;

    if (tabId === undefined) {
        throw new Error("Could not get tab.id");
    }

    // Always auto-activate the tab when opened.
    await rpc.call("registerTab", [tabId]);

    riot.component(PopupMain)(popupElement, {rpc, tabId});
}

main();
