import { describe, expect, it, beforeAll } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "../src/lib/crypto";

describe("AES-256-GCM secret encryption", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_MASTER_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("encrypts and decrypts secrets round-trip", () => {
    const secret = "ghp_superSecretTokenValue_123456";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("produces unique ciphertexts for identical plaintexts", () => {
    const a = encryptSecret("identical");
    const b = encryptSecret("identical");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("identical");
    expect(decryptSecret(b)).toBe("identical");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("sensitive");
    const parts = encrypted.split(":");
    parts[3] = "tamperedPayload";
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("masks secrets cleanly", () => {
    expect(maskSecret("short")).toBe("••••••");
    expect(maskSecret("ghp_1234567890")).toBe("gh••••••90");
  });
});
