const express = require('express');
const fs = require('fs');
const path = require('path');
const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Load claimed addresses
let claimedAddresses = {};
const CLAIMS_FILE = 'claims.json';
if (fs.existsSync(CLAIMS_FILE)) {
  claimedAddresses = JSON.parse(fs.readFileSync(CLAIMS_FILE));
}
function saveClaims() {
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claimedAddresses, null, 2));
}

// Faucet endpoint
app.post('/faucet', async (req, res) => {
  const address = req.body.address;
  if (!address) return res.status(400).json({ error: 'Missing wallet address.' });

  const now = Date.now();
  const lastClaim = claimedAddresses[address];
  if (lastClaim && now - lastClaim < 24 * 60 * 60 * 1000) {
    return res.status(429).json({ error: 'You can only claim once every 24 hours.' });
  }

  const tokenMint = new web3.PublicKey('So11111111111111111111111111111111111111112'); // FOGO testnet mint
  const rpcUrl = 'https://testnet.fogo.io';
  const connection = new web3.Connection(rpcUrl, 'confirmed');
  const keypairPath = path.join(__dirname, 'wallet.json');
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath)));
  const fromWallet = web3.Keypair.fromSecretKey(secretKey);
  const recipient = new web3.PublicKey(address);

  try {
    // Tạo ATA cho người nhận
    const recipientTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet, // payer
      tokenMint,
      recipient
    );

    // Tạo transaction chuyển 1 token (1e9 nếu decimals là 9)
    const tx = new web3.Transaction().add(
      splToken.createTransferInstruction(
        await splToken.getAssociatedTokenAddress(tokenMint, fromWallet.publicKey),
        recipientTokenAccount.address,
        fromWallet.publicKey,
        1_000_000_000 // 1 FOGO
      )
    );

    const signature = await web3.sendAndConfirmTransaction(connection, tx, [fromWallet]);
    claimedAddresses[address] = now;
    saveClaims();

    res.json({ message: '1 FOGO token sent successfully!', signature });
  } catch (err) {
    console.error('Transfer failed:', err);
    res.status(500).json({ error: 'Transfer failed.', details: err.message });
  }
});

// Home page
app.get('/', (req, res) => {
  res.send('🚰 Welcome to the FOGO Faucet!\nUse POST /faucet with body: { "address": "YOUR_WALLET_ADDRESS" }');
});

app.listen(PORT, () => {
  console.log(`Faucet server running on http://localhost:${PORT}`);
});
