const products = window.SHIGUANG_PRODUCTS || [];
const ORDER_STORAGE_KEY = "shiguang-orders-v1";
const CART_STORAGE_KEY = "shiguang-cart";

function loadStoredJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

const state = {
  cart: loadStoredJson(CART_STORAGE_KEY, {}),
  orders: loadStoredJson(ORDER_STORAGE_KEY, []),
  filter: "全部",
  query: "",
  awaitingOrderId: null,
  checkoutStartedAt: 0,
  activeResultOrderId: null
};

if (!Array.isArray(state.orders)) state.orders = [];

const productGrid = document.querySelector("#productGrid");
const emptyState = document.querySelector("#emptyState");
const cartDrawer = document.querySelector("#cartDrawer");
const ordersDrawer = document.querySelector("#ordersDrawer");
const checkoutDrawer = document.querySelector("#checkoutDrawer");
const searchPanel = document.querySelector("#searchPanel");
const resultDialog = document.querySelector("#resultDialog");
const overlay = document.querySelector("#overlay");
const toast = document.querySelector("#toast");
const panels = [cartDrawer, ordersDrawer, checkoutDrawer, searchPanel];
let toastTimer;

function icon(name) { return `<i data-lucide="${name}"></i>`; }
function refreshIcons() { if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } }); }
function escapeHtml(value = "") { return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function formatDate(value) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function getProduct(id) { return products.find((product) => product.id === Number(id)); }
function getCartEntries() { return Object.entries(state.cart).map(([id, quantity]) => ({ product: getProduct(id), quantity: Number(quantity) })).filter(({ product, quantity }) => product && quantity > 0); }

function renderProducts() {
  const query = state.query.trim().toLowerCase();
  const visible = products.filter((product) => (state.filter === "全部" || product.category === state.filter) && (!query || `${product.name}${product.category}${product.desc}`.toLowerCase().includes(query)));
  productGrid.innerHTML = visible.map((product) => `<article class="product-card"><div class="product-image-wrap"><img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy" />${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}<button class="quick-add" type="button" data-add="${product.id}" aria-label="将${product.name}加入购物袋" title="加入购物袋">${icon("plus")}</button></div><div class="product-info"><span class="product-category">${product.category}</span><h3>${product.name}</h3><span class="product-price">¥${product.price} 起</span><p class="product-desc">${product.desc}</p><a class="product-source" href="${product.sourceUrl}" target="_blank" rel="noreferrer">${product.sourceLabel} ${icon("external-link")}</a></div></article>`).join("");
  emptyState.hidden = visible.length > 0;
  refreshIcons();
}

function addToCart(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  persistCart();
  showToast(`${getProduct(id).name} 已加入购物袋`);
}

function changeQuantity(id, delta) {
  state.cart[id] = Math.max(0, (state.cart[id] || 0) + delta);
  if (!state.cart[id]) delete state.cart[id];
  persistCart();
}

function persistCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
  renderCart();
  renderCheckout();
}

function renderCart() {
  const entries = getCartEntries();
  const totalCount = entries.reduce((sum, { quantity }) => sum + quantity, 0);
  const subtotal = entries.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  document.querySelectorAll(".cart-count, .mobile-cart-count").forEach((node) => { node.textContent = totalCount; });
  document.querySelector("#cartTitleCount").textContent = `(${totalCount})`;
  document.querySelector("#cartEmpty").hidden = entries.length > 0;
  document.querySelector("#cartSummary").hidden = entries.length === 0;
  document.querySelector("#cartSubtotal").textContent = `¥${subtotal} 起`;
  const remaining = Math.max(0, 299 - subtotal);
  document.querySelector("#shippingMessage").textContent = remaining ? `参考金额再选 ¥${remaining} 可达包邮线` : "参考金额已达到包邮线";
  document.querySelector("#shippingBar").style.width = `${Math.min(100, subtotal / 299 * 100)}%`;
  document.querySelector("#cartItems").innerHTML = entries.map(({ product, quantity }) => `<article class="cart-item"><img src="${product.image}" alt="" /><div><h3>${product.name}</h3><span class="cart-item-meta">${product.desc}</span><div class="quantity-control" aria-label="${product.name}数量"><button type="button" data-quantity="-1" data-id="${product.id}" aria-label="减少数量">−</button><span>${quantity}</span><button type="button" data-quantity="1" data-id="${product.id}" aria-label="增加数量">+</button></div></div><div><strong>¥${product.price * quantity} 起</strong><button class="remove-item" type="button" data-remove="${product.id}" aria-label="移除${product.name}">${icon("trash-2")}</button></div></article>`).join("");
  refreshIcons();
}

