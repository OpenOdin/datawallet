import {
    WalletKeyPair,
    WalletConfig,
    Vault,
    PASSWORD_MIN_LENGTH,
} from "./types";

import nacl from "tweetnacl";
import scrypt from "scryptsy";

export class Wallet {
    protected password: string;
    private nonce: Uint8Array;

    private scrypt_salt: string;
    readonly scrypt_salt_length = 32;   // bytes
    readonly scrypt_N = 16384;          // work factor (iters)
    readonly scrypt_r = 8;              // memory factor
    readonly scrypt_p = 1;              // parallelization factor

    protected id: string;
    protected title: string;

    /** Unencrypted wallet config. */
    protected config: WalletConfig;

    constructor(password: string, title: string = "", id: string = "") {
        if (password.length < PASSWORD_MIN_LENGTH) {
            throw new Error("Too short password");
        }

        this.password = password;
        this.title = title;
        this.id = id;

        this.config = {
            keyPairs: [],
        };

        this.nonce = new Uint8Array();
        this.scrypt_salt = "";
    }

    /**
     * Encrypt and export vault as Vault.
     */
    public export(): Vault {
        return {
            id: this.id,
            title: this.title,
            blob: this.encrypt(this.config),
            scrypt_salt: this.scrypt_salt,
            nonce: this.nonce
        }
    }

    /**
     * Load wallet from blob
     * @throws if decryption fails
     */
    public load(vault: Vault) {
        this.title = vault.title;
        this.id = vault.id;
        this.scrypt_salt = vault.scrypt_salt;
        this.nonce = vault.nonce;

        // Note: decrypt depends on salt and nonce being
        // previously defined. That is expected to be
        // done during encrypt and retrieved after export.
        this.config = this.decrypt(vault.blob);
    }

    /**
     * Attempts to decrypt wallet using this.password
     * @throws if wallet cannot be decrypted.
     */
    protected decrypt(encryptedBlob: Uint8Array): WalletConfig {
        // Password-based key derivation for NaCl secret box
        let key: Uint8Array = new Uint8Array();
        if (this.scrypt_salt.length > 0) {
            key = scrypt(this.password, this.scrypt_salt, this.scrypt_N, this.scrypt_r, this.scrypt_p, nacl.secretbox.keyLength);
        } else {
            console.warn("Decrypting wallet: salt is unset.");
        }

        // Decrypt using key
        let blob = "";
        if (key && key.length > 0) {
            const blobArray = nacl.secretbox.open(encryptedBlob, this.nonce, key);

            // Note: original message is expected to be encoded with TextEncoder.
            // Decode the original message.
            if (blobArray) {
                const decoder = new TextDecoder();
                blob = decoder.decode(blobArray);
            }
        }

        // Attempt to parse decrypted blob
        try {
            const config = JSON.parse(blob);
            return config;
        }
        catch (e) {
            console.error("Could not decrypt wallet.");
            throw e;
        }
    }

    /**
     * Encrypt the wallet and return it as Uint8Array
     * @returns encrypted array
     */
    protected encrypt(config: WalletConfig): Uint8Array {
        const blob = JSON.stringify(config);

        // Make sure salt is regenerated and stored for later
        const decoder = new TextDecoder();
        this.scrypt_salt = decoder.decode(nacl.randomBytes(this.scrypt_salt_length));

        // Key derivation of password
        const key = scrypt(this.password, this.scrypt_salt, this.scrypt_N, this.scrypt_r, this.scrypt_p, nacl.secretbox.keyLength);

        // Make sure nonce is regenerated and stored for later
        this.nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

        // Encrypt blob
        const encoder = new TextEncoder();
        const encodedBlob = encoder.encode(blob);
        const encryptedBlobArray = nacl.secretbox(encodedBlob, this.nonce, key);
        return encryptedBlobArray;
    }

    public getTitle(): string {
        return this.title;
    }

    public setTitle(title: string) {
        this.title = title;
    }

    public getId(): string {
        return this.id;
    }

    public setId(id: string) {
        this.id = id;
    }

    public addKeyPair(keyPair: WalletKeyPair) {
        this.config.keyPairs.push(keyPair);
    }

    public getKeyPairs(): WalletKeyPair[] {
        return this.config.keyPairs.map( (keyPair: WalletKeyPair) => {
            return {
                publicKey: keyPair.publicKey.slice(),
                secretKey: keyPair.secretKey.slice(),
                crypto: keyPair.crypto,
            }
        });
    }

    public setKeyPairs(walletKeyPairs: WalletKeyPair[]) {
        this.config.keyPairs = walletKeyPairs.map( (keyPair: WalletKeyPair) => {
            return {
                publicKey: keyPair.publicKey.slice(),
                secretKey: keyPair.secretKey.slice(),
                crypto: keyPair.crypto,
            }
        });
    }

    public setPassword(password: string) {
        if (password.length < PASSWORD_MIN_LENGTH) {
            throw new Error("Too short password");
        }

        this.password = password;
    }

    /**
     * @return array of public keys.
     */
    public getPublicKeys(): number[][] {
        return this.config.keyPairs.map( (keyPair: WalletKeyPair) => keyPair.publicKey.slice() );
    }
}
