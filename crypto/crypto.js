const crypto = require("crypto");
const NodeCache = require("node-cache");

const myCache = new NodeCache({ stdTTL: 300 });

require("dotenv").config();

const encrypt = function (text) {
  const algorithm = "aes-256-cbc";
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(process.env.ENCRYPTION_KEY, "hex"),
    Buffer.from(process.env.ENCRYPTION_IV, "hex")
  );

  let encrypted = cipher.update(text, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
};

const decrypt = function (key, text) {
  let decrypted = myCache.get(key);

  if (decrypted) {
    return decrypted;
  }

  const algorithm = "aes-256-cbc";
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(process.env.ENCRYPTION_KEY, "hex"),
    Buffer.from(process.env.ENCRYPTION_IV, "hex")
  );

  let decryptedValue = decipher.update(text, "hex", "utf-8");
  decryptedValue += decipher.final("utf-8");

  myCache.set(key, decryptedValue);

  return decryptedValue;
};

module.exports = { decrypt, encrypt, myCache };
