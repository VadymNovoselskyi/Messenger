import bcrypt from "bcrypt";

import { chatsCollection, usersCollection, messagesCollection } from "./connect.mjs";
import { binaryToBase64 } from "../utils.mjs";

import { ObjectId } from "mongodb";
import { MessageType } from "@privacyresearch/libsignal-protocol-typescript";

import { ChatDocument, MessageDocument, UserDocument } from "../types/mongoTypes.mjs";
import { BinaryPreKeyBundle, StringifiedPreKeyBundle } from "../types/signalTypes.mjs";
import { ApiChat, ApiMessage, ApiUser } from "../types/apiTypes.mjs";

// Constants to manage pagination limits.
const INIT_CHATS = 10;
const INIT_MESSAGES = 40;
const EXTRA_MESSAGES = 60;

/**
 * Retrieves the list of chats for a given user.
 */
export async function getChats(userId: ObjectId): Promise<ApiChat[]> {
  try {
    // Fetch recent chat documents where the user is a participant.
    const chatDocuments: ChatDocument[] = await chatsCollection
      .find({ "users._id": userId })
      .sort({ lastModified: -1 })
      .limit(INIT_CHATS)
      .toArray();

    // Transform each document into a structured Chat.
    const chats: ApiChat[] = await Promise.all(
      chatDocuments.map(async (chatDocument: ChatDocument) => {
        const { lastReadSequence } = chatDocument.users.find(user => user._id.equals(userId))!;

        // Count unread messages since last seen.
        const unreadCount = await messagesCollection.countDocuments({
          chatId: chatDocument._id.toString,
          from: { $ne: userId },
          sequence: { $gt: lastReadSequence },
        });

        const unreadSkip = Math.max(unreadCount - INIT_MESSAGES, 0);

        // Retrieve the recent messages while accounting for unread count.
        const messages = await messagesCollection
          .find({ chatId: chatDocument._id })
          .sort({ sendTime: -1 })
          .skip(unreadSkip)
          .limit(INIT_MESSAGES + Math.min(unreadCount, INIT_MESSAGES))
          .toArray();

        return {
          _id: chatDocument._id.toString(),
          users: chatDocument.users,
          messages: messages.reverse(),
          lastReadSequence,
          lastModified: chatDocument.lastModified,
        } as unknown as ApiChat; //CHANGE
      })
    );

    return chats;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error fetching chats for user ID ${userId}: ${errMsg}`);
  }
}

/**
 * Inserts a new message into a chat and updates the chat's timestamp.
 */
export async function sendEncMessage(
  userId: ObjectId,
  chatId: ObjectId,
  ciphertext: MessageType
): Promise<{ sentMessage: MessageDocument; receivingUserId: ObjectId }> {
  try {
    const result = await chatsCollection.findOneAndUpdate(
      { _id: chatId },
      {
        $inc: { lastSequence: ciphertext.type === 1 ? 1 : 0 },
        $set: { lastModified: new Date() },
      },
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
      sendTime: new Date(),
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
    throw new Error(`Error sending message in chat ID ${chatId}: ${errMsg}`);
  }
}

/**
 * Updates a user's last seen timestamp in a chat when a message is read.
 */
export async function readUpdate(
  userId: ObjectId,
  chatId: ObjectId,
  sequence: number
): Promise<{ receivingUserId: ObjectId }> {
  try {
    const message = await messagesCollection.findOne({ chatId, sequence });
    if (!message) throw new Error(`Didn't find message ${sequence}`);

    await chatsCollection.updateOne(
      { _id: chatId },
      { $set: { "users.$[user].lastReadSequence": sequence } },
      { arrayFilters: [{ "user._id": userId }] }
    );

    const chat = await chatsCollection.findOne({ _id: chatId });
    if (!chat) throw new Error(`Couldn't find chat for chatId ${chatId}`);

    const receivingUserId = chat.users.find(user => !user._id.equals(userId))!._id;
    return { receivingUserId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error updating readTime in chat ID ${chatId}: ${errMsg}`);
  }
}

/**
 * Retrieves additional messages for pagination.
 */
export async function getExtraMessages(
  chatId: ObjectId,
  currentIndex: number
): Promise<MessageDocument[]> {
  try {
    const extraMessages = await messagesCollection
      .find({ chatId })
      .sort({ sendTime: -1 })
      .skip(currentIndex)
      .limit(EXTRA_MESSAGES)
      .toArray();
    return extraMessages.reverse();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error getting extra messages in chat ID ${chatId}: ${errMsg}`);
  }
}

