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
    AppName,
    AppVersion,
} from "./types";

declare const browser: any;
declare const chrome: any;

type Tab = {
    url?: string,
    title?: string,
    id: number,
};

type Port = any;

export class BackgroundService {
    protected tabsState: TabsState = {};
    protected tabsPort: {[tabId: string]: [Port, RPC]} = {};
    protected browserHandle: typeof browser | typeof chrome;
    protected authRequests: ((walletKeyPairs?: WalletKeyPair[]) => void)[] = [];
    protected authRequestIdCounter = 1;
    protected vaults: Vaults = {};
    protected openOdinServers: {[rpcId: string]: OpenOdinRPCServer} = {};
    protected volatileCache: {[key: string]: any} = {};

    // This is set when the popup is open
    //
    protected popupRPC?: RPC;

    constructor() {
        this.browserHandle = typeof(browser) !== "undefined" ? browser : chrome;

        this.loadVaults();
    }

    public registerContentScriptRPC(rpc: RPC, port: Port) {
        // When running in Chrome we need to run single threaded,
        // the service worker is the thread.
        //
        const singleThreaded = typeof(browser) === "undefined";
        const nrOfWorkers = 1;

        const openOdinRPCServer = new OpenOdinRPCServer(rpc, nrOfWorkers, singleThreaded,
            AppName, AppVersion);

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

            port.onDisconnect.addListener( () => {
                this.unregisterTab(tabId);
            });

            const tabState = this.tabsState[tabId];
            // This could happen if extension got unloaded but client sent message.
            //
            if (!tabState) {
                port.disconnect();

                return {
                    keyPairs: [],
                    error: "Connection closed, Datawallet needs to be reopened",
                };
            }

            const url = tabState.url;

            let resolve: (keyPairs?: WalletKeyPair[]) => void | undefined;

            // Resolve any prior auth request as denied.
            this.denyAuth(tabId);

            const authRequestId = this.authRequestIdCounter++;

            this.authRequests[authRequestId] = (keyPairs?: WalletKeyPair[]) => { resolve && resolve(keyPairs) };

            this.tabsState[tabId].authRequestId = authRequestId;
            this.tabsPort[tabId] = [port, rpc];

            const p = new Promise<WalletKeyPair[] | undefined>( (resolveInner) => {
                resolve = resolveInner;
            });

            this.popupRPC?.call("beginAuth");

            const keyPairs = (await p) as WalletKeyPair[] | undefined;
            const error = keyPairs === undefined ? "Auth denied" : undefined;

            return {
                url,
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
        rpc.onCall("closeAuth", this.closeAuth);
        rpc.onCall("getVaults", this.getVaults);
        rpc.onCall("saveVault", this.saveVault);
        rpc.onCall("deleteVault", this.deleteVault);
        rpc.onCall("newKeyPair", this.newKeyPair);
        rpc.onCall("storeVolatile", this.storeVolatile);
        rpc.onCall("getVolatile", this.getVolatile);

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

            const vaultsJSON = JSON.stringify(this.vaults);

            await this.browserHandle.storage.local.set({vaults: vaultsJSON});
        }
        catch(e) {
            console.error(e);

            return false;
        }

        return true;
    };

    protected deleteVault = async (vault: Vault): Promise<boolean> => {
        try {
            delete this.vaults[vault.id];

            const vaultsJSON = JSON.stringify(this.vaults);

            await this.browserHandle.storage.local.set({vaults: vaultsJSON});
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

    protected closeAuth = (tabId: number) => {
        const [port, rpc] = this.tabsPort[tabId] ?? [];

        port?.disconnect();

        this.unregisterTab(tabId);

        if (rpc) {
            this.unregisterContentScriptRPC(rpc);
        }
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
    protected getState = async (): Promise<TabsState> => {
        return this.tabsState;
    };

    protected registerTab = async (tabId: number) => {
        const title = await this.getTabTitle();

        if (title === undefined || title === null) {
            throw new Error("Could not get title of tab");
        }

        const url = await this.getTabURL();

        if (!url) {
            throw new Error("Could not get URL of tab");
        }

        const tabState = this.tabsState[tabId];

        if (!tabState) {
            this.tabsState[tabId] = {
                tabId,
                activated: false,
                authed: false,
                authRequestId: undefined,
                title,
                url,
            };
        }
        else {
            // TODO: apps can change URL without reloading. Need to take this into account.
            //
            if (tabState.url !== url) {
                this.tabsState[tabId].activated = false;

                this.tabsState[tabId].error = "Error: Tab has changed URL, please open app in new tab for the DataWallet to accept it.";

                return;
            }

            this.tabsState[tabId].error = undefined;
        }

        try {
            await this.browserHandle.scripting.executeScript({files: ["/content-script.js"],
                target: {tabId}});

            this.tabsState[tabId].activated = true;
        }
        catch(e) {
            this.tabsState[tabId].activated = false;
            this.tabsState[tabId].error = "Error: Could not execute content script";

            console.error(e);
        }
    };

    protected unregisterTab(tabId: number) {
        delete this.tabsState[tabId];
        delete this.tabsPort[tabId];

        this.popupRPC?.call("unregisterTab", [tabId]);
    }

    protected async getTabTitle(): Promise<string | undefined> {
        const tab = await this.getTab();
        return tab?.title;
    }

    /**
     * @returns tab URL without query or hash parameters.
     */
    protected async getTabURL(): Promise<string | undefined> {
        const tab = await this.getTab();

        if (!tab || typeof(tab.url) !== "string") {
            return undefined;
        }

        const url = new URL(tab.url);

        return `${url.protocol}//${url.host}${url.pathname}`;
    }

    protected async getTabId(): Promise<number | undefined> {
        const tab = await this.getTab();
        return tab?.id;
    }

    protected async getTab(): Promise<Tab | undefined> {
        return (await this.browserHandle.tabs.query({active: true, currentWindow: true}))[0];
    }

    /**
     * Cache volatile data which lives as long as the background script is kept alive.
     *
     */
    protected storeVolatile = async (key: string, value: any) => {
        this.volatileCache[key] = value;
    };

    protected getVolatile = async (key: string) => {
        return this.volatileCache[key];
    };

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
