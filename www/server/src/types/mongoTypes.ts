import { ObjectId, Binary } from "mongodb";
import { MessageType, PreKeyType, SignedPublicPreKeyType } from "@privacyresearch/libsignal-protocol-typescript";

export type ChatDocument = {
  _id: ObjectId;
  users: {
    _id: ObjectId;
    username: string;
    lastReadSequence: number;
    lastAckSequence: number;
    lastAckReadSequence: number;
  }[];
  unacknowledgedBy?: ObjectId;
  lastSequence: number;
  lastModified: Date;
  lastMetadataChange: Date;
};

export type UserDocument = {
  _id: ObjectId;
  username: string;
  password: string;
  registrationId?: number;
  identityKey?: Binary;
  signedPreKey?: SignedPublicPreKeyType<Binary>;
  preKeys?: PreKeyType<Binary>[];
  lastMetadataSync: Date;
};

export type MessageDocument = {
  _id: ObjectId;
  chatId: ObjectId;
  from: ObjectId;
  ciphertext: MessageType;
  sequence: number;
  sendTime: Date;
};
