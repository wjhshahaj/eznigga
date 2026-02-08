const mineflayer = require('mineflayer')
const express = require('express')

/* ===== CONFIG ===== */
const CONFIG = {
  host: 'foggy.pikamc.vn',
  port: 25020, // ✅ thêm port server
  username: 'AdolfHitler',
  version: '1.20.1',

  stableDelay: 10000,
  delay: 5000,

  afkJumpMin: 60000,
  afkJumpMax: 70000,

  reconnectDelay: 15000,
  webPort: 3000,

  loginCommand: '/login 03012009' // ✅ login mới
}

/* ===== HELPERS ===== */
const wait = ms => new Promise(r => setTimeout(r, ms))
const log = m => console.log(`[${new Date().toLocaleTimeString()}] ${m}`)
const random = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

/* ===== BOT STATE ===== */
let bot = null
let botState = 'OFFLINE'
let reconnecting = false
let afkEnabled = true

/* ===== SCREEN DATA ===== */
let chatLog = []
let scoreboardTitle = ''
let scoreboardLines = []
let lastWindow = null

/* ===== CREATE BOT ===== */
function createBot () {
  botState = 'CONNECTING'
  log('🔌 CONNECTING...')

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port, // ✅ dùng port
    username: CONFIG.username,
    version: CONFIG.version
  })

  registerEvents()
}

/* ===== EVENTS ===== */
function registerEvents () {
  bot.on('login', () => {
    botState = 'LOGIN'
    log('✔ LOGIN PACKET')
  })

  bot.on('spawn', async () => {
    botState = 'SPAWN'
    log('✔ SPAWN')

    await wait(CONFIG.stableDelay)

    // ✅ LOGIN THEO CƠ CHẾ MỚI
    log(`→ ${CONFIG.loginCommand}`)
    bot.chat(CONFIG.loginCommand)

    await wait(CONFIG.delay)

    startAFK()
  })

  bot.on('message', msg => {
    const t = msg.toString()
    chatLog.push(t)
    if (chatLog.length > 40) chatLog.shift()
    log(`[CHAT] ${t}`)
  })

  bot.on('scoreboardCreated', sb => {
    scoreboardTitle = sb.title
    scoreboardLines = Object.values(sb.itemsMap).map(i => i.displayName)
  })

  bot.on('scoreboardUpdated', sb => {
    scoreboardTitle = sb.title
    scoreboardLines = Object.values(sb.itemsMap).map(i => i.displayName)
  })

  bot.on('windowOpen', window => {
    lastWindow = {
      title: window.title,
      slots: window.slots
        .map((it, i) => it ? `#${i}: ${it.displayName || it.name} x${it.count}` : null)
        .filter(Boolean)
    }
  })

  bot.on('windowClose', () => {
    lastWindow = null
  })

  bot.on('end', handleReconnect)
  bot.on('kicked', handleReconnect)
  bot.on('error', e => log(`ERROR: ${e.message}`))
}

/* ===== AFK ===== */
function startAFK () {
  if (!afkEnabled) return
  botState = 'AFK'
  log('✔ AFK ENABLED')

  setInterval(() => {
    if (!afkEnabled || !bot?.entity) return
    bot.setControlState('jump', true)
    setTimeout(() => bot.setControlState('jump', false), 300)
  }, random(CONFIG.afkJumpMin, CONFIG.afkJumpMax))
}

/* ===== RECONNECT ===== */
async function handleReconnect () {
  if (reconnecting) return
  reconnecting = true
  botState = 'RECONNECTING'
  log(`🔁 RECONNECT IN ${CONFIG.reconnectDelay / 1000}s`)
  await wait(CONFIG.reconnectDelay)
  reconnecting = false
  createBot()
}

/* ===== SCAN SCREEN ===== */
function scanScreen () {
  if (!bot || !bot.entity) return null
  const p = bot.entity.position

  return {
    state: botState,
    position: {
      x: p.x.toFixed(2),
      y: p.y.toFixed(2),
      z: p.z.toFixed(2)
    },
    inventory: bot.inventory.items().map(i => `${i.displayName} x${i.count}`),
    scoreboard: {
      title: scoreboardTitle,
      lines: scoreboardLines
    },
    window: lastWindow,
    chat: chatLog
  }
}

/* ===== WEB ===== */
const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>MC BOT CONTROL</title>
<style>
body{background:#0f1220;color:#fff;font-family:Arial}
button{padding:10px;margin:5px;background:#5865f2;color:#fff;border:none;border-radius:6px}
pre{background:#111;padding:10px;border-radius:6px;max-height:400px;overflow:auto}
</style>
</head>
<body>
<h2>🤖 Minecraft Bot Control</h2>

<button onclick="scan()">🔍 Scan Screen</button>
<button onclick="toggleAFK()">🦘 Toggle AFK</button>

<pre id="out">Waiting...</pre>

<script>
async function scan(){
  const r = await fetch('/scan')
  const j = await r.json()
  document.getElementById('out').textContent = JSON.stringify(j,null,2)
}
async function toggleAFK(){
  await fetch('/afk',{method:'POST'})
  scan()
}
</script>
</body>
</html>
`)
})

app.get('/scan', (req, res) => {
  const s = scanScreen()
  res.json(s || { error: 'BOT NOT READY' })
})

app.post('/afk', (req, res) => {
  afkEnabled = !afkEnabled
  botState = afkEnabled ? 'AFK' : 'IDLE'
  res.json({ afk: afkEnabled })
})

/* ===== START ===== */
app.listen(CONFIG.webPort, () =>
  log(`🌐 WEB http://localhost:${CONFIG.webPort}`)
)

createBot()
