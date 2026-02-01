const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const KEY = Buffer.from(process.env.DEVICE_ENC_KEY, "base64");
const IV_LENGTH = 12; // recommended for GCM

function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  // store everything together (base64)
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(ciphertext) {
  const data = Buffer.from(ciphertext, "base64");

  const iv = data.slice(0, IV_LENGTH);
  const tag = data.slice(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = data.slice(IV_LENGTH + 16);

  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };
