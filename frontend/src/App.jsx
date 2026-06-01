import { useEffect, useMemo, useState } from 'react'
import { api } from './services/api'

const TABS = ['Dashboard', 'Products', 'Customers', 'Orders']

const initialProductForm = { name: '', sku: '', price: '', quantity: '' }
const initialCustomerForm = { full_name: '', email: '', phone: '' }

function App() {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [dashboard, setDashboard] = useState(null)

  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])

  const [productForm, setProductForm] = useState(initialProductForm)
  const [editingProductId, setEditingProductId] = useState(null)
  const [customerForm, setCustomerForm] = useState(initialCustomerForm)

  const [orderCustomerId, setOrderCustomerId] = useState('')
  const [orderItems, setOrderItems] = useState([{ product_id: '', quantity: '' }])
  const [selectedOrder, setSelectedOrder] = useState(null)

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const clearMessages = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  async function loadAll() {
    setLoading(true)
    clearMessages()
    try {
      const [dashboardData, productsData, customersData, ordersData] = await Promise.all([
        api.getDashboard(),
        api.getProducts(),
        api.getCustomers(),
        api.getOrders(),
      ])
      setDashboard(dashboardData)
      setProducts(productsData)
      setCustomers(customersData)
      setOrders(ordersData)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const orderPreviewTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const product = products.find((p) => p.id === Number(item.product_id))
      const quantity = Number(item.quantity) || 0
      return sum + (product?.price || 0) * quantity
    }, 0)
  }, [orderItems, products])

  const handleProductSubmit = async (event) => {
    event.preventDefault()
    clearMessages()
    const payload = {
      ...productForm,
      price: Number(productForm.price),
      quantity: Number(productForm.quantity),
    }

    try {
      if (editingProductId) {
        await api.updateProduct(editingProductId, payload)
        setSuccessMessage('Product updated successfully')
      } else {
        await api.createProduct(payload)
        setSuccessMessage('Product added successfully')
      }
      setProductForm(initialProductForm)
      setEditingProductId(null)
      await loadAll()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const editProduct = (product) => {
    setEditingProductId(product.id)
    setProductForm({
      name: product.name,
      sku: product.sku,
      price: String(product.price),
      quantity: String(product.quantity),
    })
    setActiveTab('Products')
  }

  const removeProduct = async (id) => {
    clearMessages()
    try {
      await api.deleteProduct(id)
      setSuccessMessage('Product deleted')
      await loadAll()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const handleCustomerSubmit = async (event) => {
    event.preventDefault()
    clearMessages()
    try {
      await api.createCustomer(customerForm)
      setCustomerForm(initialCustomerForm)
      setSuccessMessage('Customer added successfully')
      await loadAll()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const removeCustomer = async (id) => {
    clearMessages()
    try {
      await api.deleteCustomer(id)
      setSuccessMessage('Customer deleted')
      await loadAll()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const addOrderItemRow = () => {
    setOrderItems((prev) => [...prev, { product_id: '', quantity: '' }])
  }

  const handleOrderItemChange = (index, field, value) => {
    setOrderItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const removeOrderItemRow = (index) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleCreateOrder = async (event) => {
    event.preventDefault()
    clearMessages()

    const cleanedItems = orderItems
      .filter((item) => item.product_id && item.quantity)
      .map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity) }))

    if (!orderCustomerId || cleanedItems.length === 0) {
      setErrorMessage('Please select a customer and add at least one product')
      return
    }

    try {
      await api.createOrder({ customer_id: Number(orderCustomerId), items: cleanedItems })
      setOrderItems([{ product_id: '', quantity: '' }])
      setOrderCustomerId('')
      setSuccessMessage('Order created successfully')
      await loadAll()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const removeOrder = async (id) => {
    clearMessages()
    try {
      await api.deleteOrder(id)
      setSelectedOrder(null)
      setSuccessMessage('Order cancelled and inventory restored')
      await loadAll()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const fetchOrderDetails = async (id) => {
    clearMessages()
    try {
      const details = await api.getOrderById(id)
      setSelectedOrder(details)
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Inventory & Order Management</h1>
        <p>Production-ready starter with React, FastAPI, and PostgreSQL</p>
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </nav>

      {loading && <p className="info">Loading data...</p>}
      {errorMessage && <p className="message error">{errorMessage}</p>}
      {successMessage && <p className="message success">{successMessage}</p>}

      {activeTab === 'Dashboard' && dashboard && (
        <section className="grid four">
          <SummaryCard label="Total Products" value={dashboard.total_products} />
          <SummaryCard label="Total Customers" value={dashboard.total_customers} />
          <SummaryCard label="Total Orders" value={dashboard.total_orders} />
          <SummaryCard label="Low Stock Products" value={dashboard.low_stock_products} />
        </section>
      )}

      {activeTab === 'Products' && (
        <section className="grid two">
          <div className="card">
            <h2>{editingProductId ? 'Update Product' : 'Add Product'}</h2>
            <form onSubmit={handleProductSubmit} className="form">
              <label>
                Product Name
                <input
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </label>
              <label>
                SKU
                <input
                  required
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                />
              </label>
              <label>
                Price
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                />
              </label>
              <label>
                Quantity
                <input
                  required
                  type="number"
                  min="0"
                  value={productForm.quantity}
                  onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                />
              </label>
              <div className="row">
                <button type="submit">{editingProductId ? 'Save Changes' : 'Add Product'}</button>
                {editingProductId && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingProductId(null)
                      setProductForm(initialProductForm)
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h2>Product List</h2>
            <DataTable
              columns={['ID', 'Name', 'SKU', 'Price', 'Stock', 'Actions']}
              rows={products.map((product) => [
                product.id,
                product.name,
                product.sku,
                `$${Number(product.price).toFixed(2)}`,
                product.quantity,
                <div className="row" key={`actions-${product.id}`}>
                  <button type="button" className="secondary" onClick={() => editProduct(product)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => removeProduct(product.id)}>
                    Delete
                  </button>
                </div>,
              ])}
            />
          </div>
        </section>
      )}

      {activeTab === 'Customers' && (
        <section className="grid two">
          <div className="card">
            <h2>Add Customer</h2>
            <form onSubmit={handleCustomerSubmit} className="form">
              <label>
                Full Name
                <input
                  required
                  value={customerForm.full_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  required
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </label>
              <button type="submit">Add Customer</button>
            </form>
          </div>

          <div className="card">
            <h2>Customer List</h2>
            <DataTable
              columns={['ID', 'Name', 'Email', 'Phone', 'Actions']}
              rows={customers.map((customer) => [
                customer.id,
                customer.full_name,
                customer.email,
                customer.phone,
                <button type="button" className="danger" onClick={() => removeCustomer(customer.id)}>
                  Delete
                </button>,
              ])}
            />
          </div>
        </section>
      )}

      {activeTab === 'Orders' && (
        <section className="grid two">
          <div className="card">
            <h2>Create Order</h2>
            <form onSubmit={handleCreateOrder} className="form">
              <label>
                Customer
                <select
                  required
                  value={orderCustomerId}
                  onChange={(e) => setOrderCustomerId(e.target.value)}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} ({customer.email})
                    </option>
                  ))}
                </select>
              </label>

              {orderItems.map((item, index) => (
                <div className="order-row" key={`order-item-${index}`}>
                  <select
                    required
                    value={item.product_id}
                    onChange={(e) => handleOrderItemChange(index, 'product_id', e.target.value)}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku}) - ${Number(product.price).toFixed(2)} - Stock: {product.quantity}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleOrderItemChange(index, 'quantity', e.target.value)}
                  />
                  <button type="button" className="secondary" onClick={() => removeOrderItemRow(index)}>
                    Remove
                  </button>
                </div>
              ))}

              <div className="row">
                <button type="button" className="secondary" onClick={addOrderItemRow}>
                  Add Item
                </button>
                <p className="preview">Estimated total: ${orderPreviewTotal.toFixed(2)}</p>
              </div>

              <button type="submit">Create Order</button>
            </form>
          </div>

          <div className="card">
            <h2>Orders</h2>
            <DataTable
              columns={['ID', 'Customer ID', 'Total', 'Items', 'Actions']}
              rows={orders.map((order) => [
                order.id,
                order.customer_id,
                `$${Number(order.total_amount).toFixed(2)}`,
                order.items?.length || 0,
                <div className="row" key={`order-actions-${order.id}`}>
                  <button type="button" className="secondary" onClick={() => fetchOrderDetails(order.id)}>
                    Details
                  </button>
                  <button type="button" className="danger" onClick={() => removeOrder(order.id)}>
                    Cancel
                  </button>
                </div>,
              ])}
            />

            {selectedOrder && (
              <div className="order-details">
                <h3>Order #{selectedOrder.id}</h3>
                <p>Customer ID: {selectedOrder.customer_id}</p>
                <p>Total: ${Number(selectedOrder.total_amount).toFixed(2)}</p>
                <ul>
                  {selectedOrder.items.map((item) => (
                    <li key={item.id}>
                      Product ID {item.product_id}, Qty {item.quantity}, Unit ${Number(item.unit_price).toFixed(2)}, Line ${Number(item.line_total).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <article className="card summary">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  )
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No data available</td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default App
