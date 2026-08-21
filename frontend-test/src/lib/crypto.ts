import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

export interface KeyPair {
    publicKey: string;
    secretKey: string;
}

export interface EncryptedMessage {
    cipherText: string;
    nonce: string;
}

/**
 * Generate a new Ed25519 keypair for this user.
 * Returns base64-encoded keys.
 */
export function generateKeyPair(): KeyPair {
    const keypair = nacl.box.keyPair();
    return {
        publicKey: encodeBase64(keypair.publicKey),
        secretKey: encodeBase64(keypair.secretKey),
    };
}

/**
 * Encrypt a message to a recipient using their public key.
 * Uses the sender's secret key and generates a random nonce.
 */
export function encryptMessage(
    plaintext: string,
    recipientPublicKey: string,
    senderSecretKey: string,
): EncryptedMessage {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const message = new TextEncoder().encode(plaintext);
    const publicKey = decodeBase64(recipientPublicKey);
    const secretKey = decodeBase64(senderSecretKey);

    const encrypted = nacl.box(message, nonce, publicKey, secretKey);

    return {
        cipherText: encodeBase64(encrypted),
        nonce: encodeBase64(nonce),
    };
}

/**
 * Decrypt a message from a sender.
 * The recipient uses their own secret key and the sender's public key.
 */
export function decryptMessage(
    cipherText: string,
    nonce: string,
    senderPublicKey: string,
    recipientSecretKey: string,
): string {
    const encrypted = decodeBase64(cipherText);
    const nonceBytes = decodeBase64(nonce);
    const publicKey = decodeBase64(senderPublicKey);
    const secretKey = decodeBase64(recipientSecretKey);

    const decrypted = nacl.box.open(encrypted, nonceBytes, publicKey, secretKey);

    if (!decrypted) {
        throw new Error("Decryption failed: invalid ciphertext or authentication tag");
    }

    return new TextDecoder().decode(decrypted);
}

/**
 * Retrieve stored keypair from localStorage.
 * Returns null if not found.
 */
export function getStoredKeyPair(username: string): KeyPair | null {
    const stored = localStorage.getItem(`keypair:${username}`);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Store keypair in localStorage.
 */
export function storeKeyPair(username: string, keypair: KeyPair): void {
    localStorage.setItem(`keypair:${username}`, JSON.stringify(keypair));
}

/**
 * Clear stored keypair from localStorage (e.g., on logout).
 */
export function clearStoredKeyPair(username: string): void {
    localStorage.removeItem(`keypair:${username}`);
}
