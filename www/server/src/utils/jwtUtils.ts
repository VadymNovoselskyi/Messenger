import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const JWT_KEY = process.env.JWT_KEY || "";

/**
 * Generates a JWT token for the given user _id.
 * @param userId - The user's unique identifier.
 * @returns A signed JWT token.
 */
export function generateJwtToken(userId: string): string {
  return jwt.sign({ userId }, JWT_KEY, { expiresIn: "7d" });
}

/**
 * Verifies a JWT token and returns the user _id.
 * @param token - The JWT token.
 * @returns The decoded JWT payload.
 */
export function verifyJwtToken(token: string): jwt.JwtPayload {
  const decoded = jwt.verify(token, JWT_KEY);
  if (typeof decoded === "string") {
    throw new Error("Decoded token is a string, expected an object.");
  }
  return decoded;
}
