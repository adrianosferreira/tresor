import { create } from "zustand";
import type { KdfParams } from "@tresor/crypto";

interface VaultState {
  token: string | null;
  email: string | null;
  kdfSalt: Uint8Array | null;
  kdfParams: KdfParams | null;
  encryptedVaultKey: { ciphertext: Uint8Array; nonce: Uint8Array } | null;
  vaultKey: Uint8Array | null;
  locked: boolean;
  setSession: (data: {
    token: string;
    email: string;
    kdfSalt: Uint8Array;
    kdfParams: KdfParams;
    encryptedVaultKey: { ciphertext: Uint8Array; nonce: Uint8Array };
  }) => void;
  unlock: (vaultKey: Uint8Array) => void;
  lock: () => void;
  logout: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  token: null,
  email: null,
  kdfSalt: null,
  kdfParams: null,
  encryptedVaultKey: null,
  vaultKey: null,
  locked: true,
  setSession: (data) =>
    set({
      token: data.token,
      email: data.email,
      kdfSalt: data.kdfSalt,
      kdfParams: data.kdfParams,
      encryptedVaultKey: data.encryptedVaultKey,
      locked: true,
      vaultKey: null,
    }),
  unlock: (vaultKey) => set({ vaultKey, locked: false }),
  lock: () => set({ vaultKey: null, locked: true }),
  logout: () =>
    set({
      token: null,
      email: null,
      kdfSalt: null,
      kdfParams: null,
      encryptedVaultKey: null,
      vaultKey: null,
      locked: true,
    }),
}));
