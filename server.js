const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const CLAIM_RECORD_PATH = path.join(__dirname, 'claimed_wallets.json');
let claimedWallets = {};

// Load danh sách ví đã claim từ file nếu có
if (fs.existsSync(CLAIM_RECORD_PATH)) {
  claimedWallets = JSON.parse(fs.readFileSync(CLAIM_RECORD_PATH));
}

// API Faucet
app.post('/claim', (req, res) => {
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address is required.' });
  }

  const now = Date.now();
  const lastClaim = claimedWallets[wallet] || 0;
  const diff = now - lastClaim;

  if (diff < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - diff) / (60 * 60 * 1000));
    return res.status(429).json({ error: `This wallet has already claimed. Try again in ${hoursLeft} hour(s).` });
  }

  const transferCommand = `fogo transfer --keypair wallet.json --to ${wallet} --amount 1`;

  exec(transferCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Transfer error: ${error.message}`);
      return res.status(500).json({ error: 'Token transfer failed.' });
    }

    if (stderr) {
      console.warn(`Transfer warning: ${stderr}`);
    }

    console.log(`Transfer successful: ${stdout}`);

    claimedWallets[wallet] = now;
    fs.writeFileSync(CLAIM_RECORD_PATH, JSON.stringify(claimedWallets));

    res.json({ success: true, message: '1 FOGO token sent!' });
  });
});

// Ping route (optional)
app.get('/', (req, res) => {
  res.send('Faucet server is running.');
});

app.listen(port, () => {
  console.log(`Faucet server listening on port ${port}`);
});