/**
 * Retrieves new messages based on the unread count.
 */
export async function getExtraNewMessages(
  chatId: ObjectId,
  unreadCount: number
): Promise<MessageDocument[]> {
  try {
    const unreadSkip = Math.max(unreadCount - EXTRA_MESSAGES, 0);
    const extraNewMessages = await messagesCollection
      .find({ chatId })
      .sort({ sendTime: -1 })
      .skip(unreadSkip)
      .limit(Math.min(unreadCount, EXTRA_MESSAGES))
      .toArray();
    return extraNewMessages.reverse();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error getting new messages in chat ID ${chatId}: ${errMsg}`);
  }
}

/**
 * Marks all messages in a chat as read by updating the user's last seen timestamp.
 */
export async function readAll(chatId: ObjectId, userId: ObjectId): Promise<void> {
  try {
    const lastMessage: MessageDocument[] = await messagesCollection
      .find({ chatId })
      .sort({ sendTime: -1 })
      .limit(1)
      .toArray();

    const { sendTime } = lastMessage[0];
    await chatsCollection.updateOne(
      { _id: chatId },
      { $set: { "users.$[user].lastSeen": sendTime } },
      { arrayFilters: [{ "user._id": userId }] }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error reading all: ${errMsg}`);
  }
}

/**
 * Creates a new chat between the creator and the specified recipient.
 */
export async function createChat(
  creatingUID: ObjectId,
  receivingUsername: string
): Promise<{
  createdChat: ChatDocument;
  receivingUserId: ObjectId;
  preKeyBundle: StringifiedPreKeyBundle;
}> {
  try {
    const creatingUser = await usersCollection.findOne({ _id: creatingUID });
    const receivingUser = await usersCollection.findOne({ username: receivingUsername });

    if (!creatingUser || !receivingUser) {
      throw new Error(`Receiving user "${receivingUsername}" not found.`);
    }
    if (creatingUser._id.equals(receivingUser._id)) {
      throw new Error(`You can't create a chat with yourself.`);
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

    const result = await chatsCollection.insertOne({
      users: [
        { _id: creatingUser._id, username: creatingUser.username, lastReadSequence: 0 },
        { _id: receivingUser._id, username: receivingUser.username, lastReadSequence: 0 },
      ],
      lastSequence: 0,
      lastModified: new Date(),
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
    const preKeyBundle: StringifiedPreKeyBundle = {
      registrationId: registrationId!,
      identityKey: binaryToBase64(identityKey!),
      signedPreKey: {
        keyId: signedPreKey!.keyId,
        publicKey: binaryToBase64(signedPreKey!.publicKey),
        signature: binaryToBase64(signedPreKey!.signature),
      },
      preKeys: [
        {
          keyId: preKeys![randomIndex].keyId,
          publicKey: binaryToBase64(preKeys![randomIndex].publicKey),
        },
      ],
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
 */
export async function createUser(
  username: string,
  password: string,
  preKeyBundle: BinaryPreKeyBundle
): Promise<ObjectId> {
  try {
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      throw new Error(`User with username "${username}" already exists.`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { insertedId } = await usersCollection.insertOne({
      username,
      password: hashedPassword,
      ...preKeyBundle,
    });
    return insertedId;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Error creating user "${username}": ${errMsg}`);
  }
}

/**
 * Saves user's preKeyBundle to be used in X3DH.
 */
export async function savePreKeys(userId: ObjectId, preKeyBundle: BinaryPreKeyBundle) {
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
 * Finds and returns a user by their username.
 */
export async function findUser(username: string): Promise<UserDocument> {
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

export async function findChat(chatId: ObjectId): Promise<ChatDocument> {
  const chat = await chatsCollection.findOne({ _id: chatId });
  if (!chat) throw new Error(`Chat with id ${chatId} not found`);
  return chat;
}