function renderCheckout() {
  const entries = getCartEntries();
  const total = entries.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  document.querySelector("#checkoutTotal").textContent = `¥${total} 起`;
  document.querySelector("#checkoutItems").innerHTML = entries.map(({ product, quantity }) => `<article class="checkout-item"><img src="${product.image}" alt="" /><div><h3>${product.name} × ${quantity}</h3><p>${product.sourceLabel}<br />参考金额 ¥${product.price * quantity} 起</p><button class="official-checkout" type="button" data-start-checkout="${product.id}">前往官方店选择规格并购买 ${icon("external-link")}</button></div></article>`).join("");
  refreshIcons();
}

function orderStatusLabel(status) {
  return ({ pending: "待确认", placed: "已在天猫下单", not_completed: "未完成购买" })[status] || "待确认";
}

function persistOrders() {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(state.orders));
  renderOrders();
}

function renderOrders() {
  const orders = [...state.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  document.querySelectorAll(".order-count, .mobile-order-count").forEach((node) => { node.textContent = orders.length; });
  document.querySelector("#ordersTitleCount").textContent = `(${orders.length})`;
  document.querySelector("#ordersEmpty").hidden = orders.length > 0;
  document.querySelector("#ordersList").hidden = orders.length === 0;
  document.querySelector("#ordersList").innerHTML = orders.map((order) => `<article class="order-card">
    <div class="order-card-head"><span>${escapeHtml(order.id)} · ${formatDate(order.createdAt)}</span><select class="order-status" data-order-status="${escapeHtml(order.id)}" aria-label="更新订单状态"><option value="pending" ${order.status === "pending" ? "selected" : ""}>待确认</option><option value="placed" ${order.status === "placed" ? "selected" : ""}>已在天猫下单</option><option value="not_completed" ${order.status === "not_completed" ? "selected" : ""}>未完成购买</option></select></div>
    <div class="order-card-product"><img src="${order.image}" alt="" /><div><h3>${escapeHtml(order.productName)} × ${order.quantity}</h3><p>${escapeHtml(order.sourceLabel)}<br />${orderStatusLabel(order.status)} · 更新于 ${formatDate(order.updatedAt)}</p></div><strong>¥${order.referenceTotal} 起</strong></div>
    <label class="order-number-field">天猫订单号（选填，仅本机保存）<input type="text" maxlength="32" inputmode="numeric" data-order-number="${escapeHtml(order.id)}" value="${escapeHtml(order.externalOrderNumber || "")}" placeholder="未填写" /></label>
    <div class="order-card-actions"><a href="${order.sourceUrl}" target="_blank" rel="noreferrer" data-continue-order="${escapeHtml(order.id)}">继续前往官方店 ${icon("external-link")}</a><a href="https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm" target="_blank" rel="noreferrer">订单中心 ${icon("receipt-text")}</a></div>
  </article>`).join("");
  refreshIcons();
}

function makeOrderId() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `SG${date}-${String(Date.now()).slice(-6)}`;
}

function createExternalOrder(product, quantity) {
  const now = new Date().toISOString();
  const order = { id: makeOrderId(), productId: product.id, productName: product.name, quantity, referenceTotal: product.price * quantity, image: product.image, sourceLabel: product.sourceLabel, sourceUrl: product.sourceUrl, status: "pending", externalOrderNumber: "", createdAt: now, updatedAt: now };
  state.orders.push(order);
  persistOrders();
  return order;
}

function openOfficialStore(order) {
  state.awaitingOrderId = order.id;
  state.checkoutStartedAt = Date.now();
  sessionStorage.setItem("shiguang-awaiting-order", order.id);
  closePanels();
  const link = document.createElement("a");
  link.href = order.sourceUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("已生成待确认记录，正在打开天猫官方店");
}

function startExternalCheckout(productId) {
  const product = getProduct(productId);
  const quantity = Number(state.cart[productId] || 1);
  if (product) openOfficialStore(createExternalOrder(product, quantity));
}

function continueExternalOrder(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return;
  order.status = "pending";
  order.updatedAt = new Date().toISOString();
  persistOrders();
  state.awaitingOrderId = order.id;
  state.checkoutStartedAt = Date.now();
  sessionStorage.setItem("shiguang-awaiting-order", order.id);
}

function showResultDialog(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order || resultDialog.open) return;
  state.activeResultOrderId = order.id;
  state.awaitingOrderId = null;
  sessionStorage.removeItem("shiguang-awaiting-order");
  document.querySelector("#resultProduct").textContent = `${order.productName} × ${order.quantity} · ${order.sourceLabel}`;
  document.querySelector("#resultStatus").value = order.status === "pending" ? "placed" : order.status;
  document.querySelector("#resultOrderNumber").value = order.externalOrderNumber || "";
  resultDialog.showModal();
  refreshIcons();
}

