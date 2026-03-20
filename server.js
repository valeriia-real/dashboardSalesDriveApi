const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const axios = require('axios')

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
// DB
// =====================
mongoose
  .connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ Mongo error:', err))

const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.model('Order', orderSchema)

// =====================
// STATE
// =====================
let isFetching = false
let lastOrderId = null

// =====================
// FETCH ORDERS (OPTIMIZED)
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

    // 🔍 Фільтруємо нові замовлення
    const newOrders = orders.filter(order => {
      if (!lastOrderId) return true
      return order.id > lastOrderId
    })

    // 🔄 Оновлюємо lastOrderId
    const maxId = Math.max(...orders.map(o => o.id))
    lastOrderId = maxId

    // 💾 Зберігаємо нові
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
      console.log('❌ No response from API (timeout or blocked)')
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
    const data = await Order.find().sort({ _id: -1 })
    res.json(data)
  } catch (err) {
    console.error('❌ /api/orders error:', err) // 👈 лог в консоль
    res.status(500).json({ error: err.message }) // 👈 показує реальну помилку
  }
})
// =====================
// START SERVER
// =====================
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)

  // тест API
  try {
    const test = await axios.get(`https://${DOMAIN}/api/order/list/?page=1&limit=1`, {
      headers: { 'X-Api-Key': API_KEY },
      timeout: 30000,
    })

    console.log('🧪 API TEST SUCCESS')
  } catch (err) {
    console.log('❌ API TEST FAILED:', err.message)
  }

  // перший запуск
  await fetchOrders()

  // періодичне оновлення (раз на годину)
  setInterval(fetchOrders, 60 * 60 * 1000)

  console.log('🚀 Server fully started')
})
