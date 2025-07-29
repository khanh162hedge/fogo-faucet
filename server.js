const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  transfer
} = require('@solana/spl-token');

const walletData = JSON.parse(fs.readFileSync('./wallet.json'));

const connection = new Connection('https://api.testnet.fogo.io');
const senderWallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
const FOGO_MINT = new PublicKey('F2rwNcJ5eqxT3efDbKFeuZUtZyRDAdg8fPnaXAfCXHua');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const COOLDOWN = 24 * 60 * 60 * 1000; // 24h
const historyFile = './history.json';

function loadHistory() {
  if (!fs.existsSync(historyFile)) return {};
  return JSON.parse(fs.readFileSync(historyFile));
}

function saveHistory(data) {
  fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
}

async function sendFogoToken(receiverAddress) {
  const recipient = new PublicKey(receiverAddress);

  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, senderWallet, FOGO_MINT, senderWallet.publicKey
  );

  const toTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, senderWallet, FOGO_MINT, recipient
  );

  const sig = await transfer(
    connection,
    senderWallet,
    fromTokenAccount.address,
    toTokenAccount.address,
    senderWallet,
    1_000_000 // Gửi 1 token FOGO (vì FOGO có 6 decimal)
  );

  return sig;
}

app.post('/faucet', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Thiếu ví!' });

  const history = loadHistory();
  const now = Date.now();

  if (history[wallet] && now - history[wallet] < COOLDOWN) {
    return res.status(429).json({ error: 'Ví này đã nhận trong 24h qua!' });
  }

  try {
    const sig = await sendFogoToken(wallet);
    history[wallet] = now;
    saveHistory(history);
    res.json({ message: `Đã gửi token! Tx: ${sig}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gửi token thất bại!' });
  }
});
app.get('/', (req, res) => {
  res.send('🔥 FOGO Faucet đã sẵn sàng! Gửi POST đến /faucet với JSON chứa địa chỉ ví.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Faucet đang chạy tại cổng ${PORT}`);
});
