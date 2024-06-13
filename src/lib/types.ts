export const AppName = "OpenOdin DataWallet (official)";
export const AppVersion = "0.3.1";

/**
 * Cryptographic keys are stored as integers so they can be seamlessly serialized to JSON.
 */
export type WalletKeyPair = {
    publicKey: number[],
    secretKey: number[],
    crypto: string,
};

export type WalletConfig = {
    keyPairs: WalletKeyPair[],
};

// TODO set to 8
export const PASSWORD_MIN_LENGTH = 1;

export type TabState = {
    tabId: number,

    /**
     * Set to true when the content script has been successfully injected,
     * which happens when the tab is registered. */
    activated: boolean,

    /**
     * Set when the auth process begins, and is unset when
     * the auth process ends either when accepted or when rejected.
     */
    authRequestId?: number,

    /** Set to true when auth process is accepted */
    authed: boolean,

    /** Title of the tab window at the time it was registered */
    title: string,

    /** URL of the tab window at the time it was registered */
    url: string,

    /** error can get set when registering the tab */
    error?: string,
};

export type TabsState = {
    [tabId: string]: TabState,
};

export type Vault = {
    id: string,
    title: string,
    blob: number[],
    nonce: number[];
    scrypt_salt: number[];
};

export type Vaults = {[id: string]: Vault};
