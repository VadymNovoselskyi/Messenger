import { MongoClient } from "mongodb";
const client = new MongoClient("mongodb://root:12345@mongodb");
await client.connect();
const db = client.db("messenger");
export const chats = db.collection("chats");
export const users = db.collection("users");
export const messages = db.collection("messages");
