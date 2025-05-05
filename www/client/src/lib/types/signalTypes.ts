import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';

export type unorgonizedKeyPairs = {
	registrationId: number;
	identityKeyPair: libsignal.KeyPairType;
	signedPreKey: libsignal.SignedPreKeyPairType;
	oneTimePreKeys: libsignal.PreKeyPairType[];
};

export type PreKeyBundle<T> = {
	registrationId: number;
	identityKey: T;
	signedPreKey: libsignal.SignedPublicPreKeyType<T>;
	preKeys: libsignal.PreKeyType<T>[];
};
