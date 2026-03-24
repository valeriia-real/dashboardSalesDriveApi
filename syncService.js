const axios = require('axios')
const mongoose = require('mongoose')
const fs = require('fs')

// =====================
// CONFIG
// =====================
const API_KEY = process.env.API_KEY
const DOMAIN = 'geo-market.salesdrive.me'

// 🔥 ліміти
const LIMITS = {
  perMinute: 10,
  perHour: 100,
}

// =====================
// MODEL
// =====================
const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.model('Order', orderSchema)

// =====================
// STATE
// =====================
let requests = []

// =====================
// RATE LIMITER
// =====================
async function rateLimit() {
  const now = Date.now()

  // видаляємо старі запити
  requests = requests.filter(t => now - t < 60 * 60 * 1000)

  const lastMinute = requests.filter(t => now - t < 60 * 1000).length
  const lastHour = requests.length

  if (lastMinute >= LIMITS.perMinute || lastHour >= LIMITS.perHour) {
    console.log('⏳ Rate limit... waiting')

    await new Promise(r => setTimeout(r, 5000))
    return rateLimit()
  }

  requests.push(now)
}

// =====================
// LOG
// =====================
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`
  fs.appendFileSync('sync.log', line)
  console.log(message)
}

// =====================
// GET LAST ORDER DATE
// =====================
async function getLastOrderDate() {
  const lastOrder = await Order.findOne().sort({ orderTime: -1 })

  if (!lastOrder) {
    return new Date('2025-01-01')
  }

  return new Date(lastOrder.orderTime)
}

// =====================
// FETCH FROM API
// =====================
async function fetchOrders(from, to) {
  await rateLimit()

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
    log('❌ API ERROR: ' + (err.response?.data || err.message))
    return null
  }
}

// =====================
// SYNC NEW ORDERS
// =====================
async function syncNewOrders() {
  log('🚀 Sync started')

  let fromDate = await getLastOrderDate()
  let toDate = new Date()

  while (fromDate <= toDate) {
    const nextDate = new Date(fromDate)
    nextDate.setDate(fromDate.getDate() + 1)

    const from = fromDate.toISOString().slice(0, 10)
    const to = nextDate.toISOString().slice(0, 10)

    log(`📅 ${from} → ${to}`)

    const orders = await fetchOrders(from, to)

    if (orders === null) {
      log('⛔ Stop sync (error)')
      break
    }

    for (const order of orders) {
      await Order.updateOne({ id: order.id }, order, { upsert: true })
    }

    log(`✅ Synced: ${orders.length}`)

    fromDate = nextDate
  }

  log('🎉 Sync finished')
}

module.exports = { syncNewOrders }
