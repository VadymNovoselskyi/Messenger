import bcrypt from "bcrypt";
import { Binary, ObjectId } from "mongodb";
import { MessageType, PreKeyType } from "@privacyresearch/libsignal-protocol-typescript";
import { chatsCollection, usersCollection, messagesCollection } from "./connect.js";

import { ChatDocument, MessageDocument, UserDocument } from "../types/mongoTypes.js";
import { ApiChat } from "../types/apiTypes.js";
import { toApiChat, toApiChatMetadata } from "../utils/apiUtils.js";
import { PreKeyBundle } from "../types/signalTypes.js";

// Constants to manage pagination limits.
const MAX_CHATS_MESSAGE_SYNC = 10;
const MAX_CHATS_METADATA_SYNC = 50;
const MAX_MESSAGES = 50;
const METADATA_SYNC_OFFSET = 1000 * 60;

/**
 * Retrieves the list of chats for a given user.
 * @param userId - The _id of the user to retrieve chats for.
 * @param chatIds - An optional array of chat _ids to filter the results.
 * @returns A promise that resolves to an array of ApiChat objects.
 */
export async function syncActiveChatsUpdates(
  userId: ObjectId,
  chatIds: ObjectId[]
): Promise<ApiChat[]> {
  try {
    const chatDocuments: ChatDocument[] = await chatsCollection
      .find({ _id: { $in: chatIds }, "users._id": userId })
      .limit(MAX_CHATS_MESSAGE_SYNC)
      .toArray();

    const chats: ApiChat[] = await Promise.all(
      chatDocuments.map(async chatDocument => {
        const { lastAckSequence } = chatDocument.users.find(user => user._id.equals(userId))!;

        const messages = await messagesCollection
          .find({
            chatId: chatDocument._id,
            from: { $ne: userId },
            sequence: { $gt: lastAckSequence ? lastAckSequence : -1 },
          })
          .sort({ sendTime: 1 })
          .limit(MAX_MESSAGES)
          .toArray();

        return toApiChat(chatDocument, messages);
      })
    );

    return chats;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error syncing active chats updates for user _id ${userId}: ${errMsg}`);
  }
}

/**
 * Retrieves all chats for a given user with metadata.
 * @param userId - The _id of the user to retrieve chats for.
 * @returns A promise that resolves to an array of ApiChat objects.
 */
export async function syncAllChatsMetadata(
  userId: ObjectId
): Promise<{ chats: ApiChat[]; unacknowledgedChats: ChatDocument[]; isComplete: boolean }> {
  try {
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) throw new Error(`User with id ${userId} not found`);
    let lastMetadataSync = user.lastMetadataSync;
    lastMetadataSync ??= new Date();

    const offsetMetadataSyncDate = new Date(lastMetadataSync.getTime() - METADATA_SYNC_OFFSET);
    const chatDocuments: ChatDocument[] = await chatsCollection
      .find({
        "users._id": userId,
        $or: [
          { lastModified: { $gte: offsetMetadataSyncDate } },
          { lastMetadataChange: { $gte: offsetMetadataSyncDate } },
        ],
      })
      .limit(MAX_CHATS_METADATA_SYNC)
      .sort({ lastModified: 1 })
      .toArray();

    const unacknowledgedChats = chatDocuments.filter(chat => chat.unacknowledgedBy?.equals(userId));
    const chats: ApiChat[] = chatDocuments
      .filter(chat => !chat.unacknowledgedBy?.equals(userId))
      .map(toApiChatMetadata);

    return {
      chats,
      unacknowledgedChats,
      isComplete: chatDocuments.length <= MAX_CHATS_METADATA_SYNC,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error syncing all chats metadata for user _id ${userId}: ${errMsg}`);
  }
}

/**
 * Inserts a new message into a chat and updates the chat's timestamp.
 * @param userId - The _id of the user to send the message.
 * @param chatId - The _id of the chat to send the message to.
 * @param ciphertext - The ciphertext of the message to send.
 * @returns A promise that resolves to an object containing the sent message and the _id of the receiving user.
 */
export async function sendMessage(
  userId: ObjectId,
  chatId: ObjectId,
  ciphertext: MessageType
): Promise<{ sentMessage: MessageDocument; receivingUserId: ObjectId }> {
  try {
    const now = new Date();
    const result = await chatsCollection.findOneAndUpdate(
      { _id: chatId, "users._id": userId },
      [
        { $set: { lastSequence: { $add: ["$lastSequence", 1] } } },
        {
          $set: {
            users: {
              $map: {
                input: "$users",
                as: "user",
                in: {
                  $cond: [
                    { $eq: ["$$user._id", userId] },
                    { $mergeObjects: ["$$user", { lastReadSequence: "$lastSequence" }] },
                    "$$user",
                  ],
                },
              },
            },
            lastModified: now,
          },
        },
      ],
      { returnDocument: "after" }
    );
    if (!result) {
      throw new Error(`Chat ${chatId} not found`);
    }
    const newSeq = result.lastSequence;
    const { acknowledged, insertedId } = await messagesCollection.insertOne({
      chatId,
      from: userId,
      ciphertext,
      sequence: newSeq,
      sendTime: now,
    });
    if (!acknowledged || !insertedId) {
      throw new Error(`Failed to insert message in chat ${chatId}`);
    }

    const sentMessage = await messagesCollection.findOne({ _id: insertedId });
    if (!sentMessage) {
      throw new Error(`Inserted message ${insertedId} not found`);
    }

    const receivingUserId = result.users.find(user => !user._id.equals(userId))!._id;

    return { sentMessage, receivingUserId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error sending message in chat _id ${chatId}: ${errMsg}`);
  }
}

/**
 * Inserts a new preKeyWhisperMessage into a chat and updates the chat's timestamp.
 * @param userId - The _id of the user to send the message.
 * @param chatId - The _id of the chat to send the message to.
 * @param ciphertext - The ciphertext of the message to send.
 * @returns A promise that resolves to an object containing the sent message and the _id of the receiving user.
 */
export async function sendPreKeyWhisperMessage(
  userId: ObjectId,
  chatId: ObjectId,
  ciphertext: MessageType
): Promise<{ sentMessage: MessageDocument; receivingUserId: ObjectId }> {
  try {
    const now = new Date();
    const result = await chatsCollection.findOneAndUpdate(
      { _id: chatId },
      { $set: { lastSequence: 0, lastModified: now } },
      { returnDocument: "after" }
    );
    if (!result) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const { acknowledged, insertedId } = await messagesCollection.insertOne({
      chatId,
      from: userId,
      ciphertext,
      sequence: 0,
      sendTime: now,
    });
    if (!acknowledged || !insertedId) {
      throw new Error(`Failed to insert message in chat ${chatId}`);
    }

    const sentMessage = await messagesCollection.findOne({ _id: insertedId });
    if (!sentMessage) {
      throw new Error(`Inserted message ${insertedId} not found`);
    }

    const receivingUserId = result.users.find(user => !user._id.equals(userId))!._id;

    return { sentMessage, receivingUserId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error sending message in chat _id ${chatId}: ${errMsg}`);
  }
}

/**
 * Updates a user's last seen timestamp in a chat when a message is read.
 * @param userId - The _id of the user to update the last seen timestamp for.
 * @param chatId - The _id of the chat to update the last seen timestamp for.
 * @param sequence - The sequence number of the message that was read.
 * @returns A promise that resolves to an object containing the _id of the receiving user.
 */
