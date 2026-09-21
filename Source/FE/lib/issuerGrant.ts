import { importPublicKey, wrapAesKey } from './credentialCrypto'
import { lookupVerifierIdentity } from './verifierIdentity'

export const MAX_WRAPPED_DOCUMENT_KEY_LENGTH = 512

export type PreparedIssuerGrantKey = {
  wrappedDocumentKey: Uint8Array
  recipientKeyVersion: number
}

export async function prepareIssuerAccessGrantKey(
  aesKey: CryptoKey,
  recipientWallet: string,
): Promise<PreparedIssuerGrantKey> {
  const identity = await lookupVerifierIdentity(recipientWallet)
  if (!identity?.encryptionPublicKey) {
    throw new Error('Recipient has not registered an encryption public key. Complete encryption setup first.')
  }

  let publicKeyBytes: Uint8Array
  try {
    publicKeyBytes = Uint8Array.from(atob(identity.encryptionPublicKey), (character) => character.charCodeAt(0))
  } catch {
    throw new Error('Recipient encryption public key is invalid.')
  }

  const publicKey = await importPublicKey(publicKeyBytes)
  const wrappedDocumentKey = await wrapAesKey(aesKey, publicKey)
  if (wrappedDocumentKey.length === 0 || wrappedDocumentKey.length > MAX_WRAPPED_DOCUMENT_KEY_LENGTH) {
    throw new Error('Wrapped document key exceeds the on-chain limit.')
  }

  return { wrappedDocumentKey, recipientKeyVersion: identity.keyVersion }
}

export function validateWrappedDocumentKey(wrappedDocumentKey: Uint8Array): void {
  if (wrappedDocumentKey.length === 0 || wrappedDocumentKey.length > MAX_WRAPPED_DOCUMENT_KEY_LENGTH) {
    throw new Error('Wrapped document key exceeds the on-chain limit.')
  }
}
