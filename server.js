const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const axios = require('axios')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

// 🔥 PORT
const PORT = process.env.PORT || 3000

// 🔐 ENV
const API_KEY = process.env.API_KEY
const MONGO_URL = process.env.MONGO_URL
const DOMAIN = 'geo-market.salesdrive.me'

// ----------------------
// MongoDB
// ----------------------
mongoose
  .connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ Mongo error:', err))

// ----------------------
// Model
// ----------------------
const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.model('Order', orderSchema)

// ----------------------
// Fetch orders
// ----------------------
let isFetching = false
const MAX_PAGES = 10 // обмеження щоб не зависало

async function fetchOrders() {
  if (isFetching) return
  isFetching = true

  let page = 1
  let newOrders = []

  console.log('🌐 Завантаження замовлень...')

  try {
    while (page <= MAX_PAGES) {
      console.log('➡️ Fetch page:', page)

      const url = `https://${DOMAIN}/api/order/list/?page=${page}&limit=100`

      let res

      try {
        res = await axios.get(url, {
          headers: {
            'X-Api-Key': API_KEY,
          },
          timeout: 60000, // 60 секунд
        })
      } catch (err) {
        if (err.response) {
          console.log('❌ API ERROR STATUS:', err.response.status)
          console.log('❌ API ERROR DATA:', err.response.data)
        } else if (err.request) {
          console.log('❌ NO RESPONSE (timeout or blocked)')
        } else {
          console.log('❌ REQUEST ERROR:', err.message)
        }
        break
      }

      const data = res.data

      if (data.status === 'error') {
        console.log('❌ API LIMIT:', data.message)
        break
      }

      const orders = data.data || []

      if (!orders.length) break

      // додаємо тільки нові
      for (const order of orders) {
        const exists = await Order.findOne({ id: order.id })

        if (!exists) {
          newOrders.push(order)
        }
      }

      page++

      if (orders.length < 100) break

      // пауза між запитами
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    if (!newOrders.length) {
      console.log('📭 Нових замовлень немає')
      return
    }

    await Order.insertMany(newOrders, { ordered: false })

    const total = await Order.countDocuments()

    console.log(`➕ Додано нових: ${newOrders.length}`)
    console.log(`📦 Всього в базі: ${total}`)
  } catch (err) {
    console.error('❌ GENERAL ERROR:', err.message)
  } finally {
    isFetching = false
  }
}

// ----------------------
// API endpoint
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
// Server start
// ----------------------
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

  // запуск синхронізації
  await fetchOrders()

  // раз на 24 години
  setInterval(fetchOrders, 24 * 60 * 60 * 1000)

  console.log('🚀 Server started fully')
})
