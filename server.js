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

// Load dữ liệu đã claim
if (fs.existsSync(CLAIM_RECORD_PATH)) {
  claimedWallets = JSON.parse(fs.readFileSync(CLAIM_RECORD_PATH));
}

// API Faucet
app.post('/faucet', (req, res) => {
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

  // Dùng endpoint rõ ràng của Fogo
  const RPC_ENDPOINT = 'https://api.testnet.fogo.io'; // cập nhật đúng endpoint nếu khác
  const transferCommand = `fogo transfer --rpc ${RPC_ENDPOINT} --keypair wallet.json --to ${wallet} --amount 1`;

  exec(transferCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Transfer error: ${error.message}`);
      return res.status(500).json({ error: 'Token transfer failed.', detail: error.message });
    }

    if (stderr.includes('failed to get info about account')) {
      console.error(`RPC error: ${stderr}`);
      return res.status(500).json({ error: 'RPC fetch failed. Check RPC endpoint or network.' });
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

// Route mặc định
app.get('/', (req, res) => {
  res.send('🔥 FOGO Faucet đã sẵn sàng! Gửi POST đến /faucet với JSON chứa địa chỉ ví.');
});

app.listen(port, () => {
  console.log(`Faucet server listening on port ${port}`);
});
