import { Binary } from "mongodb";

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