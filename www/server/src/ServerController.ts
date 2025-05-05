import { WebSocket } from "ws";
import { Binary, ObjectId } from "mongodb";

import * as requestTypes from "./types/requestTypes.js";
import * as notificationTypes from "./types/notificationTypes.js";
import * as mongoApi from "./mongodb/mongoApi.js";

import { DeliveryService } from "./DeliveryService.js";
import { OnlineUsersService } from "./OnlineUsersService.js";
import { AuthService } from "./AuthService.js";

import { PreKeyType } from "@privacyresearch/libsignal-protocol-typescript";
import { PreKeyBundle } from "./types/signalTypes.js";
import { toApiChatMetadata, toApiChat, toApiMessage } from "./utils/apiUtils.js";
import { binaryToBase64, base64ToBinary } from "./utils/parserUtils.js";

export class ServerController {
  private static _instance: ServerController;
  private authService: AuthService;

  private constructor(
    private deliveryService: DeliveryService,
    private onlineUsers: OnlineUsersService
  ) {
    this.authService = AuthService.init(this.deliveryService, this.onlineUsers);
  }

  public static init(deliveryService: DeliveryService, onlineUsers: OnlineUsersService) {
    if (!this._instance) this._instance = new ServerController(deliveryService, onlineUsers);
    return this._instance;
  }
  public static get instance(): ServerController {
    if (!this._instance)
      throw new Error("ServerController not initialised - call ServerController.init() first");
    return this._instance;
  }

  public async handleAuth(ws: WebSocket, token: string, id: string) {
    return this.authService.handleAuth(ws, token, id);
  }

  public async handleLogin(ws: WebSocket, payload: requestTypes.loginPayload, id: string) {
    return this.authService.handleLogin(ws, payload, id);
  }

  public async handleSignup(ws: WebSocket, payload: requestTypes.signupPayload, id: string) {
    return this.authService.handleSignup(ws, payload, id);
  }

