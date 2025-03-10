import { MongoClient, Db, Collection, OptionalId } from "mongodb";
import { ChatDocument, MessageDocument, UserDocument } from "../types/types.mjs";

const client = new MongoClient("mongodb://root:12345@mongodb");

await client.connect();

const db: Db = client.db("messenger");

export const chatsCollection: Collection<OptionalId<ChatDocument>> = db.collection("chats");
export const usersCollection: Collection<OptionalId<UserDocument>> = db.collection("users");
export const messagesCollection: Collection<OptionalId<MessageDocument>> = db.collection("messages");