export async function readUpdate(
  userId: ObjectId,
  chatId: ObjectId,
  sequence: number
): Promise<{ receivingUserId: ObjectId }> {
  try {
    const chat = await chatsCollection.findOneAndUpdate(
      {
        _id: chatId,
        lastSequence: { $gte: sequence },
        "users._id": userId,
      },
      { $set: { "users.$.lastReadSequence": sequence, lastMetadataChange: new Date() } }
    );
    if (!chat) throw new Error(`Couldn't find chat for chatId ${chatId}`);

    const receivingUserId = chat.users.find(user => !user._id.equals(userId))!._id;
    return { receivingUserId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error updating readTime in chat _id ${chatId}: ${errMsg}`);
  }
}

/**
 * Creates a new chat between the creator and the specified recipient.
 * @param creatingUserId - The _id of the user to create the chat.
 * @param receivingUsername - The username of the user to create the chat with.
 * @returns A promise that resolves to an object containing the created chat, the _id of the receiving user, and the preKeyBundle.
 */
export async function createChat(
  creatingUserId: ObjectId,
  receivingUsername: string
): Promise<{
  createdChat: ChatDocument;
  receivingUserId: ObjectId;
  preKeyBundle: PreKeyBundle<Binary>;
}> {
  try {
    const creatingUser = await usersCollection.findOne({ _id: creatingUserId });
    const receivingUser = await usersCollection.findOne({ username: receivingUsername });

    if (!creatingUser || !receivingUser) {
      throw new Error(`Receiving user "${receivingUsername}" not found.`);
    }
    if (creatingUser._id.equals(receivingUser._id)) {
      throw new Error(`You can't create a chat with yourself.`);
    }
    if (
      !receivingUser.registrationId ||
      !receivingUser.identityKey ||
      !receivingUser.signedPreKey ||
      !receivingUser.preKeys
    ) {
      throw new Error(`Receiving user "${receivingUsername}" doesn't have a preKeyBundle.`);
    }

    // Ensure that a chat between the two users doesn't already exist.
    const presentChat = await chatsCollection.findOne({
      users: {
        $all: [
          { $elemMatch: { username: creatingUser.username } },
          { $elemMatch: { username: receivingUser.username } },
        ],
      },
    });

    if (presentChat) {
      throw new Error(
        `Chat between "${creatingUser.username}" and "${receivingUser.username}" already exists.`
      );
    }

    const now = new Date();
    const result = await chatsCollection.insertOne({
      users: [
        {
          _id: creatingUser._id,
          username: creatingUser.username,
          lastReadSequence: 0,
          lastAckSequence: 0,
          lastAckReadSequence: 0,
        },
        {
          _id: receivingUser._id,
          username: receivingUser.username,
          lastReadSequence: 0,
          lastAckSequence: 0,
          lastAckReadSequence: 0,
        },
      ],
      unacknowledgedBy: receivingUser._id,
      lastSequence: 0,
      lastModified: now,
      lastMetadataChange: now,
    });

    if (!result.acknowledged || !result.insertedId) {
      throw new Error("Failed to create chat. Insert operation was not acknowledged.");
    }

    const createdChat: ChatDocument | null = await chatsCollection.findOne({
      _id: result.insertedId,
    });
    if (!createdChat) {
      throw new Error("Failed to retrieve the newly created chat.");
    }

    //Get the preKeyBundle
    const { registrationId, identityKey, signedPreKey, preKeys } = receivingUser;
    const randomIndex = Math.floor(Math.random() * preKeys!.length);
    const preKeyBundle: PreKeyBundle<Binary> = {
      registrationId: registrationId!,
      identityKey: identityKey!,
      signedPreKey: signedPreKey!,
      preKeys: [preKeys![randomIndex]],
    };

    await usersCollection.updateOne(
      { _id: receivingUser._id },
      { $unset: { [`preKeys.${randomIndex}`]: 1 } } //will set to null
    );
    await usersCollection.updateOne(
      { _id: receivingUser._id },
      { $pull: { preKeys: null as unknown as undefined } } //wil remove all null
    );

    return { createdChat, receivingUserId: receivingUser._id, preKeyBundle };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error creating chat: ${errMsg}`);
  }
}

/**
 * Registers a new user with a hashed password.
 * @param username - The username of the user to create.
 * @param password - The password of the user to create.
 * @returns A promise that resolves to the _id of the created user.
 */
export async function createUser(username: string, password: string): Promise<ObjectId> {
  try {
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      throw new Error(`User with username "${username}" already exists.`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { insertedId } = await usersCollection.insertOne({
      username,
      password: hashedPassword,
      lastMetadataSync: new Date(),
    });
    return insertedId;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error creating user "${username}": ${errMsg}`);
  }
}

/**
 * Saves user's preKeyBundle to be used in X3DH.
 * @param userId - The _id of the user to save the preKeyBundle for.
 * @param preKeyBundle - The preKeyBundle to save.
 */
export async function savePreKeyBundle(userId: ObjectId, preKeyBundle: PreKeyBundle<Binary>) {
  try {
    const { modifiedCount } = await usersCollection.updateOne(
      { _id: userId },
      { $set: preKeyBundle }
    );

    if (!modifiedCount) throw new Error(`Couldn't add keys for userId: ${userId}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error adding preKeyBundle: ${errMsg}`);
  }
}

