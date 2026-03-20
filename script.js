const dateRangeSelect = document.getElementById('dateRangeSelect')
const customDateRange = document.getElementById('customDateRange')
const startDateInput = document.getElementById('startDate')
const endDateInput = document.getElementById('endDate')
const headerMonth = document.querySelector('.header-month')
const monthPickerContainer = document.getElementById('monthPickerContainer')
const yearPickerContainer = document.getElementById('yearPickerContainer')
const monthPickerInput = document.getElementById('monthPicker')
const yearSelect = document.getElementById('yearSelect')
const ordersCountHeader = document.querySelector('.status-badge')

let orders = []
const EXCLUDED_STATUSES = [6, 7]

/* ---------------------- */
/* Завантаження замовлень */
/* ---------------------- */
async function loadOrders() {
  try {
    const response = await fetch('https://dashboardsalesdriveapi.onrender.com/')
    orders = await response.json()

    if (orders.length > 0) {
      updateDashboard('last_day')
    }
  } catch (error) {
    console.error(error)
  }
}

/* ---------------------- */
/* Фільтр періодів */
/* ---------------------- */
function filterOrdersByRange(range) {
  const now = new Date()
  let start = new Date()
  let end = new Date()
  let title = ''

  switch (range) {
    case 'last_day':
      start.setHours(0, 0, 0, 0)
      title = 'ОСТАННЯ ДОБА'
      break
    case 'last_week':
      start.setDate(now.getDate() - now.getDay() - 6)
      end.setDate(now.getDate() - now.getDay())
      title = 'ПОПЕРЕДНІЙ ТИЖДЕНЬ'
      break
    case 'last_7_days':
      start.setDate(now.getDate() - 7)
      title = 'ОСТАННІ 7 ДНІВ'
      break
    case 'last_14_days':
      start.setDate(now.getDate() - 14)
      title = 'ОСТАННІ 14 ДНІВ'
      break
    case 'custom':
      const startVal = startDateInput.value
      const endVal = endDateInput.value

      if (!startVal && !endVal) {
        // ❌ нічого не робимо — залишаємо старий заголовок
        return []
      }

      if (startVal && !endVal) {
        start = parseDate(startVal)
        end = new Date(start)
        end.setHours(23, 59, 59)
        title = startVal
      } else if (!startVal && endVal) {
        end = parseDate(endVal)
        start = new Date(end)
        start.setHours(0, 0, 0, 0)
        title = endVal
      } else {
        start = parseDate(startVal)
        end = parseDate(endVal)
        end.setHours(23, 59, 59)
        title = `${startVal} — ${endVal}`
      }

      break
  }

  headerMonth.textContent = title

  return orders.filter(order => {
    const orderDate = new Date(order.orderTime)
    return orderDate >= start && orderDate <= end
  })
}

/* ---------------------- */
/* Оновлення дашборду */
/* ---------------------- */
function updateDashboard(range) {
  const filtered = filterOrdersByRange(range)

  updateMetrics(filtered)
  updateHeaderOrders(filtered) // <-- додаємо сюди
}

function updateHeaderOrders(filteredOrders) {
  ordersCountHeader.textContent = filteredOrders.length.toLocaleString('uk-UA')
}

