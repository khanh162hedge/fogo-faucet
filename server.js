require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// === Load claimed addresses ===
let claimedAddresses = {};
const CLAIMS_FILE = 'claims.json';
if (fs.existsSync(CLAIMS_FILE)) {
  try {
    claimedAddresses = JSON.parse(fs.readFileSync(CLAIMS_FILE));
  } catch (e) {
    console.error('Failed to parse claims file:', e);
    claimedAddresses = {};
  }
}

// === Load IP claims ===
let ipClaims = {};
const IP_CLAIMS_FILE = 'ip_claims.json';
if (fs.existsSync(IP_CLAIMS_FILE)) {
  try {
    ipClaims = JSON.parse(fs.readFileSync(IP_CLAIMS_FILE));
  } catch (e) {
    console.error('Failed to parse IP claims file:', e);
    ipClaims = {};
  }
}

function saveClaims() {
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claimedAddresses, null, 2));
  fs.writeFileSync(IP_CLAIMS_FILE, JSON.stringify(ipClaims, null, 2));
}

// === Faucet endpoint ===
app.post('/faucet', async (req, res) => {
  const address = req.body.address;
  if (!address) return res.status(400).json({ error: 'Missing wallet address.' });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  // ✅ Check cooldown for address
  const lastClaim = claimedAddresses[address];
  if (lastClaim && now - lastClaim < 24 * 60 * 60 * 1000) {
    return res.status(429).json({ error: 'You can only claim once every 24 hours with this wallet address.' });
  }

  // ✅ Check cooldown for IP using different wallet
  const ipInfo = ipClaims[ip];
  if (ipInfo) {
    const { address: prevAddress, timestamp } = ipInfo;

    if (prevAddress !== address && now - timestamp < 24 * 60 * 60 * 1000) {
      return res.status(429).json({ error: 'This IP has already used a different wallet in the last 24 hours.' });
    }
  }

  const tokenMint = new web3.PublicKey('So11111111111111111111111111111111111111112'); // FOGO testnet
  const rpcUrl = 'https://testnet.fogo.io';
  const connection = new web3.Connection(rpcUrl, 'confirmed');

  try {
    const secretKeyJSON = process.env.PRIVATE_KEY;
    if (!secretKeyJSON) throw new Error("PRIVATE_KEY is not set in .env");

    let secretKey;
    try {
      secretKey = Uint8Array.from(JSON.parse(secretKeyJSON));
    } catch (e) {
      throw new Error("PRIVATE_KEY in .env is not a valid JSON array");
    }

    const fromWallet = web3.Keypair.fromSecretKey(secretKey);
    const recipient = new web3.PublicKey(address);

    const recipientTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet,
      tokenMint,
      recipient
    );

    const fromTokenAccount = await splToken.getAssociatedTokenAddress(
      tokenMint,
      fromWallet.publicKey
    );

    const tx = new web3.Transaction().add(
      splToken.createTransferInstruction(
        fromTokenAccount,
        recipientTokenAccount.address,
        fromWallet.publicKey,
        500_000_000 // 0.5 FOGO
      )
    );

    const signature = await web3.sendAndConfirmTransaction(connection, tx, [fromWallet]);

    // ✅ Save new claim
    claimedAddresses[address] = now;
    ipClaims[ip] = { address, timestamp: now };
    saveClaims();

    res.json({ message: '0.5 FOGO token sent successfully!', signature });
  } catch (err) {
    console.error('Transfer failed:', err);
    res.status(500).json({ error: 'Transfer failed.', details: err.message });
  }
});

// === Home page ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === Start server ===
app.listen(PORT, () => {
  console.log(`✅ Faucet server running on http://localhost:${PORT}`);
});
