const express = require('express');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(express.static('.'));
const PORT = 3000;

app.use(express.json());

// Load claimed addresses
let claimedAddresses = {};
const CLAIMS_FILE = 'claims.json';
if (fs.existsSync(CLAIMS_FILE)) {
  claimedAddresses = JSON.parse(fs.readFileSync(CLAIMS_FILE));
}

// Save claimed addresses to file
function saveClaims() {
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claimedAddresses, null, 2));
}

// Faucet endpoint
app.post('/faucet', async (req, res) => {
  const address = req.body.address;

  if (!address) {
    return res.status(400).send({ error: 'Wallet address is required.' });
  }

  const now = Date.now();
  const lastClaim = claimedAddresses[address];

  if (lastClaim && now - lastClaim < 24 * 60 * 60 * 1000) {
    return res.status(429).send({ error: 'You can only claim once every 24 hours.' });
  }

  // Execute the token transfer command
  const tokenMint = 'So11111111111111111111111111111111111111112';
  const keypairPath = 'wallet.json'; // Replace with your actual keypair path
  const rpcUrl = 'https://testnet.fogo.io';

  const keypairPath = path.resolve(__dirname, 'wallet.json');
const cmd = `spl-token transfer ${tokenMint} 1 ${address} --fund-recipient --allow-unfunded-recipient --owner ${keypairPath} --url ${rpcUrl}`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Transfer error: ${stderr}`);
      return res.status(500).send({ error: 'Token transfer failed.', details: stderr });
    }

    console.log(`Transfer successful: ${stdout}`);
    claimedAddresses[address] = now;
    saveClaims();
    res.send({ message: '1 FOGO token sent successfully!', log: stdout });
  });
});

// Route mặc định để hiển thị nội dung khi vào trang chủ "/"
app.get('/', (req, res) => {
  res.send('🚰 Welcome to the FOGO Testnet Faucet!\nUse POST /faucet with JSON body { "address": "YOUR_WALLET_ADDRESS" }');
});

// Start server
app.listen(PORT, () => {
  console.log(`Faucet server running on http://localhost:${PORT}`);
});