/**
 * Adds user's preKeys to be used in X3DH.
 * @param userId - The _id of the user to add the preKeys for.
 * @param preKeys - The preKeys to add.
 */
export async function addPreKeys(userId: ObjectId, preKeys: PreKeyType<Binary>[]) {
  try {
    const { modifiedCount } = await usersCollection.updateOne(
      { _id: userId },
      { $push: { preKeys: { $each: preKeys } } }
    );

    if (!modifiedCount) throw new Error(`Couldn't add keys for userId: ${userId}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error adding preKeys: ${errMsg}`);
  }
}

/**
 * Updates a user's lastAckSequence in a chat.
 * @param chatId - The _id of the chat to update the lastAckSequence for.
 * @param userId - The _id of the user to update the lastAckSequence for.
 * @param sequence - The sequence number of the message that was read.
 */
export async function updateLastAckSequence(chatId: ObjectId, userId: ObjectId, sequence: number) {
  try {
    await chatsCollection.updateOne(
      { _id: chatId, "users._id": userId },
      { $max: { "users.$.lastAckSequence": sequence } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error updating lastAckSequence: ${errMsg}`);
  }
}

/**
 * Updates a user's lastAckReadSequence in a chat.
 * @param chatId - The _id of the chat to update the lastAckReadSequence for.
 * @param userId - The _id of the user to update the lastAckReadSequence for.
 * @param sequence - The sequence number of the message that was read.
 */
export async function updateLastAckReadSequence(
  chatId: ObjectId,
  userId: ObjectId,
  sequence: number
) {
  try {
    await chatsCollection.updateOne(
      { _id: chatId, "users._id": userId },
      { $max: { "users.$.lastAckReadSequence": sequence } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error updating lastAckReadSequence: ${errMsg}`);
  }
}

/**
 * Deletes messages from a chat that are older than the given sequence.
 * @param chatId - The _id of the chat to delete messages from.
 * @param sequence - The sequence number of the message that was read.
 */
export async function deletePreviousMessages(chatId: ObjectId, sequence: number) {
  try {
    await messagesCollection.deleteMany({ chatId, sequence: { $lte: sequence } });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error deleting messages: ${errMsg}`);
  }
}

/**
 * Marks a chat as acknowledged by a user.
 * @param chatId - The _id of the chat to mark as acknowledged.
 * @param userId - The _id of the user to mark the chat as acknowledged for.
 */
export async function markChatAsAcknowledged(chatId: ObjectId, userId: ObjectId) {
  try {
    await chatsCollection.updateOne(
      { _id: chatId, unacknowledgedBy: userId },
      { $unset: { unacknowledgedBy: 1 } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error marking chat as acknowledged: ${errMsg}`);
  }
}

/**
 * Updates a user's lastMetadataSync timestamp.
 * @param userId - The _id of the user to update the lastMetadataSync for.
 * @param date - The date to update the lastMetadataSync to.
 */
export async function updateLastMetadataSync(userId: ObjectId, date: string) {
  try {
    await usersCollection.updateOne(
      { _id: userId },
      { $set: { lastMetadataSync: new Date(date) } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error updating lastMetadataSync: ${errMsg}`);
  }
}

/**
 * Finds and returns a user by their username.
 * @param username - The username of the user to find.
 * @returns A promise that resolves to the user document.
 */
export async function findUserByName(username: string): Promise<UserDocument> {
  try {
    const user = await usersCollection.findOne({ username });
    if (!user) {
      throw new Error(`User with username "${username}" not found.`);
    }
    return user;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error finding user with username "${username}": ${errMsg}`);
  }
}

/**
 * Finds and returns a user by their _id.
 * @param userId - The _id of the user to find.
 * @returns A promise that resolves to the user document.
 */
export async function findUserById(userId: ObjectId): Promise<UserDocument> {
  try {
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      throw new Error(`User with id "${userId}" not found.`);
    }
    return user;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error finding user with id "${userId}": ${errMsg}`);
  }
}

/**
 * Finds and returns a chat by its _id.
 * @param chatId - The _id of the chat to find.
 * @returns A promise that resolves to the chat document.
 */
export async function findChat(chatId: ObjectId): Promise<ChatDocument> {
  const chat = await chatsCollection.findOne({ _id: chatId });
  if (!chat) throw new Error(`Chat with id ${chatId} not found`);
  return chat;
}
