//eslint-disable-next-line @typescript-eslint/no-var-requires
const {RPC} = require("../../../build/lib/RPC.js");

import * as riot from "riot";

import PopupMain from "./popup-main.riot";
import PopupConnection from "./popup-connection.riot";
import PopupWallets from "./popup-wallets.riot";

riot.register("popup-connection", PopupConnection);
riot.register("popup-wallets", PopupWallets);

import "./popup.css";

//eslint-disable-next-line no-undef
const browserHandle = typeof(browser) !== "undefined" ? browser : chrome;

async function main() {
    const popupElement = document.querySelector("#popup");

    if (!popupElement) {
        console.error("popup div not existing");
        return;
    }

    const rpcId = "0";  // This is not required to be random from popup.

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

    const tabId = await getTabId();

    // Always auto-activate the tab when opened.
    await rpc.call("registerTab", [tabId]);

    riot.component(PopupMain)(popupElement, {rpc, tabId});
}


async function getTabId() {
    const tab = await getTab();
    return tab?.id;
}

async function getTab() {
    return (await browserHandle.tabs.query({active: true, currentWindow: true}))[0];
}

main();
