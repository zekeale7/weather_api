import { MongoClient } from "mongodb";

export const db_client = new MongoClient("mongodb://localhost:27117")
export const db = db_client.db("weather");