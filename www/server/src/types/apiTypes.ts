import { MessageType, PreKeyType } from "@privacyresearch/libsignal-protocol-typescript";
import { PreKeyBundle } from "./signalTypes.js";

export type ApiMessage = {
  _id: string;
  chatId: string;
  from: string;
  ciphertext: MessageType;
  sequence: number;
  sendTime: string;
};

export type ApiChat = {
  _id: string;
  users: ApiUser[];
  messages: ApiMessage[];
  lastSequence: number;
  lastModified: string;
};

export type ApiUser = {
  _id: string;
  username: string;
  lastReadSequence: number;
};
