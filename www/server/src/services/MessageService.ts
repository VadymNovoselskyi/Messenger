import { ObjectId } from "mongodb";
import * as requestTypes from "../types/requestTypes.js";
import * as notificationTypes from "../types/notificationTypes.js";
import * as mongoApi from "../mongodb/mongoApi.js";
import { DeliveryService } from "./DeliveryService.js";
import { toApiMessage } from "../utils/apiUtils.js";
import { OnlineUsersService } from "./OnlineUsersService.js";

export class MessageService {
  private static _instance: MessageService;

  private constructor(
    private deliveryService: DeliveryService,
    private onlineUsers: OnlineUsersService
  ) {}

  public static init(deliveryService: DeliveryService, onlineUsers: OnlineUsersService) {
    if (!this._instance) this._instance = new MessageService(deliveryService, onlineUsers);
    return this._instance;
  }

  public static get instance(): MessageService {
    if (!this._instance)
      throw new Error("MessageService not initialised - call MessageService.init() first");
    return this._instance;
  }

  public async sendMessage(userId: string, id: string, payload: requestTypes.sendMessagePayload) {
    const { chatId, ciphertext } = payload;
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
        api: requestTypes.RequestApi.SEND_MESSAGE,
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
  }

  public async sendPreKeyWhisperMessage(
    userId: string,
    id: string,
    payload: requestTypes.sendPreKeyWhisperMessagePayload
  ) {
    const { chatId, ciphertext } = payload;
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
      api: requestTypes.RequestApi.SEND_PRE_KEY_WHISPER_MESSAGE,
      payload: {},
    });
  }
}