/* ---------------------- */
/* Метрики */
/* ---------------------- */
function updateMetrics(filtered) {
  const validOrders = filtered.filter(order => !EXCLUDED_STATUSES.includes(order.status))

  const count = validOrders.length

  // оборот
  const turnover = validOrders.reduce((sum, order) => {
    if (order.products && Array.isArray(order.products)) {
      const orderTotal = order.products.reduce((s, product) => {
        return s + (Number(product.price) || 0) * (Number(product.amount) || 0)
      }, 0)
      return sum + orderTotal
    }
    return sum
  }, 0)

  // середній чек
  const avgCheck = count > 0 ? turnover / count : 0

  // прибуток
  const profit = validOrders.reduce((sum, order) => {
    return sum + (Number(order.profitAmount) || 0)
  }, 0)

  document.querySelector('.neon-yellow .metric-value').textContent = turnover.toLocaleString('uk-UA') + ' ₴'

  document.querySelector('.neon-yellow .metric-subtext').textContent = `${count} замовлень`

  document.querySelector('.neon-teal .metric-value').textContent =
    avgCheck.toLocaleString('uk-UA', { maximumFractionDigits: 0 }) + ' ₴'

  document.querySelector('.neon-cyan .metric-value').textContent = profit.toLocaleString('uk-UA') + ' ₴'
}
/* ---------------------- */
/* Select логіка */
/* ---------------------- */
dateRangeSelect.addEventListener('change', e => {
  const value = e.target.value

  // 👉 1. Спочатку очищаємо ВСЕ
  clearAllPickers()

  // 👉 2. Ховаємо всі блоки
  customDateRange.style.display = 'none'
  monthPickerContainer.style.display = 'none'
  yearPickerContainer.style.display = 'none'

  // 👉 3. Показуємо потрібний
  if (value === 'custom') {
    customDateRange.style.display = 'block'
  }

  if (value === 'month') {
    monthPickerContainer.style.display = 'block'

    // відкриваємо календар місяців
    setTimeout(() => {
      monthPickerInput._flatpickr.open()
    }, 0)
  }

  if (value === 'year') {
    yearPickerContainer.style.display = 'block'
  }

  // 👉 4. Оновлюємо дашборд для стандартних
  if (['last_day', 'last_week', 'last_7_days', 'last_14_days'].includes(value)) {
    updateDashboard(value)
  }
})

/* ---------------------- */
/* Flatpickr дати */
/* ---------------------- */
flatpickr(startDateInput, { dateFormat: 'd.m.Y' })
flatpickr(endDateInput, { dateFormat: 'd.m.Y' })

/* ---------------------- */
/* Flatpickr Місяць */
/* ---------------------- */
flatpickr(monthPickerInput, {
  plugins: [
    new monthSelectPlugin({
      shorthand: false,
      dateFormat: 'm.Y',
      altFormat: 'F Y',
    }),
  ],
  onChange: function (selectedDates) {
    if (!selectedDates.length) return
    const date = selectedDates[0]
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    end.setHours(23, 59, 59)

    // Форматуємо назву місяця + рік без "р." і великими літерами
    const monthName = date.toLocaleString('uk-UA', { month: 'long' }).toUpperCase()
    const year = date.getFullYear()
    headerMonth.textContent = `${monthName} ${year}`

    updateDashboardCustom(start, end)
  },
})
/* ---------------------- */
/*  Рік */
/* ---------------------- */
yearSelect.addEventListener('change', () => {
  const year = parseInt(yearSelect.value)
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  end.setHours(23, 59, 59)

  headerMonth.textContent = year.toString() // відображаємо рік у заголовку
  updateDashboardCustom(start, end)
})
function populateYearSelect(startYear = 2020, endYear = new Date().getFullYear()) {
  yearSelect.innerHTML = '' // очищаємо перед додаванням
  for (let y = endYear; y >= startYear; y--) {
    // від нового до старого
    const option = document.createElement('option')
    option.value = y
    option.textContent = y
    yearSelect.appendChild(option)
  }
}

populateYearSelect()

/* ---------------------- */
/* Custom dashboard для місяця/року/гнучкого вибору */
/* ---------------------- */
function updateDashboardCustom(start, end) {
  const filtered = orders.filter(order => {
    const orderDate = new Date(order.orderTime)
    return orderDate >= start && orderDate <= end
  })

  updateMetrics(filtered)
  updateHeaderOrders(filtered) // <-- і тут
}
/* ---------------------- */
/* Парсер дати з формату d.m.Y */
/* ---------------------- */
function parseDate(dateString) {
  const [day, month, year] = dateString.split('.')
  return new Date(year, month - 1, day)
}

/* ---------------------- */
/* Слухачі для custom дат */
/* ---------------------- */
;[startDateInput, endDateInput].forEach(input => {
  input.addEventListener('change', () => {
    updateDashboard('custom') // завжди оновлюємо дашборд, навіть якщо обрана лише одна дата
  })
})
function clearAllPickers() {
  // очищаємо текстові інпути
  startDateInput.value = ''
  endDateInput.value = ''
  monthPickerInput.value = ''

  // очищаємо flatpickr (важливо!)
  if (startDateInput._flatpickr) startDateInput._flatpickr.clear()
  if (endDateInput._flatpickr) endDateInput._flatpickr.clear()
  if (monthPickerInput._flatpickr) monthPickerInput._flatpickr.clear()

  // очищаємо select року
  yearSelect.selectedIndex = -1
}

loadOrders()
