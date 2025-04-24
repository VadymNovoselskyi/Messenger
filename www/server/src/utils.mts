import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import type WebSocket from "ws";
import { Binary } from "mongodb";
import { API, responsePayload } from "./types/apiTypes.mjs";

dotenv.config();
const JWT_KEY = process.env.JWT_KEY || "";

/**
 * Generates a JWT token for the given user ID.
 * @param userId - The user's unique identifier.
 * @returns A signed JWT token.
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_KEY, { expiresIn: "7d" });
}

/**
 * Sends a standardized JSON response over the WebSocket.
 *
 * @param {WebSocket} ws - The WebSocket connection to send the response through.
 * @param {types.API} [api] - (Optional) The API endpoint identifier for the response.
 * @param {string} [id] - (Optional) The unique identifier of the API call.
 * @param {"SUCCESS" | "ERROR"} [status] - (Optional) The status of the response.
 * @param {types.response} [payload] - (Optional) The response payload data.
 * @returns {void}
 */
export function sendResponse(
  ws: WebSocket,
  api?: API,
  id?: string,
  status?: "SUCCESS" | "ERROR",
  payload?: responsePayload
): void {
  // console.log(JSON.stringify({ api, id, status, payload }));
  ws.send(JSON.stringify({ api, id, status, payload }));
}

/**
 * Converts a Base64 encoded string to Binary.
 * @param base64 The Base64 encoded string.
 */
export function base64ToBinary(base64: string) {
  const binaryString = Buffer.from(base64, "base64").toString("binary");
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Binary(Buffer.from(new Uint8Array(bytes.buffer)));
}

/**
 * Converts a MongoDB Binary object to a Base64 encoded string.
 * @param binary The MongoDB Binary object.
 * @returns The Base64 encoded string.
 */
export function binaryToBase64(binary: Binary): string {
  const buf = Buffer.from(new Uint8Array(binary.buffer));
  return buf.toString("base64");
}
