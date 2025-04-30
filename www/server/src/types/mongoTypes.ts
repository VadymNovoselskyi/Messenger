import { ObjectId, Binary } from "mongodb";
import { ApiUser } from "./apiTypes.js";
import { BinarySignedPreKey, BinaryPreKey } from "./signalTypes.js";
import { MessageType } from "@privacyresearch/libsignal-protocol-typescript";

export type ChatDocument = {
  _id: ObjectId;
  users: {
    _id: ObjectId;
    username: string;
    lastReadSequence: number;
    lastAckSequence: number;
    lastAckReadSequence: number;
  }[];
  lastSequence: number;
  lastModified: Date;
};

export type UserDocument = {
  _id: ObjectId;
  username: string;
  registrationId: number;
  identityKey: Binary;
  signedPreKey: BinarySignedPreKey;
  preKeys: BinaryPreKey[];
  password: string;
};

export type MessageDocument = {
  _id: ObjectId;
  chatId: ObjectId;
  from: ObjectId;
  ciphertext: MessageType;
  sequence: number;
  sendTime: Date;
};
