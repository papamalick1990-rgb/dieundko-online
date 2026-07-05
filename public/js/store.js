/* store.js — Logique de la vitrine publique.
   Toutes les données (produits, catégories) viennent du serveur via l'API.
   Le panier est gardé dans le navigateur du client (localStorage) : c'est propre
   à chaque visiteur et n'a pas besoin d'être sur le serveur avant la commande. */

const API = '/api';

const State = {
  products: [],
  categories: [],
  cart: JSON.parse(localStorage.getItem('dk_cart') || '[]'),
  activeCategory: 'Tous',
  searchTerm: '',
};

function fmtPrice(n){ return Number(n||0).toLocaleString('fr-FR') + ' FCFA'; }
function effectivePrice(p){ return (p.promoPrice != null && p.promoPrice < p.price) ? p.promoPrice : p.price; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function showToast(msg, type){
  const holder = document.getElementById('toast-holder');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' '+type : '');
  el.textContent = msg;
  holder.appendChild(el);
  setTimeout(()=> el.remove(), 3200);
}
function saveCart(){ localStorage.setItem('dk_cart', JSON.stringify(State.cart)); }

async function apiGet(path){
  const r = await fetch(API + path);
  if(!r.ok) throw new Error('Erreur réseau');
  return r.json();
}
async function apiPost(path, body){
  const r = await fetch(API + path, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}

/* ==================== LOAD ==================== */
async function loadAll(){
  try{
    const [products, categories] = await Promise.all([apiGet('/products'), apiGet('/categories')]);
    State.products = products;
    State.categories = categories;
  }catch(e){
    showToast('Impossible de charger le catalogue. Vérifiez la connexion.', 'error');
  }
}

/* ==================== RENDER: HIGHLIGHTS (promos / phares) ==================== */
function hcardImgTag(p){
  if(p.image){
    return `<img src="${escapeHtml(p.image)}" class="hcard-img" alt="${escapeHtml(p.name)}" onerror="this.style.opacity=0.15">`;
  }
  return `<div class="hcard-img"></div>`;
}

function renderPromoRow(){
  const wrap = document.getElementById('promo-section-wrap');
  const row = document.getElementById('promo-row');
  const promos = State.products.filter(p => p.promoPrice != null && p.promoPrice < p.price && p.stock > 0);
  if(promos.length === 0){ wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  row.innerHTML = promos.map(p=>{
    const pct = Math.round((1 - p.promoPrice / p.price) * 100);
    return `<div class="hcard" data-open="${p.id}">
      <span class="ribbon promo">−${pct}%</span>
      ${hcardImgTag(p)}
      <div class="hcard-body">
        <span class="hcard-cat">${escapeHtml(p.category)}</span>
        <span class="hcard-name">${escapeHtml(p.name)}</span>
        <div class="hcard-prices">
          <span class="price-old">${fmtPrice(p.price)}</span>
          <span class="price-new">${fmtPrice(p.promoPrice)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  row.querySelectorAll('[data-open]').forEach(el=> el.addEventListener('click', ()=> openProductDetail(el.dataset.open)));
}

function renderFeaturedRow(){
  const wrap = document.getElementById('featured-section-wrap');
  const row = document.getElementById('featured-row');
  const featured = State.products.filter(p => p.featured);
  if(featured.length === 0){ wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  row.innerHTML = featured.map(p=>{
    const hasPromo = p.promoPrice != null && p.promoPrice < p.price;
    return `<div class="hcard" data-open="${p.id}">
      <span class="ribbon featured">★ Phare</span>
      ${hcardImgTag(p)}
      <div class="hcard-body">
        <span class="hcard-cat">${escapeHtml(p.category)}</span>
        <span class="hcard-name">${escapeHtml(p.name)}</span>
        <div class="hcard-prices">
          ${hasPromo ? `<span class="price-old">${fmtPrice(p.price)}</span><span class="price-new">${fmtPrice(p.promoPrice)}</span>` : `<span class="price-plain">${fmtPrice(p.price)}</span>`}
        </div>
      </div>
    </div>`;
  }).join('');
  row.querySelectorAll('[data-open]').forEach(el=> el.addEventListener('click', ()=> openProductDetail(el.dataset.open)));
}

/* ==================== RENDER: FILTERS + GRID ==================== */
function renderFilters(){
  const bar = document.getElementById('filters-bar');
  const cats = ['Tous', ...State.categories];
  bar.innerHTML = cats.map(c => `<button class="chip ${State.activeCategory===c?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  bar.querySelectorAll('.chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{ State.activeCategory = btn.dataset.cat; renderFilters(); renderGrid(); });
  });
}

function getFilteredProducts(){
  return State.products.filter(p=>{
    const matchCat = State.activeCategory==='Tous' || p.category === State.activeCategory;
    const matchSearch = !State.searchTerm || (p.name+' '+p.description+' '+p.category).toLowerCase().includes(State.searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });
}

function productImgTag(p, cls){
  if(p.image){
    return `<img src="${escapeHtml(p.image)}" class="${cls}" alt="${escapeHtml(p.name)}" onerror="this.outerHTML='<div class=&quot;card-img-fallback&quot;><svg width=&quot;32&quot; height=&quot;32&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;1.5&quot;><rect x=&quot;3&quot; y=&quot;3&quot; width=&quot;18&quot; height=&quot;18&quot; rx=&quot;2&quot;/><circle cx=&quot;8.5&quot; cy=&quot;8.5&quot; r=&quot;1.5&quot;/><path d=&quot;M21 15l-5-5L5 21&quot;/></svg></div>'">`;
  }
  return `<div class="card-img-fallback"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`;
}

function renderGrid(){
  const gridWrap = document.querySelector('.grid-wrap');
  if(State.products.length === 0){
    gridWrap.innerHTML = `<div class="empty-state">
      <div class="stamp-big">VIDE</div>
      <h3>Le rayon est encore vide</h3>
      <p>Aucun produit n'est disponible pour l'instant. Revenez bientôt, de nouveaux articles arrivent régulièrement.</p>
    </div>`;
    return;
  }
  if(!document.getElementById('product-grid')){
    gridWrap.innerHTML = '<div class="product-grid" id="product-grid"></div>';
  }
  const list = getFilteredProducts();
  const gridEl = document.getElementById('product-grid');
  if(list.length === 0){
    gridWrap.innerHTML = `<div class="empty-state">
      <div class="stamp-big">0</div>
      <h3>Aucun résultat</h3>
      <p>Aucun article ne correspond à votre recherche ou à cette catégorie.</p>
    </div>`;
    return;
  }
  gridEl.innerHTML = list.map(p => {
    const out = p.stock <= 0;
    const hasPromo = p.promoPrice != null && p.promoPrice < p.price;
    const priceHtml = hasPromo
      ? `<span class="price-old" style="font-size:12px;">${fmtPrice(p.price)}</span> <span class="price" style="color:var(--coral);">${fmtPrice(p.promoPrice)}</span>`
      : `<span class="price">${fmtPrice(p.price)}</span>`;
    return `<div class="card">
      <div class="sku-strip"></div>
      <span class="sku-label">${escapeHtml(p.sku)}</span>
      ${hasPromo ? `<span class="ribbon promo" style="top:26px;">−${Math.round((1-p.promoPrice/p.price)*100)}%</span>` : ''}
      ${productImgTag(p, 'card-img').replace('<img ', `<img data-open="${p.id}" `)}
      <div class="card-body">
        <span class="card-cat">${escapeHtml(p.category)}</span>
        <span class="card-name" data-open="${p.id}">${escapeHtml(p.name)}</span>
        <span class="card-stock ${out?'out':''}">${out ? 'Rupture de stock' : p.stock + ' en stock'}</span>
        <div class="card-footer">
          <span>${priceHtml}</span>
          <button class="btn btn-dark btn-sm" data-add="${p.id}" ${out?'disabled':''}>+ Panier</button>
        </div>
      </div>
    </div>`;
  }).join('');

  gridEl.querySelectorAll('[data-open]').forEach(el=> el.addEventListener('click', ()=> openProductDetail(el.dataset.open)));
  gridEl.querySelectorAll('[data-add]').forEach(el=> el.addEventListener('click', (e)=>{ e.stopPropagation(); addToCart(el.dataset.add,1); }));
}

/* ==================== PRODUCT DETAIL ==================== */
function openProductDetail(id){
  const p = State.products.find(x=>x.id===id);
  if(!p) return;
  const out = p.stock <= 0;
  const hasPromo = p.promoPrice != null && p.promoPrice < p.price;
  const priceBlock = hasPromo
    ? `<span class="price-old" style="font-size:16px;">${fmtPrice(p.price)}</span> <span class="detail-price" style="color:var(--coral);">${fmtPrice(p.promoPrice)}</span>`
    : `<span class="detail-price">${fmtPrice(p.price)}</span>`;
  document.getElementById('modal-box').innerHTML = `
    <div class="panel-header"><h3>Détail de l'article</h3><button class="close-x" id="modal-close">✕</button></div>
    ${productImgTag(p,'detail-img')}
    <div class="detail-body">
      <span class="detail-cat">${escapeHtml(p.category)} · <span class="mono">${escapeHtml(p.sku)}</span> ${p.featured ? '· <span style="color:var(--mustard); font-weight:700;">★ Produit phare</span>' : ''}</span>
      <h2 class="detail-title">${escapeHtml(p.name)}</h2>
      <p class="detail-desc">${escapeHtml(p.description || "Pas de description pour cet article.")}</p>
      <div class="detail-price-row">
        <span>${priceBlock}</span>
        <span class="card-stock ${out?'out':''}">${out ? 'Rupture de stock' : p.stock + ' en stock'}</span>
      </div>
      <button class="btn btn-dark btn-block" id="detail-add-btn" ${out?'disabled':''}>Ajouter au panier</button>
    </div>`;
  openOverlay('modal-overlay');
  document.getElementById('modal-close').addEventListener('click', ()=> closeOverlay('modal-overlay'));
  document.getElementById('detail-add-btn').addEventListener('click', ()=>{ addToCart(p.id,1); closeOverlay('modal-overlay'); });
}

/* ==================== CART ==================== */
function addToCart(productId, qty){
  const p = State.products.find(x=>x.id===productId);
  if(!p) return;
  const existing = State.cart.find(c=>c.productId===productId);
  const currentQty = existing ? existing.qty : 0;
  if(currentQty + qty > p.stock){ showToast('Stock insuffisant pour cet article.', 'error'); return; }
  if(existing){ existing.qty += qty; } else { State.cart.push({productId, qty}); }
  saveCart();
  renderCartCount();
  renderCartDrawer();
  showToast(p.name + ' ajouté au panier', 'success');
}
function updateCartQty(productId, delta){
  const item = State.cart.find(c=>c.productId===productId);
  if(!item) return;
  const p = State.products.find(x=>x.id===productId);
  const newQty = item.qty + delta;
  if(newQty <= 0){ State.cart = State.cart.filter(c=>c.productId!==productId); }
  else if(p && newQty > p.stock){ showToast('Stock maximum atteint.', 'error'); return; }
  else { item.qty = newQty; }
  saveCart();
  renderCartCount(); renderCartDrawer();
}
function removeFromCart(productId){
  State.cart = State.cart.filter(c=>c.productId!==productId);
  saveCart();
  renderCartCount(); renderCartDrawer();
}
function cartTotal(){
  return State.cart.reduce((sum,c)=>{
    const p = State.products.find(x=>x.id===c.productId);
    return sum + (p ? effectivePrice(p) * c.qty : 0);
  },0);
}
function renderCartCount(){
  const count = State.cart.reduce((s,c)=>s+c.qty,0);
  const el = document.getElementById('cart-count');
  el.textContent = count;
  el.classList.toggle('hidden', count===0);
}
function renderCartDrawer(){
  const itemsEl = document.getElementById('cart-items');
  const footerEl = document.getElementById('cart-footer');
  // retirer du panier les articles qui n'existent plus (supprimés côté vendeur entre-temps)
  State.cart = State.cart.filter(c=> State.products.some(p=>p.id===c.productId));
  if(State.cart.length===0){
    itemsEl.innerHTML = `<div class="empty-state"><div class="stamp-big">∅</div><h3>Panier vide</h3><p>Ajoutez des articles depuis le catalogue.</p></div>`;
    footerEl.innerHTML = '';
    return;
  }
  itemsEl.innerHTML = State.cart.map(c=>{
    const p = State.products.find(x=>x.id===c.productId);
    if(!p) return '';
    return `<div class="slip-item">
      ${productImgTag(p,'')}
      <div class="slip-item-info">
        <div class="nm">${escapeHtml(p.name)}</div>
        <div class="cat">${escapeHtml(p.sku)}</div>
        <div class="qty-control">
          <button data-dec="${p.id}">−</button><span>${c.qty}</span><button data-inc="${p.id}">+</button>
        </div>
        <button class="slip-item-remove" data-remove="${p.id}">Retirer</button>
      </div>
      <div class="slip-item-price">${fmtPrice(effectivePrice(p) * c.qty)}</div>
    </div>`;
  }).join('');
  const total = cartTotal();
  footerEl.innerHTML = `
    <div class="total-row"><span>Sous-total</span><span>${fmtPrice(total)}</span></div>
    <div class="total-row grand"><span>Total</span><span>${fmtPrice(total)}</span></div>
    <button class="btn btn-coral btn-block" id="checkout-btn" style="margin-top:12px;">Passer la commande</button>`;

  itemsEl.querySelectorAll('[data-inc]').forEach(b=>b.addEventListener('click', ()=>updateCartQty(b.dataset.inc,1)));
  itemsEl.querySelectorAll('[data-dec]').forEach(b=>b.addEventListener('click', ()=>updateCartQty(b.dataset.dec,-1)));
  itemsEl.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click', ()=>removeFromCart(b.dataset.remove)));
  const checkoutBtn = document.getElementById('checkout-btn');
  if(checkoutBtn) checkoutBtn.addEventListener('click', openCheckout);
}

/* ==================== CHECKOUT ==================== */
function openCheckout(){
  if(State.cart.length===0) return;
  closeOverlay('cart-overlay');
  const total = cartTotal();
  document.getElementById('modal-box').innerHTML = `
    <div class="panel-header"><h3>Finaliser la commande</h3><button class="close-x" id="modal-close">✕</button></div>
    <div class="panel-body">
      <div class="form-group"><label>Nom complet</label><input type="text" id="ck-name" placeholder="Ex : Awa Diop"></div>
      <div class="form-group"><label>Téléphone</label><input type="tel" id="ck-phone" placeholder="Ex : 77 123 45 67"></div>
      <div class="form-group"><label>Adresse de livraison</label><textarea id="ck-address" rows="2" placeholder="Quartier, ville, point de repère…"></textarea></div>
      <div class="form-group">
        <label>Mode de paiement</label>
        <label class="radio-card checked"><input type="radio" name="pay" value="Paiement à la livraison" checked> Paiement à la livraison</label>
        <label class="radio-card"><input type="radio" name="pay" value="Wave"> Wave</label>
        <label class="radio-card"><input type="radio" name="pay" value="Orange Money"> Orange Money</label>
      </div>
      <div style="border-top:2px dashed var(--line); margin:16px 0; padding-top:14px;">
        <div class="total-row grand"><span>Total à payer</span><span>${fmtPrice(total)}</span></div>
      </div>
      <div id="ck-error" class="hidden" style="color:var(--coral); font-size:12px; margin-bottom:10px;"></div>
      <button class="btn btn-coral btn-block" id="ck-submit">Confirmer la commande</button>
    </div>`;
  openOverlay('modal-overlay');
  document.getElementById('modal-close').addEventListener('click', ()=> closeOverlay('modal-overlay'));
  document.querySelectorAll('input[name="pay"]').forEach(r=>{
    r.addEventListener('change', ()=>{
      document.querySelectorAll('.radio-card').forEach(c=>c.classList.remove('checked'));
      r.closest('.radio-card').classList.add('checked');
    });
  });
  document.getElementById('ck-submit').addEventListener('click', submitOrder);
}

async function submitOrder(){
  const name = document.getElementById('ck-name').value.trim();
  const phone = document.getElementById('ck-phone').value.trim();
  const address = document.getElementById('ck-address').value.trim();
  const payment = document.querySelector('input[name="pay"]:checked').value;
  const errEl = document.getElementById('ck-error');
  const submitBtn = document.getElementById('ck-submit');
  if(!name || !phone || !address){
    errEl.textContent = 'Merci de remplir tous les champs.';
    errEl.classList.remove('hidden');
    return;
  }
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi en cours…';
  try{
    const items = State.cart.map(c=>({ productId: c.productId, qty: c.qty }));
    const order = await apiPost('/orders', {
      customerName: name, phone, address, paymentMethod: payment, items
    });
    State.cart = [];
    saveCart();
    await loadAll(); // recharger le catalogue (stock à jour)
    renderCartCount(); renderFilters(); renderGrid(); renderPromoRow(); renderFeaturedRow();
    showOrderConfirmation(order);
  }catch(e){
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirmer la commande';
  }
}

function showOrderConfirmation(order){
  document.getElementById('modal-box').innerHTML = `
    <div class="panel-header"><h3>Commande confirmée</h3><button class="close-x" id="modal-close">✕</button></div>
    <div class="panel-body" style="text-align:center;">
      <div class="stamp-big" style="margin:10px auto 18px; border-color:var(--sage); color:var(--sage);">✓</div>
      <h2 style="font-size:20px; margin-bottom:8px;">Merci, ${escapeHtml(order.customerName)} !</h2>
      <p style="color:var(--ink-soft); font-size:14px; margin-bottom:16px;">Votre commande <span class="mono" style="font-weight:700;">${order.orderNumber}</span> a bien été enregistrée. Le vendeur vous contactera au ${escapeHtml(order.phone)} pour confirmer la livraison.</p>
      <div class="total-row grand" style="justify-content:center; gap:10px;"><span>Total</span><span>${fmtPrice(order.total)}</span></div>
      <button class="btn btn-dark" style="margin-top:20px;" id="modal-done-btn">Continuer mes achats</button>
    </div>`;
  document.getElementById('modal-close').addEventListener('click', ()=> closeOverlay('modal-overlay'));
  document.getElementById('modal-done-btn').addEventListener('click', ()=> closeOverlay('modal-overlay'));
}

/* ==================== OVERLAY HELPERS ==================== */
function openOverlay(id){ document.getElementById(id).classList.add('open'); }
function closeOverlay(id){ document.getElementById(id).classList.remove('open'); }

/* ==================== SECRET ADMIN ACCESS ==================== */
let secretBuffer = '';
const SECRET_CODE = 'vendeur';
window.addEventListener('keydown', (e)=>{
  secretBuffer += e.key.toLowerCase();
  if(secretBuffer.length > SECRET_CODE.length) secretBuffer = secretBuffer.slice(-SECRET_CODE.length);
  if(secretBuffer === SECRET_CODE){ window.location.href = '/admin.html'; }
});

/* ==================== WIRING ==================== */
function wireEvents(){
  document.getElementById('search-input').addEventListener('input', (e)=>{
    State.searchTerm = e.target.value; renderGrid();
  });
  document.getElementById('cart-open-btn').addEventListener('click', ()=>{ renderCartDrawer(); openOverlay('cart-overlay'); });
  document.getElementById('cart-close-btn').addEventListener('click', ()=> closeOverlay('cart-overlay'));
  document.getElementById('cart-overlay').addEventListener('click', (e)=>{ if(e.target.id==='cart-overlay') closeOverlay('cart-overlay'); });
  document.getElementById('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='modal-overlay') closeOverlay('modal-overlay'); });
}

(async function boot(){
  await loadAll();
  renderPromoRow();
  renderFeaturedRow();
  renderFilters();
  renderGrid();
  renderCartCount();
  wireEvents();
})();