  public async handleAuthenticatedCall(
    ws: WebSocket,
    userId: string,
    id: string,
    api: requestTypes.RequestApi,
    payload: requestTypes.RequestMessagePayload
  ): Promise<void> {
    try {
      switch (api) {
        case requestTypes.RequestApi.SYNC_ACTIVE_CHATS: {
          const { chatIds } = payload as requestTypes.syncActiveChatsPayload;
          const chats = await mongoApi.syncActiveChatsUpdates(
            new ObjectId(userId),
            chatIds.map(id => new ObjectId(id))
          );
  
          this.deliveryService.sendMessage(
            userId,
            {
              id,
              api,
              payload: { chats },
            },
            () => {
              for (const chat of chats) {
                const otherUserMetadata = chat.users.find(user => user._id.toString() !== userId)!;
                mongoApi.updateLastAckSequence(
                  new ObjectId(chat._id),
                  new ObjectId(userId),
                  chat.messages.at(-1)?.sequence ?? 0
                );
                mongoApi.updateLastAckReadSequence(
                  new ObjectId(chat._id),
                  new ObjectId(userId),
                  otherUserMetadata.lastReadSequence
                );
                if (!chat.messages.at(-1)) return;
                mongoApi.deletePreviousMessages(
                  new ObjectId(chat._id),
                  chat.messages.at(-1)!.sequence
                );
              }
            }
          );
          break;
        }
  
        case requestTypes.RequestApi.SYNC_ALL_CHATS_METADATA: {
          const { chats, unacknowledgedChats, isComplete } = await mongoApi.syncAllChatsMetadata(
            new ObjectId(userId)
          );
          this.deliveryService.sendMessage(
            userId,
            {
              id,
              api,
              payload: {
                chats,
                newChats: unacknowledgedChats.map(chat => toApiChatMetadata(chat)),
                isComplete,
              },
            },
            () => {
              const metadataSyncDate = isComplete
                ? new Date().toISOString()
                : chats.at(-1)?.lastModified ?? new Date().toISOString();
              mongoApi.updateLastMetadataSync(new ObjectId(userId), metadataSyncDate);
              for (const chat of unacknowledgedChats) {
                mongoApi.markChatAsAcknowledged(new ObjectId(chat._id), new ObjectId(userId));
              }
            }
          );
          break;
        }
  
        case requestTypes.RequestApi.SEND_READ_UPDATE: {
          const { chatId, sequence } = payload as requestTypes.sendReadUpdatePayload;
          const { receivingUserId } = await mongoApi.readUpdate(
            new ObjectId(userId),
            new ObjectId(chatId),
            sequence
          );
  
          const receivingUserWs = this.onlineUsers.getUser(receivingUserId.toString());
          if (receivingUserWs) {
            this.deliveryService.sendMessage(
              receivingUserId.toString(),
              {
                id,
                api: notificationTypes.NotificationApi.INCOMING_READ,
                payload: { chatId, sequence },
              },
              () => {
                mongoApi.updateLastAckReadSequence(
                  new ObjectId(chatId),
                  new ObjectId(receivingUserId),
                  sequence
                );
              }
            );
          }
          break;
        }
  
        case requestTypes.RequestApi.CREATE_CHAT: {
          const { username } = payload as requestTypes.createChatPayload;
          const { createdChat, receivingUserId, preKeyBundle } = await mongoApi.createChat(
            new ObjectId(userId),
            username
          );
          const createdApiChat = await toApiChat(createdChat, []);
          const stringifiedPreKeyBundle: PreKeyBundle<string> = {
            registrationId: preKeyBundle.registrationId,
            identityKey: binaryToBase64(preKeyBundle.identityKey),
            signedPreKey: {
              keyId: preKeyBundle.signedPreKey.keyId,
              publicKey: binaryToBase64(preKeyBundle.signedPreKey.publicKey),
              signature: binaryToBase64(preKeyBundle.signedPreKey.signature),
            },
            preKeys: [
              {
                keyId: preKeyBundle.preKeys[0].keyId,
                publicKey: binaryToBase64(preKeyBundle.preKeys[0].publicKey),
              },
            ],
          };
          this.deliveryService.sendMessage(userId, {
            id,
            api,
            payload: { createdChat: createdApiChat, preKeyBundle: stringifiedPreKeyBundle },
          });
  
          const receivingUserWs = this.onlineUsers.getUser(receivingUserId.toString());
          if (receivingUserWs) {
            this.deliveryService.sendMessage(
              receivingUserId.toString(),
              {
                id,
                api: notificationTypes.NotificationApi.INCOMING_CHAT,
                payload: { createdChat: createdApiChat },
              },
              () => {
                mongoApi.markChatAsAcknowledged(
                  new ObjectId(createdChat._id),
                  new ObjectId(receivingUserId)
                );
              }
            );
          }
          break;
        }
  
        case requestTypes.RequestApi.SEND_PRE_KEY_BUNDLE: {
          let { preKeyBundle } = payload as requestTypes.sendPreKeyBundlePayload;
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
            api,
            payload: {},
          });
          break;
        }
  
        case requestTypes.RequestApi.ADD_PRE_KEYS: {
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
            api,
            payload: {},
          });
          break;
        }
  
        case requestTypes.RequestApi.SEND_PRE_KEY_WHISPER_MESSAGE: {
          const { chatId, ciphertext } = payload as requestTypes.sendPreKeyWhisperMessagePayload;
          const { sentMessage, receivingUserId } = await mongoApi.sendPreKeyWhisperMessage(
            new ObjectId(userId),
            new ObjectId(chatId),
            ciphertext
          );
  
          const receivingUserWs = this.onlineUsers.getUser(receivingUserId.toString());
          if (receivingUserWs) {
            this.deliveryService.sendMessage(receivingUserId.toString(), {
              id,
              api: notificationTypes.NotificationApi.INCOMING_MESSAGE,
              payload: { chatId, message: toApiMessage(sentMessage) },
            });
          }
  
          this.deliveryService.sendMessage(userId, {
            id,
            api,
            payload: {},
          });
          break;
        }
  
        case requestTypes.RequestApi.SEND_MESSAGE: {
          const { chatId, ciphertext } = payload as requestTypes.sendMessagePayload;
          const { sentMessage, receivingUserId } = await mongoApi.sendMessage(
            new ObjectId(userId),
            new ObjectId(chatId),
            ciphertext
          );
  
          const receivingUserWs = this.onlineUsers.getUser(receivingUserId.toString());
          if (receivingUserWs) {
            this.deliveryService.sendMessage(
              receivingUserId.toString(),
              {
                id,
                api: notificationTypes.NotificationApi.INCOMING_MESSAGE,
                payload: { chatId, message: toApiMessage(sentMessage) },
              },
              () => {
                mongoApi.updateLastAckSequence(
                  new ObjectId(chatId),
                  new ObjectId(receivingUserId),
                  sentMessage.sequence
                );
                mongoApi.updateLastAckReadSequence(
                  new ObjectId(chatId),
                  new ObjectId(receivingUserId),
                  sentMessage.sequence
                );
                mongoApi.deletePreviousMessages(new ObjectId(chatId), sentMessage.sequence);
              }
            );
          }
  
          this.deliveryService.sendMessage(
            userId,
            {
              id,
              api,
              payload: { sentMessage: toApiMessage(sentMessage) },
            },
            () => {
              mongoApi.updateLastAckSequence(
                new ObjectId(chatId),
                new ObjectId(userId),
                sentMessage.sequence
              );
            }
          );
          break;
        }
  
        default: {
          console.error(`Unknown api call: ${api}`);
          this.deliveryService.sendError(ws, id, { message: "Invalid api call" });
          break;
        }
      }
    } catch (error) {
      throw error;
    }
  }
  
}
