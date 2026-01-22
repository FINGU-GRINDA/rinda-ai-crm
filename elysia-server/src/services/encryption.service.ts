import crypto from "node:crypto"
import { config } from "../config"

class EncryptionService {
  private readonly algorithm = "aes-256-gcm"
  private readonly key: Buffer

  constructor() {
    const envKey = config.ENCRYPTION_KEY
    if (!envKey) {
      throw new Error("ENCRYPTION_KEY environment variable is required")
    }
    // Use crypto.scryptSync to derive a key from the environment variable
    this.key = crypto.scryptSync(envKey, "salt", 32)
  }

  encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv)

    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")

    const authTag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    }
  }

  decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(iv, "hex"))

    decipher.setAuthTag(Buffer.from(authTag, "hex"))

    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  }

  generateSecureToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString("hex")
  }
}

export const encryptionService = new EncryptionService()
