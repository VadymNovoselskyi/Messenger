import { ObjectId } from "mongodb";
import * as requestTypes from "../types/requestTypes.js";
import * as notificationTypes from "../types/notificationTypes.js";
import * as mongoApi from "../mongodb/mongoApi.js";
import { DeliveryService } from "./DeliveryService.js";
import { OnlineUsersService } from "./OnlineUsersService.js";

import { toApiChat, toApiChatMetadata } from "../utils/apiUtils.js";
import { binaryToBase64 } from "../utils/parserUtils.js";
import { PreKeyBundle } from "../types/signalTypes.js";

export class ChatService {
  private static _instance: ChatService;

  private constructor(
    private deliveryService: DeliveryService,
    private onlineUsers: OnlineUsersService
  ) {}

  public static init(deliveryService: DeliveryService, onlineUsers: OnlineUsersService) {
    if (!this._instance) this._instance = new ChatService(deliveryService, onlineUsers);
    return this._instance;
  }

  public static get instance(): ChatService {
    if (!this._instance)
      throw new Error("ChatService not initialised - call ChatService.init() first");
    return this._instance;
  }

  public async syncActiveChats(
    userId: string,
    id: string,
    payload: requestTypes.syncActiveChatsPayload
  ) {
    const { chatIds } = payload;
    const chats = await mongoApi.syncActiveChatsUpdates(
      new ObjectId(userId),
      chatIds.map(id => new ObjectId(id))
    );

    this.deliveryService.sendMessage(
      userId,
      {
        id,
        api: requestTypes.RequestApi.SYNC_ACTIVE_CHATS,
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
          mongoApi.deletePreviousMessages(new ObjectId(chat._id), chat.messages.at(-1)!.sequence);
        }
      }
    );
  }

  public async syncAllChatsMetadata(userId: string, id: string) {
    const { chats, unacknowledgedChats, isComplete } = await mongoApi.syncAllChatsMetadata(
      new ObjectId(userId)
    );
    this.deliveryService.sendMessage(
      userId,
      {
        id,
        api: requestTypes.RequestApi.SYNC_ALL_CHATS_METADATA,
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
  }

  public async sendReadUpdate(
    userId: string,
    id: string,
    payload: requestTypes.sendReadUpdatePayload
  ) {
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
  }

  public async createChat(userId: string, id: string, payload: requestTypes.createChatPayload) {
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
      api: requestTypes.RequestApi.CREATE_CHAT,
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
  }
}
