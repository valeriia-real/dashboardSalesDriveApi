const fs = require('fs')
const csv = require('csv-parser')

const STATUS_MAP = {
  1: 'Новий',
  2: 'Очікуємо оплату',
  3: 'Підтверджено',
  4: 'В дорозі',
  5: 'Отримано',
  6: 'Скасовано',
  7: 'Повернення',
  17: 'Прибула у відділення',
  18: 'Створено для відправки',
  19: 'Недодзвонились',
  31: 'Змінено адресу',
  56: 'Viber',
  77: 'Самозакуп',
}

const results = []

function parseNumber(value) {
  if (!value) return 0
  return Number(value.replace(/\s/g, '').replace(',', '.'))
}

function parseDate(value) {
  if (!value) return null
  const [date, time] = value.split(' ')
  const [y, m, d] = date.split('.')
  return new Date(`${y}-${m}-${d}T${time}Z`)
}

fs.createReadStream('orders.csv')
  .pipe(
    csv({
      separator: ';',
      mapHeaders: ({ header }) => header.trim(), // 🔥 ключове виправлення
    }),
  )
  .on('data', row => {
    const id = row['Номер заявки'] ? Number(row['Номер заявки']) : null

    const rawStatus = row['Статус']
    const statusId = Number(rawStatus) || null

    const order = {
      id: id,
      orderTime: parseDate(row['Дата створення']),
      statusId: statusId,
      paymentAmount: parseNumber(row['Сума']),
      profitAmount: parseNumber(row['Прибуток']),
    }

    results.push(order)
  })
  .on('end', () => {
    fs.writeFileSync('orders.json', JSON.stringify(results, null, 2))
    console.log('✅ Done')
  })