function updateOrder(orderId, changes) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return;
  Object.assign(order, changes, { updatedAt: new Date().toISOString() });
  if (order.status === "placed" && state.cart[order.productId]) {
    delete state.cart[order.productId];
    persistCart();
  }
  persistOrders();
}

function exportOrders() {
  const payload = { exportedAt: new Date().toISOString(), note: "支付与履约状态由用户依据天猫订单手动确认", orders: state.orders };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `拾光好物订单记录-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("订单记录已导出");
}

function openPanel(panel) {
  closePanels();
  if (panel === checkoutDrawer) renderCheckout();
  if (panel === ordersDrawer) renderOrders();
  overlay.hidden = false;
  document.body.classList.add("no-scroll");
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  if (panel === searchPanel) setTimeout(() => document.querySelector("#searchInput").focus(), 250);
}

function closePanels() {
  panels.forEach((panel) => { panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); });
  overlay.hidden = true;
  document.body.classList.remove("no-scroll");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function selectFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("active", button.dataset.filter === filter));
  renderProducts();
  document.querySelector("#popular").scrollIntoView({ behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");
  const categoryButton = event.target.closest(".category-tile");
  const checkoutButton = event.target.closest("[data-start-checkout]");
  const continueButton = event.target.closest("[data-continue-order]");
  if (addButton) addToCart(Number(addButton.dataset.add));
  if (quantityButton) changeQuantity(Number(quantityButton.dataset.id), Number(quantityButton.dataset.quantity));
  if (removeButton) { delete state.cart[removeButton.dataset.remove]; persistCart(); }
  if (categoryButton) selectFilter(categoryButton.dataset.filter);
  if (checkoutButton) startExternalCheckout(Number(checkoutButton.dataset.startCheckout));
  if (continueButton) continueExternalOrder(continueButton.dataset.continueOrder);
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-order-status]")) updateOrder(event.target.dataset.orderStatus, { status: event.target.value });
  if (event.target.matches("[data-order-number]")) updateOrder(event.target.dataset.orderNumber, { externalOrderNumber: event.target.value.trim() });
});

document.querySelectorAll(".filter-chip").forEach((button) => button.addEventListener("click", () => selectFilter(button.dataset.filter)));
document.querySelectorAll(".cart-trigger").forEach((button) => button.addEventListener("click", () => openPanel(cartDrawer)));
document.querySelectorAll(".order-trigger").forEach((button) => button.addEventListener("click", () => openPanel(ordersDrawer)));
document.querySelectorAll(".drawer-close, .search-close").forEach((button) => button.addEventListener("click", closePanels));
document.querySelectorAll(".search-trigger").forEach((button) => button.addEventListener("click", () => openPanel(searchPanel)));
document.querySelector("#cartSummary .checkout-button").addEventListener("click", () => openPanel(checkoutDrawer));
document.querySelector("#exportOrders").addEventListener("click", exportOrders);
document.querySelector(".result-close").addEventListener("click", () => resultDialog.close());
overlay.addEventListener("click", closePanels);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePanels(); });

document.querySelector("#resultForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.activeResultOrderId) return;
  updateOrder(state.activeResultOrderId, { status: document.querySelector("#resultStatus").value, externalOrderNumber: document.querySelector("#resultOrderNumber").value.trim() });
  resultDialog.close();
  showToast("结算结果已保存到我的订单");
  openPanel(ordersDrawer);
});

document.querySelector("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  state.filter = "全部";
  document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("active", button.dataset.filter === "全部"));
  renderProducts();
});
document.querySelector("#searchInput").addEventListener("keydown", (event) => { if (event.key === "Enter" && state.query.trim()) { closePanels(); document.querySelector("#popular").scrollIntoView({ behavior: "smooth" }); } });
document.querySelectorAll(".search-suggestions button").forEach((button) => button.addEventListener("click", () => { state.query = button.textContent; document.querySelector("#searchInput").value = state.query; renderProducts(); closePanels(); document.querySelector("#popular").scrollIntoView({ behavior: "smooth" }); }));
document.querySelector("#newsletterForm").addEventListener("submit", (event) => { event.preventDefault(); showToast("订阅成功，下期好物来信见"); event.currentTarget.reset(); });

window.addEventListener("focus", () => {
  const pendingId = state.awaitingOrderId || sessionStorage.getItem("shiguang-awaiting-order");
  if (pendingId && Date.now() - state.checkoutStartedAt > 800) setTimeout(() => showResultDialog(pendingId), 250);
});
window.addEventListener("load", refreshIcons);

renderProducts();
renderCart();
renderCheckout();
renderOrders();
