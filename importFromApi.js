const mongoose = require('mongoose')
const axios = require('axios')
const fs = require('fs')

// =====================
// CONFIG
// =====================
const MONGO_URL = process.env.MONGO_URL
const API_KEY = process.env.API_KEY
const DOMAIN = 'geo-market.salesdrive.me'

// 🔥 затримка між запитами (6 сек = безпечно)
const DELAY = 6000

// =====================
// MODEL
// =====================
const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.model('Order', orderSchema)

// =====================
// SAVE PROGRESS
// =====================
const PROGRESS_FILE = 'progress.json'

function getLastDate() {
  if (!fs.existsSync(PROGRESS_FILE)) return null

  const data = JSON.parse(fs.readFileSync(PROGRESS_FILE))
  return data.lastDate
}

function saveProgress(date) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastDate: date }))
}

// =====================
// DELAY
// =====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// =====================
// FETCH DAY
// =====================
async function fetchDay(from, to) {
  try {
    const res = await axios.get(`https://${DOMAIN}/api/order/list/`, {
      headers: { 'X-Api-Key': API_KEY },
      params: {
        'filter[orderTime][from]': from,
        'filter[orderTime][to]': to,
        limit: 100,
      },
      timeout: 60000,
    })

    return res.data?.data || []
  } catch (err) {
    console.log('❌ ERROR:', err.response?.data || err.message)
    return null
  }
}

// =====================
// MAIN IMPORT
// =====================
async function importOrders() {
  await mongoose.connect(MONGO_URL)
  console.log('✅ Mongo connected')

  let currentDate = getLastDate() ? new Date(getLastDate()) : new Date('2025-01-01') // 👈 початок історії

  const today = new Date()

  while (currentDate <= today) {
    const nextDate = new Date(currentDate)
    nextDate.setDate(currentDate.getDate() + 1)

    const from = currentDate.toISOString().slice(0, 10)
    const to = nextDate.toISOString().slice(0, 10)

    console.log(`📅 ${from} → ${to}`)

    const orders = await fetchDay(from, to)

    if (orders === null) {
      console.log('⛔ Stop (error)')
      break
    }

    if (orders.length > 0) {
      for (const order of orders) {
        await Order.updateOne({ id: order.id }, order, { upsert: true })
      }

      console.log(`✅ Saved: ${orders.length}`)
    } else {
      console.log('📭 No orders')
    }

    // 💾 зберігаємо прогрес
    saveProgress(from)

    // ⏳ пауза
    await sleep(DELAY)

    currentDate = nextDate
  }

  console.log('🎉 Import finished')
  process.exit()
}

importOrders()
