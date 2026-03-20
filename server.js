const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

// 🔥 PORT для Render
const PORT = process.env.PORT || 3000

// 🔐 ENV
const API_KEY = process.env.API_KEY
const MONGO_URL = process.env.MONGO_URL
const DOMAIN = 'geo-market.salesdrive.me'

// ----------------------
// MongoDB підключення
// ----------------------
mongoose
  .connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ Mongo error:', err))

// ----------------------
// Модель (гнучка)
// ----------------------
const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.model('Order', orderSchema)

// ----------------------
// Отримати замовлення з API
// ----------------------
async function fetchOrders() {
  let page = 1
  let hasMore = true
  let newOrders = []

  console.log('🌐 Завантаження нових замовлень...')

  try {
    while (hasMore) {
      const url = `https://${DOMAIN}/api/order/list/?page=${page}&limit=100`

      const res = await fetch(url, {
        headers: { 'X-Api-Key': API_KEY },
      })

      const data = await res.json()

      if (data.status === 'error') {
        console.log('❌ API LIMIT:', data.message)
        break
      }

      const orders = data.data || []

      if (!orders.length) break

      newOrders.push(...orders)

      page++

      // 🔥 затримка щоб не впертись в ліміт
      await new Promise(res => setTimeout(res, 6000))

      if (orders.length < 100) break
    }

    // ❗ якщо нічого нового
    if (!newOrders.length) {
      console.log('📭 Нема нових замовлень')
      return
    }

    // ----------------------
    // Збереження в MongoDB
    // ----------------------
    let added = 0

    for (const order of newOrders) {
      const result = await Order.updateOne({ id: order.id }, order, { upsert: true })

      if (result.upsertedCount > 0) {
        added++
      }
    }

    const total = await Order.countDocuments()

    console.log(`➕ Додано нових: ${added}`)
    console.log(`📦 Всього в базі: ${total}`)
  } catch (err) {
    console.error('❌ Помилка:', err.message)
  }
}

// ----------------------
// API
// ----------------------
app.get('/api/orders', async (req, res) => {
  try {
    const data = await Order.find().sort({ _id: -1 })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// ----------------------
// Старт сервера
// ----------------------
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)

  // 🔥 перший запуск
  await fetchOrders()

  // 🔁 раз на 24 години
  setInterval(fetchOrders, 24 * 60 * 60 * 1000)

  console.log('🚀 Сервер запущено')
})
