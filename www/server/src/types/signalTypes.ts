import { Binary } from "mongodb";

export type BinaryPreKeyBundle = {
  registrationId: number; // B's registration id
  identityKey: Binary; // B's identity public key
  signedPreKey: BinarySignedPreKey; // B's signed pre-key
  preKeys: BinaryPreKey[]; // A one-time pre-key from B
};
export type StringifiedPreKeyBundle = {
  registrationId: number; // B's registration id
  identityKey: string; // B's identity public key
  signedPreKey: StringifiedSignedPreKey; // B's signed pre-key
  preKeys: StringifiedPreKey[]; // A one-time pre-key from B
};

export type BinaryPreKey = {
  keyId: number;
  publicKey: Binary;
};
export type StringifiedPreKey = {
  keyId: number;
  publicKey: string;
};

export interface BinarySignedPreKey extends BinaryPreKey {
  signature: Binary;
}
export interface StringifiedSignedPreKey extends StringifiedPreKey {
  signature: string;
}
