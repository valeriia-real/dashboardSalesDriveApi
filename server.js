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

async function startServer() {
  await connectDB()

  await refreshCache()

  // 🔥 sync тільки після DB
  await syncNewOrders()
  await refreshCache()

  // оновлюємо кеш кожні 10 хв
  setInterval(refreshCache, 10 * 60 * 1000)

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
  })

  // 🔄 регулярний sync
  setInterval(
    async () => {
      await syncNewOrders()
      await refreshCache()
    },
    60 * 60 * 1000,
  )

  console.log('🚀 Server fully started')
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
  try {
    await syncNewOrders()
    await refreshCache()
    res.json({ status: 'Sync finished' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
app.get('/api/metrics', (req, res) => {
  res.json({
    ...metricsCache,
    updatedAt: lastCacheUpdate,
  })
})

startServer()
