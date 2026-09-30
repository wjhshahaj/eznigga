const mineflayer = require('mineflayer');

// ====== CẤU HÌNH ======
const CONFIG = {
  host: 'khongten.phuopha3.dpdns.org',
  port: 26790,
  version: 1.20.1, // false = auto-detect; hoặc ghi rõ '1.20.1'...
  usernamePrefix: 'TestBot_1',
  totalBots: 100,
  batchSize: 10,        // số bot vào mỗi đợt
  holdSeconds: 10,      // giữ kết nối bao lâu
  gapBetweenBatches: 2, // nghỉ giữa các đợt (giây)
  gapBetweenLoops: 5,   // nghỉ sau khi hết 100 bot rồi quay vòng
  reconnectOnKick: true
};
// =======================

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Đếm trạng thái
let stats = {
  online: 0,
  totalSpawned: 0,
  totalKicked: 0,
  totalErrors: 0,
};

function log(msg) {
  const t = new Date().toISOString().substring(11, 19);
  console.log(`[${t}] ${msg}`);
}

function createBot(index) {
  const username = `${CONFIG.usernamePrefix}${index}`;
  const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username,
    version: CONFIG.version,
    auth: 'offline', // server offline-mode; nếu online-mode thì bỏ dòng này
    hideErrors: true,
  });

  bot._index = index;
  bot._alive = true;

  bot.once('spawn', () => {
    stats.online++;
    log(`✅ [${username}] spawned (online: ${stats.online})`);
  });

  bot.on('kicked', (reason) => {
    stats.totalKicked++;
    log(`⚠️  [${username}] kicked: ${JSON.stringify(reason).slice(0, 120)}`);
  });

  bot.on('error', (err) => {
    stats.totalErrors++;
    log(`❌ [${username}] error: ${err.message}`);
  });

  bot.on('end', () => {
    if (bot._alive) {
      stats.online = Math.max(0, stats.online - 1);
      bot._alive = false;
      log(`🔌 [${username}] disconnected (online: ${stats.online})`);
    }
  });

  return bot;
}

function disconnectBot(bot) {
  try {
    if (bot && bot._alive) bot.quit('test-cycle');
  } catch (_) {}
}

async function runBatch(startIndex) {
  const bots = [];
  log(`🚀 Batch: bot #${startIndex} → #${startIndex + CONFIG.batchSize - 1}`);

  for (let i = 0; i < CONFIG.batchSize; i++) {
    const idx = startIndex + i;
    if (idx > CONFIG.totalBots) break;
    const bot = createBot(idx);
    bots.push(bot);
    stats.totalSpawned++;
    await sleep(300); // giãn nhẹ để tránh handshake dồn dập
  }

  log(`⏳ Giữ ${CONFIG.holdSeconds}s...`);
  await sleep(CONFIG.holdSeconds * 1000);

  log(`🛑 Ngắt batch #${startIndex}`);
  bots.forEach(disconnectBot);
}

async function mainLoop() {
  let loopCount = 0;
  while (true) {
    loopCount++;
    log(`\n===== VÒNG LẶP #${loopCount} =====`);

    for (let start = 1; start <= CONFIG.totalBots; start += CONFIG.batchSize) {
      await runBatch(start);
      await sleep(CONFIG.gapBetweenBatches * 1000);
    }

    log(`💤 Hết ${CONFIG.totalBots} bot. Nghỉ ${CONFIG.gapBetweenLoops}s rồi lặp lại.`);
    log(`📊 Stats: spawned=${stats.totalSpawned}, online=${stats.online}, kicked=${stats.totalKicked}, errors=${stats.totalErrors}`);
    await sleep(CONFIG.gapBetweenLoops * 1000);
  }
}

// Bắt Ctrl+C để thoát sạch
process.on('SIGINT', () => {
  log('👋 Nhận SIGINT, thoát...');
  process.exit(0);
});

mainLoop().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
