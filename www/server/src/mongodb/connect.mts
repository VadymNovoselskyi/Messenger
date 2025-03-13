import dotenv from "dotenv";
import { MongoClient, Db, Collection, OptionalId } from "mongodb";
import { ChatDocument, MessageDocument, UserDocument } from "../types/types.mjs";

dotenv.config(); // Load .env variables into process.env
const MONGO_USERNAME = process.env.MONGO_USERNAME || "";
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || "";

// Initialize the MongoDB client. Consider moving the connection string to a config file.
const client = new MongoClient("mongodb://root:12345@mongodb");

await client.connect();
const db: Db = client.db("messenger");

// Export collections for reuse in API functions.
export const chatsCollection: Collection<OptionalId<ChatDocument>> = db.collection("chats");
export const usersCollection: Collection<OptionalId<UserDocument>> = db.collection("users");
export const messagesCollection: Collection<OptionalId<MessageDocument>> = db.collection("messages");