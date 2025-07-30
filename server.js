const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

const CLAIMS_FILE = 'claims.json';
const IP_CLAIMS_FILE = 'ip_claims.json';
const COOLDOWN_HOURS = 24;

function loadJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename));
  } catch {
    return {};
  }
}

function saveJson(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

app.post('/faucet', async (req, res) => {
  const { wallet } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });

  const claims = loadJson(CLAIMS_FILE);
  const ipClaims = loadJson(IP_CLAIMS_FILE);
  const now = Date.now();

  // Check wallet cooldown
  const lastClaimTime = claims[wallet];
  if (lastClaimTime && now - lastClaimTime < COOLDOWN_HOURS * 3600 * 1000) {
    const hoursLeft = ((COOLDOWN_HOURS * 3600 * 1000 - (now - lastClaimTime)) / 3600000).toFixed(1);
    return res.status(429).json({ error: `Wallet cooldown: try again in ${hoursLeft}h` });
  }

  // Check IP cooldown
  const lastIpClaim = ipClaims[ip];
  if (lastIpClaim && now - lastIpClaim.timestamp < COOLDOWN_HOURS * 3600 * 1000) {
    return res.status(429).json({ error: `This IP already claimed a wallet within 24h.` });
  }

  // ✅ If passed checks, send token
  try {
    await sendToken(wallet); // gọi hàm gửi token 0.5 FOGO của bạn ở đây

    claims[wallet] = now;
    ipClaims[ip] = { wallet, timestamp: now };

    saveJson(CLAIMS_FILE, claims);
    saveJson(IP_CLAIMS_FILE, ipClaims);

    return res.json({ success: true, message: 'Sent 0.5 FOGO to wallet!' });
  } catch (err) {
    console.error('Transfer failed:', err);
    return res.status(500).json({ error: 'Transfer failed' });
  }
});

app.listen(3000, () => console.log('Faucet server running on port 3000'));
