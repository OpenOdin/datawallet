import {
    RPC,
} from "openodin";

import {
    BackgroundService,
} from "../lib/BackgroundService";

declare const browser: any;
declare const chrome: any;

const browserHandle = typeof(browser) !== "undefined" ? browser : chrome;

const service = new BackgroundService();

function connected(port: any) {
    const [portName, rpcId]  = port.name.split("_");

    if (portName === "openodin-popup-to-background") {
        const postMessage = (message: any) => {
            port.postMessage(message);
        };

        port.onDisconnect.addListener( () => {
            // Closes all resources.
            //
            service.unregisterPopupRPC(rpc);
        });

        const listenMessage = (listener: (message: any) => void) => {
            port.onMessage.addListener( (message: any) => {
                listener(message);
            });
        };

        const rpc = new RPC(postMessage, listenMessage, rpcId);

        service.registerPopupRPC(rpc);
    }
    else if (portName === "openodin-content-to-background") {
        const postMessage = (message: any) => {
            port.postMessage(message);
        };

        port.onDisconnect.addListener( () => {
            // Closes all resources and RPC.
            //
            service.unregisterContentScriptRPC(rpc);
        });

        const listenMessage = (listener: (message: any) => void) => {
            port.onMessage.addListener( (message: any) => {
                listener(message);
            });
        };

        const rpc = new RPC(postMessage, listenMessage, rpcId);

        service.registerContentScriptRPC(rpc, port);
    }
}

browserHandle.runtime.onConnect.addListener(connected);
