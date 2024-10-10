import {
    HandshakeFactoryConfig,
} from "pocket-messaging";

import {
    OpenOdinRPCServer,
    Crypto,
    RPC,
    ConnectionConfig,
    DataModelInterface,
    Hash,
} from "openodin";

import {
    WalletKeyPair,
    TabsState,
    Vault,
    Vaults,
    AppName,
    AppVersion,
    PermissionRequest,
    PermissionResponse,
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
    protected permissionPromises: {[id: string]: (permissionResponse: PermissionResponse) => void} = {};
    protected savedSessionPermissions: {[tabId: string]: {[hash: string]: boolean}} = {};

    // This is set when the popup is open
    //
    protected popupRPC?: RPC;

    constructor() {
        this.browserHandle = typeof(browser) !== "undefined" ? browser : chrome;

        this.loadVaults();
    }

    public registerContentScriptRPC(rpc: RPC, port: Port) {
        const tabId = port.sender.tab.id;

        if (tabId === undefined) {
            throw new Error("tabId not passed with Port object");
        }

        // When running in Chrome we need to run single threaded,
        // the service worker is the thread.
        //
        const singleThreaded = typeof(browser) === "undefined";
        const nrOfWorkers = 1;

        const openOdinRPCServer = new OpenOdinRPCServer(rpc, nrOfWorkers, singleThreaded,
            AppName, AppVersion);

        this.openOdinServers[rpc.getId()] = openOdinRPCServer;

        openOdinRPCServer.onAuthFactoryCreate( async (connection: ConnectionConfig["connection"]):
            Promise<boolean> =>
        {
            const rv = new Uint8Array(8);
            self.crypto.getRandomValues(rv);
            const id = Buffer.from(rv).toString("hex");

            const authFactoryConfig = connection.handshake ?? connection.api;

            if (!authFactoryConfig) {
                return false;
            }

            const serverPublicKey = authFactoryConfig.serverPublicKey;
            const host = authFactoryConfig.socketFactoryConfig.client?.clientOptions.host;
            const port = authFactoryConfig.socketFactoryConfig.client?.clientOptions.port;

            const endpoint = `${host}:${port}`;

            const action = "handshake";

            const hashes = [
                Hash([action, endpoint]).toString("hex"),
            ];

            const permissionRequest: PermissionRequest = {
                id,
                hashes,
                action,
                title: "Site is requesting to handshake as you",
                description: `Do you accept site to handshake to the endpoint ${endpoint} who has the expected server public key of ${serverPublicKey?.toString("hex")}?`,
            };

            // Check if permission is already allowed.
            //
            if (!this.checkPermission(tabId, permissionRequest)) {
                const permissionResponse = await this.requestPermission(tabId, permissionRequest);

                if (!permissionResponse || !permissionResponse.allow) {
                    return false;
                }

                // Is allowed.
                // Check if to save answer.
                //
                if (permissionResponse.save > 0) {
                    this.savePermission(tabId, permissionResponse);
                }

                // Fall through
            }

            return true;
        });

        openOdinRPCServer.onSign( async (dataModels: DataModelInterface[]): Promise<boolean> => {
            const rv = new Uint8Array(8);
            self.crypto.getRandomValues(rv);
            const id = Buffer.from(rv).toString("hex");

            const action = "sign";

            const hashes = [
                Hash([action]).toString("hex"),
            ];

            const permissionRequest: PermissionRequest = {
                id,
                hashes,
                action,
                title: "Site is requesting to sign data nodes as you",
                description: `Do you accept site to sign ${dataModels.length} data nodes using your private key(s)?`,
            };

            // Check if permission is already allowed.
            //
            if (!this.checkPermission(tabId, permissionRequest)) {
                const permissionResponse = await this.requestPermission(tabId, permissionRequest);

                if (!permissionResponse || !permissionResponse.allow) {
                    return false;
                }

                // Is allowed.
                // Check if to save answer.
                //
                if (permissionResponse.save > 0) {
                    this.savePermission(tabId, permissionResponse);
                }

                // Fall through
            }

            return true;
        });

        // On begin auth process.
        // Called on rpc.call("auth")
        //
        openOdinRPCServer.onAuth( async () => {
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

            this.popupRPC?.call("update");

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
        rpc.onCall("permissionResponse", this.permissionResponse);
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

        delete this.savedSessionPermissions[tabId];

        port?.disconnect();

        this.unregisterTab(tabId);

        if (rpc) {
            this.unregisterContentScriptRPC(rpc);
        }
    };

    /**
     * Check if permission is already allowed.
     */
    protected checkPermission(tabId: number, permissionRequest: PermissionRequest) {
        const savedHashes = this.savedSessionPermissions[tabId] ?? {};

        // Check if to allow all
        //
        if (savedHashes["*"]) {
            return true;
        }

        const hashes = permissionRequest.hashes;

        const hashesLength = hashes.length;
        for (let i=0; i<hashesLength; i++) {
            const hash = hashes[i];

            if (savedHashes[hash]) {
                return true;
            }
        }

        return false;
    }

    /**
     * Save permission for session or for-ever.
     */
    protected savePermission(tabId: number, permissionResponse: PermissionResponse) {
        const savedHashes = this.savedSessionPermissions[tabId] ?? {};

        // Note: we are only saving for session as for now.
        //

        this.savedSessionPermissions[tabId] = savedHashes;
        permissionResponse.hashes.forEach( hash => savedHashes[hash] = true );
    }

    protected async requestPermission(tabId: number, permissionRequest: PermissionRequest): Promise<PermissionResponse> {
        this.tabsState[tabId].permissionRequests[permissionRequest.id] = permissionRequest;

        let resolve: ((permissionResponse: PermissionResponse) => void) | undefined = undefined;

        const promise = new Promise<PermissionResponse>( resolve2 => {
            resolve = resolve2;
        });

        if (!resolve) {
            throw new Error("Missing resolve");
        }

        this.permissionPromises[permissionRequest.id] = resolve;

        this.popupRPC?.call("update");

        //eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [port, rpc] = this.tabsPort[tabId] ?? [];

        rpc?.call("attentionNeeded", [Object.values(this.tabsState[tabId].permissionRequests).length]);

        return promise;
    }

    protected permissionResponse = (tabId: number, permissionResponse: PermissionResponse) => {
        delete this.tabsState[tabId].permissionRequests[permissionResponse.id];

        const resolve = this.permissionPromises[permissionResponse.id];

        resolve?.(permissionResponse);

        //eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [port, rpc] = this.tabsPort[tabId] ?? [];

        rpc?.call("attentionNeeded", [Object.values(this.tabsState[tabId].permissionRequests).length]);

        this.popupRPC?.call("update");
    };

    protected acceptAuth = (tabId: number, keyPairs: WalletKeyPair[], strictVerify: boolean) => {
        const authRequestId = this.tabsState[tabId].authRequestId;

        if (authRequestId === undefined) {
            return;
        }

        let savedHashes = this.savedSessionPermissions[tabId] ?? {};

        // Set allow all if strictVerify is off
        //
        if (strictVerify) {
            // Make sure to reset previously allowed session permissions.
            //
            savedHashes = {};
        }

        savedHashes["*"] = !strictVerify;

        this.savedSessionPermissions[tabId] = savedHashes;

        this.tabsState[tabId].authRequestId = undefined;

        const resolve = this.authRequests[authRequestId];

        delete this.authRequests[authRequestId];

        resolve && resolve(keyPairs);

        this.tabsState[tabId].authed = true;
    };

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
                permissionRequests: {},
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
