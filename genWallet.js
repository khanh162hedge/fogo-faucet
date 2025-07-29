const fs = require("fs");
const web3 = require("@solana/web3.js");

const keypair = web3.Keypair.generate();
fs.writeFileSync("wallet.json", JSON.stringify(Array.from(keypair.secretKey)));

console.log("✅ Ví đã tạo thành công. Public Key:");
console.log(keypair.publicKey.toBase58());
