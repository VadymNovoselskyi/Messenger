import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';

export type PreKeyBundle<T> = {
	registrationId: number;
	identityKey: T;
	signedPreKey: libsignal.SignedPublicPreKeyType<T>;
	preKeys: libsignal.PreKeyType<T>[];
};
