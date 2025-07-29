const fs = require('fs');
const bs58 = require('bs58');

const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync('wallet.json')));
const base58Key = bs58.default ? bs58.default.encode(secretKey) : bs58.encode(secretKey);

console.log("Base58 PRIVATE_KEY:\n" + base58Key);
