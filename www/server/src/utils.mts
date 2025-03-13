import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import type WebSocket from "ws";
import { API, responsePayload } from "./types/types.mjs";
dotenv.config(); // Load .env variables into process.env

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
