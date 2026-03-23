const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const axios = require('axios')
const path = require('path')

// ✅ СПОЧАТКУ створюємо app
const app = express()

// =====================
// MIDDLEWARE
// =====================
app.use(cors())
app.use(express.json())

// 👉 віддає HTML, CSS, JS
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
// FETCH ORDERS
// =====================
async function fetchOrders() {
  if (isFetching) return
  isFetching = true

  try {
    console.log('🌐 Fetching orders...')

    const res = await axios.get(`https://${DOMAIN}/api/order/list/?page=1&limit=100`, {
      headers: { 'X-Api-Key': API_KEY },
      timeout: 60000,
    })

    const orders = res.data?.data || []

    if (!orders.length) {
      console.log('📭 No orders received')
      return
    }

    const newOrders = orders.filter(order => {
      if (!lastOrderId) return true
      return order.id > lastOrderId
    })

    lastOrderId = Math.max(...orders.map(o => o.id))

    if (newOrders.length > 0) {
      await Order.insertMany(newOrders, { ordered: false })
      console.log(`➕ Added: ${newOrders.length}`)
    } else {
      console.log('📭 No new orders')
    }

    const total = await Order.countDocuments()
    console.log(`📦 Total: ${total}`)
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
    console.error('❌ /api/orders:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// =====================
// START
// =====================
async function startServer() {
  await connectDB()

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
  })

  await fetchOrders()

  setInterval(fetchOrders, 3 * 60 * 60 * 1000)

  console.log('🚀 Server fully started')
}

startServer()
