const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const axios = require('axios')
const path = require('path')
const { syncNewOrders } = require('./syncService')

const app = express()

let ordersCache = []
let metricsCache = {}
let lastCacheUpdate = null

// =====================
// MIDDLEWARE
// =====================
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname)))

// =====================
// ENV
// =====================
const PORT = process.env.PORT || 3000
const API_KEY = process.env.API_KEY
const MONGO_URL = process.env.MONGO_URL
const DOMAIN = 'geo-market.salesdrive.me'

// =====================
// DB CONNECT
// =====================
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URL)
    console.log('✅ MongoDB connected')
  } catch (err) {
    console.error('❌ Mongo connection error:', err.message)
    process.exit(1)
  }
}

async function refreshCache() {
  try {
    console.log('🔄 Refreshing cache...')

    ordersCache = await Order.find().lean()

    // 🔥 рахуємо метрики один раз
    const EXCLUDED_STATUSES = [6, 7, 77]

    const validOrders = ordersCache.filter(order => !EXCLUDED_STATUSES.includes(Number(order.statusId)))

    const count = validOrders.length

    const turnover = validOrders.reduce((sum, order) => {
      return sum + (Number(order.paymentAmount) || 0)
    }, 0)

    const profit = validOrders.reduce((sum, order) => {
      return sum + (Number(order.profitAmount) || 0)
    }, 0)

    const avgCheck = count > 0 ? turnover / count : 0

    metricsCache = {
      count,
      turnover,
      profit,
      avgCheck,
    }

    lastCacheUpdate = new Date()

    console.log('✅ Cache updated')
  } catch (err) {
    console.error('❌ Cache error:', err.message)
  }
}

// =====================
// MODEL
// =====================
const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema)

// =====================
// STATE
// =====================
let isFetching = false

// =====================
// 🔥 ІМПОРТ ЗА 2026 РІК
// =====================
async function importOrders2026() {
  if (isFetching) return
  isFetching = true

  try {
    console.log('📅 Importing orders for 2026...')

    let currentDate = new Date('2026-01-01')
    const endDate = new Date('2026-12-31')

    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate)
      nextDate.setDate(nextDate.getDate() + 1)

      const from = currentDate.toISOString().slice(0, 10)
      const to = nextDate.toISOString().slice(0, 10)

      console.log(`➡️ ${from} - ${to}`)

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

        const orders = res.data?.data || []

        if (orders.length > 0) {
          for (const order of orders) {
            await Order.updateOne({ id: order.id }, order, { upsert: true })
          }

          console.log(`✅ Saved: ${orders.length}`)
        } else {
          console.log('📭 No orders')
        }

        // ⏳ затримка (щоб не перевищити ліміт)
        await new Promise(r => setTimeout(r, 2000))
      } catch (err) {
        console.log('❌ ERROR:', err.response?.data || err.message)

        if (err.response?.data?.message?.includes('limit')) {
          console.log('⛔ API LIMIT — stop import')
          break
        }
      }

      currentDate = nextDate
    }

    console.log('✅ Import finished')
  } finally {
    isFetching = false
  }
}

// =====================
// ОНОВЛЕННЯ НОВИХ ЗАМОВЛЕНЬ
// =====================
async function fetchOrders() {
  if (isFetching) return
  isFetching = true

  try {
    console.log('🌐 Fetching new orders...')

    const res = await axios.get(`https://${DOMAIN}/api/order/list/?page=1&limit=100`, {
      headers: { 'X-Api-Key': API_KEY },
      timeout: 60000,
    })

    const orders = res.data?.data || []

    if (!orders.length) {
      console.log('📭 No orders')
      return
    }

    for (const order of orders) {
      await Order.updateOne({ id: order.id }, order, { upsert: true })
    }

    console.log(`🔄 Synced: ${orders.length}`)
  } catch (err) {
    if (err.response) {
      console.log('❌ API STATUS:', err.response.status)
      console.log('❌ API DATA:', err.response.data)
    } else {
      console.log('❌ Error:', err.message)
    }
  } finally {
    isFetching = false
  }
}

// =====================
// ROUTES
// =====================
app.get('/api/orders', async (req, res) => {
  try {
    const { from, to } = req.query

    let query = {}

    if (from && to) {
      const fromDate = new Date(from)
      const toDate = new Date(to)

      fromDate.setHours(0, 0, 0, 0)
      toDate.setHours(23, 59, 59, 999)

      query.orderTime = {
        $gte: fromDate,
        $lte: toDate,
      }
    }

    const orders = await Order.find(query).lean()

    res.json(orders)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})
app.get('/api/sync', async (req, res) => {
  syncNewOrders()
  res.json({ status: 'Sync started' })
})
app.get('/api/metrics', (req, res) => {
  res.json({
    ...metricsCache,
    updatedAt: lastCacheUpdate,
  })
})

// =====================
// START
// =====================
async function startServer() {
  await connectDB()

  await refreshCache()

  // оновлюємо кеш кожні 10 хв
  setInterval(refreshCache, 10 * 60 * 1000)

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
  })

  // 🔄 регулярне оновлення
  setInterval(
    () => {
      syncNewOrders()
    },
    60 * 60 * 1000,
  ) // раз на годину

  console.log('🚀 Server fully started')
}

startServer()
