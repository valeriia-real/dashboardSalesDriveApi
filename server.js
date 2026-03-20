const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const axios = require('axios')

const path = require('path')

app.use(express.static(path.join(__dirname)))
const app = express()

app.use(cors())
app.use(express.json())

// =====================
// ENV
// =====================
const PORT = process.env.PORT || 3000
const API_KEY = process.env.API_KEY
const MONGO_URL = process.env.MONGO_URL
const DOMAIN = 'geo-market.salesdrive.me'

// =====================
// DB CONNECT (ВАЖЛИВО через await)
// =====================
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URL)
    console.log('✅ MongoDB connected')
  } catch (err) {
    console.error('❌ Mongo connection error:', err.message)
    process.exit(1) // зупиняє сервер якщо база не працює
  }
}

// =====================
// MODEL
// =====================
const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.model('Order', orderSchema)

// =====================
// STATE
// =====================
let isFetching = false
let lastOrderId = null

// =====================
// FETCH ORDERS (1 запит, без перевищення ліміту)
// =====================
async function fetchOrders() {
  if (isFetching) return
  isFetching = true

  try {
    console.log('🌐 Fetching orders...')

    const url = `https://${DOMAIN}/api/order/list/?page=1&limit=100`

    const res = await axios.get(url, {
      headers: {
        'X-Api-Key': API_KEY,
      },
      timeout: 60000,
    })

    const orders = res.data?.data || []

    if (!orders.length) {
      console.log('📭 No orders received')
      return
    }

    // 🔍 тільки нові
    const newOrders = orders.filter(order => {
      if (!lastOrderId) return true
      return order.id > lastOrderId
    })

    // 🔄 оновлюємо останній ID
    lastOrderId = Math.max(...orders.map(o => o.id))

    // 💾 зберігаємо
    if (newOrders.length > 0) {
      await Order.insertMany(newOrders, { ordered: false })
      console.log(`➕ Added new orders: ${newOrders.length}`)
    } else {
      console.log('📭 No new orders')
    }

    const total = await Order.countDocuments()
    console.log(`📦 Total in DB: ${total}`)
  } catch (err) {
    if (err.response) {
      console.log('❌ API STATUS:', err.response.status)
      console.log('❌ API DATA:', err.response.data)
    } else if (err.request) {
      console.log('❌ No response from API')
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
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.get('/api/orders', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ error: 'DB not connected' })
    }

    const data = await Order.find().sort({ _id: -1 })
    res.json(data)
  } catch (err) {
    console.error('❌ /api/orders error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// =====================
// START SERVER (правильний порядок)
// =====================
async function startServer() {
  await connectDB() // 🔥 спочатку база

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
  })

  // 🔥 БЕЗ тестового API (економимо ліміт)
  await fetchOrders()

  // 🔁 раз на 3 години
  setInterval(fetchOrders, 3 * 60 * 60 * 1000)

  console.log('🚀 Server fully started')
}

startServer()
