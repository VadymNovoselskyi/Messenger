import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { SessionRecord } from '@privacyresearch/libsignal-protocol-typescript/lib/session-record';

import { SignalProtocolDb } from '../indexedDB/SignalProtocolDb.svelte';
import { sendPreKeyWhisperMessage } from '$lib/api/RequestService';
import * as parserUtils from '$lib/utils/parserUtils';
import * as chatMetadataUtils from '$lib/utils/chatMetadataUtils.svelte';
import * as dataTypes from '$lib/types/dataTypes';
import * as signalTypes from '$lib/types/signalTypes';
import type { unorgonizedKeys } from '$lib/types/signalTypes';

/**
 * Generates a pre-key bundle and stores it in the SignalProtocolDb.
 * @param preKeyNumber The number of ephemeral keys to generate.
 * @returns The pre-key bundle.
 */
export async function generatePreKeyBundle(preKeyNumber: number): Promise<unorgonizedKeys> {
	const store = SignalProtocolDb.getInstance();

	// Generate and store registration ID
	const registrationId = await libsignal.KeyHelper.generateRegistrationId();
	await store.put('registrationId', registrationId);

	// Generate and store identity key pair
	const identityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
	await store.put('identityKeyPair', identityKeyPair);

	// Generate and store signed pre-key
	const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(identityKeyPair, 1);
	await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

	// Generate and store 100 one-time pre-keys
	const oneTimePreKeys = await generateEphemeralKeys(preKeyNumber);
	return {
		registrationId,
		identityKeyPair,
		signedPreKey,
		oneTimePreKeys
	};
}

/**
 * Generates a specified number of ephemeral keys and stores them in the SignalProtocolDb.
 * @param preKeyNumber The number of ephemeral keys to generate.
 * @returns An array of ephemeral keys.
 */
export async function generateEphemeralKeys(
	preKeyNumber: number
): Promise<libsignal.PreKeyPairType<ArrayBuffer>[]> {
	const store = SignalProtocolDb.getInstance();
	const oneTimePreKeys: libsignal.PreKeyPairType<ArrayBuffer>[] = [];
	for (let i = 0; i < preKeyNumber; i++) {
		const prekey = await libsignal.KeyHelper.generatePreKey(i + 2);
		oneTimePreKeys.push(prekey);
		await store.storePreKey(prekey.keyId, prekey.keyPair);
	}
	return oneTimePreKeys;
}

/**
 * Handles the session bootstrap process for a new chat.
 * @param createdChat The created chat object.
 * @param preKeyBundle The pre-key bundle for the other user.
 */
export async function handleSessionBootstrap(
	createdChat: dataTypes.StoredChat,
	preKeyBundle: signalTypes.StringifiedPreKeyBundle
): Promise<void> {
	const { _id } = createdChat;
	const { registrationId, identityKey, signedPreKey, preKeys } = preKeyBundle;
	const serializedPreKey: libsignal.DeviceType = {
		registrationId,
		identityKey: parserUtils.base64ToArrayBuffer(identityKey),
		signedPreKey: {
			keyId: signedPreKey.keyId,
			publicKey: parserUtils.base64ToArrayBuffer(signedPreKey.publicKey),
			signature: parserUtils.base64ToArrayBuffer(signedPreKey.signature)
		},
		preKey:
			preKeys && preKeys.length
				? {
						keyId: preKeys[0].keyId,
						publicKey: parserUtils.base64ToArrayBuffer(preKeys[0].publicKey)
					}
				: undefined
	};

	const receiverAddress: libsignal.SignalProtocolAddress = new libsignal.SignalProtocolAddress(
		chatMetadataUtils.getOtherUserChatMetadata(_id)._id,
		1
	);
	const receiverDevice: libsignal.DeviceType = {
		identityKey: serializedPreKey.identityKey,
		signedPreKey: serializedPreKey.signedPreKey,
		preKey: serializedPreKey.preKey,
		registrationId: serializedPreKey.registrationId
	};

	const store = SignalProtocolDb.getInstance();
	const sessionBuilder = new libsignal.SessionBuilder(store, receiverAddress);
	await sessionBuilder.processPreKey(receiverDevice);
	return;
}
