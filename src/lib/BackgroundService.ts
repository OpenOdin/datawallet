import {
    OpenOdinRPCServer,
    Crypto,
    RPC,
} from "openodin";

import {
    WalletKeyPair,
    TabsState,
    Vault,
    Vaults,
} from "./types";

declare const browser: any;
declare const chrome: any;

type Tab = {
    url?: string,
    title?: string,
    id: number,
};

export class BackgroundService {
    protected tabsState: TabsState = {};
    protected browserHandle: typeof browser | typeof chrome;
    protected authRequests: ((walletKeyPairs?: WalletKeyPair[]) => void)[] = [];
    protected authRequestIdCounter = 0;
    protected vaults: Vaults = {};
    protected openOdinServers: {[rpcId: string]: OpenOdinRPCServer} = {};

    // This is set when the popup is open
    //
    protected popupRPC?: RPC;

    constructor() {
        this.browserHandle = typeof(browser) !== "undefined" ? browser : chrome;

        this.loadVaults();
    }

    public registerContentScriptRPC(rpc: RPC, port: any) {
        // When running in Chrome we need to run single threaded,
        // the service worker is the thread.
        //
        const singleThreaded = typeof(browser) === "undefined";
        const nrOfWorkers = 1;

        const openOdinRPCServer = new OpenOdinRPCServer(rpc, nrOfWorkers, singleThreaded);

        this.openOdinServers[rpc.getId()] = openOdinRPCServer;

        // On begin auth process.
        //
        openOdinRPCServer.onAuth( async () => {
            const tabId = await this.getTabId();

            if (tabId === undefined) {
                return {
                    keyPairs: [],
                    error: "Could not get tabId of active tab",
                };
            }

            // This could happen if extension got unloaded but client sent message.
            //
            if (!this.tabsState[tabId]) {
                port.disconnect();

                return {
                    keyPairs: [],
                    error: "Connection closed, Datawallet needs to be reopened",
                };
            }

            let resolve: (keyPairs?: WalletKeyPair[]) => void | undefined;

            // Resolve any prior auth request as denied.
            this.denyAuth(tabId);

            this.authRequests[this.authRequestIdCounter] = (keyPairs?: WalletKeyPair[]) => { resolve && resolve(keyPairs) };

            const authRequestId = this.authRequestIdCounter++;

            const p = new Promise<WalletKeyPair[] | undefined>( (resolveInner) => {
                resolve = resolveInner;

                this.tabsState[tabId].authRequestId = authRequestId;
            });

            this.popupRPC?.call("beginAuth");

            const keyPairs = (await p) as WalletKeyPair[] | undefined;
            const error = keyPairs === undefined ? "Auth denied" : undefined;

            return {
                keyPairs,
                error,
            };
        });
    }

    public unregisterContentScriptRPC(rpc: RPC) {
        rpc.close();

        const openOdinRPCServer = this.openOdinServers[rpc.getId()];

        openOdinRPCServer?.close();

        delete this.openOdinServers[rpc.getId()];
    }

    public registerPopupRPC(rpc: RPC) {
        rpc.onCall("registerTab", this.registerTab);
        rpc.onCall("getState", this.getState);
        rpc.onCall("acceptAuth", this.acceptAuth);
        rpc.onCall("denyAuth", this.denyAuth);
        rpc.onCall("getVaults", this.getVaults);
        rpc.onCall("saveVault", this.saveVault);
        rpc.onCall("newKeyPair", this.newKeyPair);

        this.popupRPC = rpc;
    }

    public unregisterPopupRPC(rpc: RPC) {
        if (this.popupRPC === rpc) {
            delete this.popupRPC;
        }

        rpc.close();
    }

    protected async loadVaults() {
        const key = "vaults";

        const json = (await this.browserHandle.storage.local.get([key]))[key] ?? "{}";

        this.vaults = JSON.parse(json);
    }

    protected getVaults = async (): Promise<Vaults> => {
        return this.vaults;
    };

    protected saveVault = async (vault: Vault): Promise<boolean> => {
        try {
            this.vaults[vault.id] = vault;

            const value = JSON.stringify(this.vaults);

            await this.browserHandle.storage.local.set({vaults: value});
        }
        catch(e) {
            console.error(e);

            return false;
        }

        return true;
    };

    protected denyAuth = (tabId: number) => {
        const authRequestId = this.tabsState[tabId]?.authRequestId;

        if (authRequestId === undefined) {
            return;
        }

        this.tabsState[tabId].authRequestId = undefined;

        const resolve = this.authRequests[authRequestId];

        delete this.authRequests[authRequestId];

        resolve && resolve();
    };

    protected acceptAuth = (tabId: number, keyPairs: WalletKeyPair[]) => {
        const authRequestId = this.tabsState[tabId].authRequestId;

        if (authRequestId === undefined) {
            return;
        }

        this.tabsState[tabId].authRequestId = undefined;

        const resolve = this.authRequests[authRequestId];

        delete this.authRequests[authRequestId];

        resolve && resolve(keyPairs);

        this.tabsState[tabId].authed = true;
    };

    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected getState = async (tabId: number): Promise<TabsState> => {
        return this.tabsState;
    };

    protected registerTab = async (tabId: number) => {
        const title = await this.getTabTitle() ?? "<unknown title>";
        const url = await this.getTabURL() ?? "<unknown URL>";

        if (!this.tabsState[tabId]) {
            this.tabsState[tabId] = {
                activated: false,
                authed: false,
                authRequestId: undefined,
                title,
                url,
            };
        }

        try {
            await this.browserHandle.scripting.executeScript({files: ["/content-script.js"],
                target: {tabId}});
        }
        catch(e) {
            console.error(e);

            return;
        }

        this.tabsState[tabId].activated = true;
    };

    protected async getTabTitle(): Promise<string | undefined> {
        const tab = await this.getTab();
        return tab?.title;
    }

    protected async getTabURL(): Promise<string | undefined> {
        const tab = await this.getTab();
        return tab?.url;
    }

    protected async getTabId(): Promise<number | undefined> {
        const tab = await this.getTab();
        return tab?.id;
    }

    protected async getTab(): Promise<Tab | undefined> {
        return (await this.browserHandle.tabs.query({active: true, currentWindow: true}))[0];
    }

    protected newKeyPair = async (): Promise<WalletKeyPair> => {
        const keyPair = Crypto.GenKeyPair();

        const publicKey: number[] = [];
        const secretKey: number[] = [];

        keyPair.publicKey.forEach(i => publicKey.push(i) );
        keyPair.secretKey.forEach(i => secretKey.push(i) );

        return {
            publicKey,
            secretKey,
            crypto: "ed25519",
        };
    };
}
