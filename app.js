const products = window.SHIGUANG_PRODUCTS || [];

const state = { cart: JSON.parse(localStorage.getItem("shiguang-cart") || "{}"), filter: "全部", query: "" };
const productGrid = document.querySelector("#productGrid");
const emptyState = document.querySelector("#emptyState");
const cartDrawer = document.querySelector("#cartDrawer");
const searchPanel = document.querySelector("#searchPanel");
const overlay = document.querySelector("#overlay");
const toast = document.querySelector("#toast");
let toastTimer;

function icon(name) { return `<i data-lucide="${name}"></i>`; }
function refreshIcons() { if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } }); }

function renderProducts() {
  const query = state.query.trim().toLowerCase();
  const visible = products.filter((product) => (state.filter === "全部" || product.category === state.filter) && (!query || `${product.name}${product.category}${product.desc}`.toLowerCase().includes(query)));
  productGrid.innerHTML = visible.map((product) => `<article class="product-card"><div class="product-image-wrap"><img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy" />${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}<button class="quick-add" type="button" data-add="${product.id}" aria-label="将${product.name}加入购物袋" title="加入购物袋">${icon("plus")}</button></div><div class="product-info"><span class="product-category">${product.category}</span><h3>${product.name}</h3><span class="product-price">¥${product.price} 起</span><p class="product-desc">${product.desc}</p><a class="product-source" href="${product.sourceUrl}" target="_blank" rel="noreferrer">${product.sourceLabel} ${icon("external-link")}</a></div></article>`).join("");
  emptyState.hidden = visible.length > 0;
  refreshIcons();
}

function addToCart(id) { state.cart[id] = (state.cart[id] || 0) + 1; persistCart(); showToast(`${products.find((item) => item.id === id).name} 已加入购物袋`); }
function changeQuantity(id, delta) { state.cart[id] = Math.max(0, (state.cart[id] || 0) + delta); if (!state.cart[id]) delete state.cart[id]; persistCart(); }
function persistCart() { localStorage.setItem("shiguang-cart", JSON.stringify(state.cart)); renderCart(); }

function renderCart() {
  const entries = Object.entries(state.cart).filter(([, quantity]) => quantity > 0);
  const totalCount = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const subtotal = entries.reduce((sum, [id, quantity]) => sum + products.find((item) => item.id === Number(id)).price * quantity, 0);
  document.querySelectorAll(".cart-count, .mobile-cart-count").forEach((node) => node.textContent = totalCount);
  document.querySelector("#cartTitleCount").textContent = `(${totalCount})`;
  document.querySelector("#cartEmpty").hidden = entries.length > 0;
  document.querySelector("#cartSummary").hidden = entries.length === 0;
  document.querySelector("#cartSubtotal").textContent = `¥${subtotal}`;
  const remaining = Math.max(0, 299 - subtotal);
  document.querySelector("#shippingMessage").textContent = remaining ? `再选 ¥${remaining} 即可包邮` : "已享包邮";
  document.querySelector("#shippingBar").style.width = `${Math.min(100, subtotal / 299 * 100)}%`;
  document.querySelector("#cartItems").innerHTML = entries.map(([id, quantity]) => { const product = products.find((item) => item.id === Number(id)); return `<article class="cart-item"><img src="${product.image}" alt="" /><div><h3>${product.name}</h3><span class="cart-item-meta">${product.desc}</span><div class="quantity-control" aria-label="${product.name}数量"><button type="button" data-quantity="-1" data-id="${id}" aria-label="减少数量">−</button><span>${quantity}</span><button type="button" data-quantity="1" data-id="${id}" aria-label="增加数量">+</button></div></div><div><strong>¥${product.price * quantity}</strong><button class="remove-item" type="button" data-remove="${id}" aria-label="移除${product.name}">${icon("trash-2")}</button></div></article>`; }).join("");
  refreshIcons();
}

function openPanel(panel) { closePanels(); overlay.hidden = false; document.body.classList.add("no-scroll"); panel.classList.add("open"); panel.setAttribute("aria-hidden", "false"); if (panel === searchPanel) setTimeout(() => document.querySelector("#searchInput").focus(), 250); }
function closePanels() { [cartDrawer, searchPanel].forEach((panel) => { panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); }); overlay.hidden = true; document.body.classList.remove("no-scroll"); }
function showToast(message) { clearTimeout(toastTimer); toast.textContent = message; toast.classList.add("show"); toastTimer = setTimeout(() => toast.classList.remove("show"), 2200); }
function selectFilter(filter) { state.filter = filter; document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("active", button.dataset.filter === filter)); renderProducts(); document.querySelector("#popular").scrollIntoView({ behavior: "smooth" }); }

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]"); const quantityButton = event.target.closest("[data-quantity]"); const removeButton = event.target.closest("[data-remove]"); const categoryButton = event.target.closest(".category-tile");
  if (addButton) addToCart(Number(addButton.dataset.add));
  if (quantityButton) changeQuantity(Number(quantityButton.dataset.id), Number(quantityButton.dataset.quantity));
  if (removeButton) { delete state.cart[removeButton.dataset.remove]; persistCart(); }
  if (categoryButton) selectFilter(categoryButton.dataset.filter);
});
document.querySelectorAll(".filter-chip").forEach((button) => button.addEventListener("click", () => selectFilter(button.dataset.filter)));
document.querySelectorAll(".cart-trigger").forEach((button) => button.addEventListener("click", () => openPanel(cartDrawer)));
document.querySelectorAll(".drawer-close, .search-close").forEach((button) => button.addEventListener("click", closePanels));
document.querySelectorAll(".search-trigger").forEach((button) => button.addEventListener("click", () => openPanel(searchPanel)));
overlay.addEventListener("click", closePanels);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePanels(); });
document.querySelector("#searchInput").addEventListener("input", (event) => { state.query = event.target.value; state.filter = "全部"; document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("active", button.dataset.filter === "全部")); renderProducts(); });
document.querySelector("#searchInput").addEventListener("keydown", (event) => { if (event.key === "Enter" && state.query.trim()) { closePanels(); document.querySelector("#popular").scrollIntoView({ behavior: "smooth" }); } });
document.querySelectorAll(".search-suggestions button").forEach((button) => button.addEventListener("click", () => { state.query = button.textContent; document.querySelector("#searchInput").value = state.query; renderProducts(); closePanels(); document.querySelector("#popular").scrollIntoView({ behavior: "smooth" }); }));
document.querySelector("#newsletterForm").addEventListener("submit", (event) => { event.preventDefault(); showToast("订阅成功，下期好物来信见"); event.currentTarget.reset(); });
document.querySelector(".checkout-button").addEventListener("click", () => showToast("结算功能演示：订单已准备好"));
window.addEventListener("load", refreshIcons);
renderProducts(); renderCart();
