import { MongoClient } from 'mongodb';


const client = new MongoClient("mongodb://root:12345@mongodb");
await client.connect()
const db = client.db('world')

export const country = db.collection('country')
export const city = db.collection('city')