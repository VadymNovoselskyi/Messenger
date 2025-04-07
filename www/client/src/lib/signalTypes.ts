import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';

export type unorgonizedKeys = {
	registrationId: number;
	identityKeyPair: libsignal.KeyPairType<ArrayBuffer>;
	signedPreKey: libsignal.SignedPreKeyPairType;
	oneTimePreKeys: libsignal.PreKeyPairType[];
};

export type StringifiedPreKeyBundle = {
	registrationId: number; // B's registration id
	identityKey: string; // B's identity public key
	signedPreKey: StringifiedSignedPreKey; // B's signed pre-key
	preKeys: StringifiedPreKey[]; // A one-time pre-key from B
};
export type PreKeyBundle = {
	registrationId: number; // B's registration id
	identityKey: ArrayBuffer; // B's identity public key
	signedPreKey: SignedPreKey; // B's signed pre-key
	preKeys: PreKey[]; // A one-time pre-key from B
};

export type StringifiedPreKey = {
	keyId: number;
	publicKey: string;
};
export type PreKey = {
	keyId: number;
	publicKey: ArrayBuffer;
};

export interface StringifiedSignedPreKey extends StringifiedPreKey {
	signature: string;
}
export interface SignedPreKey extends PreKey {
	signature: ArrayBuffer;
}
