import { Binary, ObjectId } from "mongodb";
import * as requestTypes from "../types/requestTypes.js";
import * as mongoApi from "../mongodb/mongoApi.js";
import { DeliveryService } from "./DeliveryService.js";
import { PreKeyBundle } from "../types/signalTypes.js";

import { base64ToBinary } from "../utils/parserUtils.js";
import { PreKeyType } from "@privacyresearch/libsignal-protocol-typescript";

export class UserService {
  private static _instance: UserService;

  private constructor(private deliveryService: DeliveryService) {}

  public static init(deliveryService: DeliveryService) {
    if (!this._instance) this._instance = new UserService(deliveryService);
    return this._instance;
  }

  public static get instance(): UserService {
    if (!this._instance)
      throw new Error("UserService not initialised - call ChatService.init() first");
    return this._instance;
  }

  public async sendPreKeyBundle(
    userId: string,
    id: string,
    payload: requestTypes.sendPreKeyBundlePayload
  ) {
    const { preKeyBundle } = payload as requestTypes.sendPreKeyBundlePayload;
    const binaryPreKeyBundle: PreKeyBundle<Binary> = {
      registrationId: preKeyBundle.registrationId,
      identityKey: base64ToBinary(preKeyBundle.identityKey),
      signedPreKey: {
        keyId: preKeyBundle.signedPreKey.keyId,
        publicKey: base64ToBinary(preKeyBundle.signedPreKey.publicKey),
        signature: base64ToBinary(preKeyBundle.signedPreKey.signature),
      },
      preKeys: [],
    };
    for (const preKey of preKeyBundle.preKeys) {
      binaryPreKeyBundle.preKeys.push({
        keyId: preKey.keyId,
        publicKey: base64ToBinary(preKey.publicKey),
      });
    }

    await mongoApi.savePreKeyBundle(new ObjectId(userId), binaryPreKeyBundle);
    this.deliveryService.sendMessage(userId, {
      id,
      api: requestTypes.RequestApi.SEND_PRE_KEY_BUNDLE,
      payload: {},
    });
  }

  public async addPreKeys(userId: string, id: string, payload: requestTypes.addPreKeysPayload) {
    const { preKeys } = payload as requestTypes.addPreKeysPayload;
    const binaryPreKeys: PreKeyType<Binary>[] = [];
    for (const preKey of preKeys) {
      binaryPreKeys.push({
        keyId: preKey.keyId,
        publicKey: base64ToBinary(preKey.publicKey),
      });
    }
    await mongoApi.addPreKeys(new ObjectId(userId), binaryPreKeys);
    this.deliveryService.sendMessage(userId, {
      id,
      api: requestTypes.RequestApi.ADD_PRE_KEYS,
      payload: {},
    });
  }
}
