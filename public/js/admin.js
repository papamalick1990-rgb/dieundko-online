/* admin.js — Espace vendeur. Toutes les actions passent par l'API, protégées
   par un jeton de session (JWT) obtenu après connexion et envoyé dans
   l'en-tête Authorization de chaque requête. */

const API = '/api';
let TOKEN = localStorage.getItem('dk_admin_token') || null;

const State = { products: [], categories: [], orders: [], editingProductId: null };

function fmtPrice(n){ return Number(n||0).toLocaleString('fr-FR') + ' FCFA'; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showToast(msg, type){
  const holder = document.getElementById('toast-holder');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' '+type : '');
  el.textContent = msg;
  holder.appendChild(el);
  setTimeout(()=> el.remove(), 3200);
}

async function apiFetch(path, options = {}){
  options.headers = options.headers || {};
  if(TOKEN) options.headers['Authorization'] = 'Bearer ' + TOKEN;
  const r = await fetch(API + path, options);
  if(r.status === 401){
    logout();
    throw new Error('Session expirée. Reconnectez-vous.');
  }
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}

function logout(){
  TOKEN = null;
  localStorage.removeItem('dk_admin_token');
  showGate();
}

/* ==================== GATE / LOGIN ==================== */
function showGate(){
  document.getElementById('admin-gate').classList.remove('hidden');
  document.getElementById('admin-shell').classList.add('hidden');
  document.getElementById('admin-password').value = '';
}
async function showShell(){
  document.getElementById('admin-gate').classList.add('hidden');
  document.getElementById('admin-shell').classList.remove('hidden');
  await loadAllAdmin();
  renderAdminAll();
}

async function attemptLogin(){
  const password = document.getElementById('admin-password').value;
  const errEl = document.getElementById('gate-error');
  errEl.classList.add('hidden');
  try{
    const data = await fetch(API + '/admin/login', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password })
    }).then(async r=>{
      const d = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error || 'Mot de passe incorrect.');
      return d;
    });
    TOKEN = data.token;
    localStorage.setItem('dk_admin_token', TOKEN);
    await showShell();
  }catch(e){
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

/* ==================== LOAD ==================== */
async function loadAllAdmin(){
  const [products, categories, orders] = await Promise.all([
    fetch(API+'/products').then(r=>r.json()),
    fetch(API+'/categories').then(r=>r.json()),
    apiFetch('/orders'), // orders route is mounted under /api/orders but protected GET
  ]);
  State.products = products; State.categories = categories; State.orders = orders;
}

/* ==================== DASHBOARD ==================== */
function statusLabel(s){ return {en_attente:'En attente', traitee:'Traitée', annulee:'Annulée'}[s] || s; }

function renderAdminStats(){
  const totalRevenue = State.orders.reduce((s,o)=>s+o.total,0);
  const pending = State.orders.filter(o=>o.status==='en_attente').length;
  document.getElementById('stat-row').innerHTML = `
    <div class="stat-card"><div class="num">${State.products.length}</div><div class="lbl">Produits en catalogue</div></div>
    <div class="stat-card"><div class="num">${State.orders.length}</div><div class="lbl">Commandes reçues</div></div>
    <div class="stat-card"><div class="num">${pending}</div><div class="lbl">En attente de traitement</div></div>
    <div class="stat-card"><div class="num">${fmtPrice(totalRevenue)}</div><div class="lbl">Chiffre d'affaires total</div></div>`;
  const body = document.getElementById('dashboard-orders-body');
  const recent = [...State.orders].reverse().slice(0,6);
  body.innerHTML = recent.length ? recent.map(o=>`
    <tr><td class="mono">${o.orderNumber}</td><td>${escapeHtml(o.customerName)}</td><td class="mono">${fmtPrice(o.total)}</td>
    <td><span class="status-pill status-${o.status}">${statusLabel(o.status)}</span></td>
    <td>${new Date(o.createdAt).toLocaleDateString('fr-FR')}</td></tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center; color:var(--ink-soft); padding:24px;">Aucune commande pour l'instant.</td></tr>`;
}

/* ==================== PRODUCTS ==================== */
function renderAdminProducts(){
  document.getElementById('product-count').textContent = State.products.length;
  const body = document.getElementById('admin-products-body');
  body.innerHTML = State.products.length ? State.products.map(p=>{
    const hasPromo = p.promoPrice != null && p.promoPrice < p.price;
    const priceCell = hasPromo
      ? `<span style="text-decoration:line-through; color:var(--ink-soft); font-size:11px;">${fmtPrice(p.price)}</span><br><span style="color:var(--coral); font-weight:700;">${fmtPrice(p.promoPrice)}</span>`
      : fmtPrice(p.price);
    return `<tr>
      <td>${p.image ? `<img src="${escapeHtml(p.image)}" class="thumb" onerror="this.style.opacity=0.3">` : '<div class="thumb"></div>'}</td>
      <td style="font-weight:600;">${escapeHtml(p.name)} ${p.featured ? '<span class="status-pill status-traitee" style="margin-left:4px;">★ Phare</span>' : ''}</td>
      <td class="mono">${escapeHtml(p.sku)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td class="mono">${priceCell}</td>
      <td>${p.stock}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Modifier</button>
        <button class="btn btn-ghost btn-sm" data-del="${p.id}" style="color:var(--coral);">Supprimer</button>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" style="text-align:center; color:var(--ink-soft); padding:24px;">Aucun produit. Cliquez sur "Ajouter un produit" pour commencer.</td></tr>`;
  body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>openProductForm(b.dataset.edit)));
  body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>deleteProduct(b.dataset.del)));
}

function openProductForm(productId){
  State.editingProductId = productId || null;
  const p = productId ? State.products.find(x=>x.id===productId) : null;
  document.getElementById('modal-box').innerHTML = `
    <div class="panel-header"><h3>${p ? 'Modifier le produit' : 'Ajouter un produit'}</h3><button class="close-x" id="modal-close">✕</button></div>
    <div class="panel-body">
      <div class="form-group"><label>Nom du produit</label><input type="text" id="pf-name" value="${p?escapeHtml(p.name):''}" placeholder="Ex : Sac à main en cuir"></div>
      <div class="form-group"><label>Description</label><textarea id="pf-desc" rows="3" placeholder="Décrivez l'article…">${p?escapeHtml(p.description):''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Prix (FCFA)</label><input type="number" id="pf-price" min="0" value="${p?p.price:''}" placeholder="Ex : 15000"></div>
        <div class="form-group"><label>Stock disponible</label><input type="number" id="pf-stock" min="0" value="${p?p.stock:''}" placeholder="Ex : 10"></div>
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <select id="pf-category">
          ${State.categories.map(c=>`<option value="${escapeHtml(c)}" ${p&&p.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="radio-card ${p&&p.featured?'checked':''}" id="pf-featured-label" style="cursor:pointer;">
          <input type="checkbox" id="pf-featured" ${p&&p.featured?'checked':''}> ★ Mettre en avant comme "produit phare" sur la page d'accueil
        </label>
      </div>
      <div class="form-group">
        <label>Prix promotionnel (FCFA) — optionnel</label>
        <input type="number" id="pf-promo-price" min="0" value="${p&&p.promoPrice!=null?p.promoPrice:''}" placeholder="Laissez vide si pas de promotion">
        <div class="form-hint">Si rempli, l'article apparaît dans la section "En promotion" avec le prix barré.</div>
      </div>
      <div class="form-group">
        <label>Image — importer un fichier</label>
        <input type="file" id="pf-image-file" accept="image/png,image/jpeg,image/webp,image/gif">
        <div class="form-hint">JPG, PNG, WEBP ou GIF, 5 Mo maximum.</div>
      </div>
      <div class="form-group">
        <label>…ou coller un lien d'image</label>
        <input type="text" id="pf-image-url" value="${p&&!p.image?.startsWith('/uploads')?escapeHtml(p?.image||''):''}" placeholder="https://…">
        <img id="pf-image-preview" class="img-preview ${p&&p.image?'':'hidden'}" src="${p?escapeHtml(p.image||''):''}" onerror="this.classList.add('hidden')">
      </div>
      <div id="pf-error" class="hidden" style="color:var(--coral); font-size:12px; margin-bottom:10px;"></div>
      <button class="btn btn-dark btn-block" id="pf-submit">${p ? 'Enregistrer les modifications' : 'Ajouter au catalogue'}</button>
    </div>`;
  openOverlay('modal-overlay');
  document.getElementById('modal-close').addEventListener('click', ()=> closeOverlay('modal-overlay'));
  document.getElementById('pf-featured').addEventListener('change', (e)=>{
    document.getElementById('pf-featured-label').classList.toggle('checked', e.target.checked);
  });
  document.getElementById('pf-image-url').addEventListener('input', (e)=>{
    const prev = document.getElementById('pf-image-preview');
    if(e.target.value){ prev.src = e.target.value; prev.classList.remove('hidden'); }
    else prev.classList.add('hidden');
  });
  document.getElementById('pf-image-file').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const prev = document.getElementById('pf-image-preview');
    prev.src = URL.createObjectURL(file);
    prev.classList.remove('hidden');
  });
  document.getElementById('pf-submit').addEventListener('click', saveProductForm);
}

async function saveProductForm(){
  const name = document.getElementById('pf-name').value.trim();
  const description = document.getElementById('pf-desc').value.trim();
  const price = document.getElementById('pf-price').value;
  const stock = document.getElementById('pf-stock').value;
  const category = document.getElementById('pf-category').value;
  const imageUrl = document.getElementById('pf-image-url').value.trim();
  const imageFile = document.getElementById('pf-image-file').files[0];
  const featured = document.getElementById('pf-featured').checked;
  const promoPrice = document.getElementById('pf-promo-price').value;
  const errEl = document.getElementById('pf-error');
  const submitBtn = document.getElementById('pf-submit');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('price', price);
  formData.append('stock', stock);
  formData.append('category', category);
  formData.append('featured', featured);
  formData.append('promoPrice', promoPrice);
  if(imageFile) formData.append('imageFile', imageFile);
  else formData.append('imageUrl', imageUrl);

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enregistrement…';
  try{
    const path = State.editingProductId ? `/products/${State.editingProductId}` : '/products';
    const method = State.editingProductId ? 'PUT' : 'POST';
    await apiFetch(path, { method, body: formData });
    closeOverlay('modal-overlay');
    await loadAllAdmin();
    renderAdminAll();
    showToast('Produit enregistré', 'success');
  }catch(e){
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = State.editingProductId ? 'Enregistrer les modifications' : 'Ajouter au catalogue';
  }
}

async function deleteProduct(id){
  if(!confirm('Supprimer définitivement ce produit ?')) return;
  try{
    await apiFetch(`/products/${id}`, { method:'DELETE' });
    await loadAllAdmin();
    renderAdminAll();
    showToast('Produit supprimé', 'success');
  }catch(e){ showToast(e.message, 'error'); }
}

/* ==================== ORDERS ==================== */
function renderAdminOrders(){
  const body = document.getElementById('admin-orders-body');
  const list = [...State.orders].reverse();
  body.innerHTML = list.length ? list.map(o=>`
    <tr>
      <td class="mono">${o.orderNumber}</td>
      <td>${escapeHtml(o.customerName)}<br><span style="color:var(--ink-soft); font-size:11px;">${escapeHtml(o.address)}</span></td>
      <td class="mono">${escapeHtml(o.phone)}</td>
      <td>${o.items.map(i=>`${i.qty}× ${escapeHtml(i.name)}`).join('<br>')}</td>
      <td class="mono">${fmtPrice(o.total)}</td>
      <td>${escapeHtml(o.paymentMethod)}</td>
      <td>
        <select data-status="${o.id}" style="font-size:12px; padding:4px 6px; border:1px solid var(--line); border-radius:2px;">
          <option value="en_attente" ${o.status==='en_attente'?'selected':''}>En attente</option>
          <option value="traitee" ${o.status==='traitee'?'selected':''}>Traitée</option>
          <option value="annulee" ${o.status==='annulee'?'selected':''}>Annulée</option>
        </select>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center; color:var(--ink-soft); padding:24px;">Aucune commande reçue pour l'instant.</td></tr>`;
  body.querySelectorAll('[data-status]').forEach(sel=>{
    sel.addEventListener('change', async ()=>{
      try{
        await apiFetch(`/orders/${sel.dataset.status}`, {
          method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: sel.value })
        });
        const order = State.orders.find(o=>o.id===sel.dataset.status);
        order.status = sel.value;
        renderAdminOrders(); renderAdminStats();
        showToast('Statut mis à jour', 'success');
      }catch(e){ showToast(e.message, 'error'); }
    });
  });
}

/* ==================== CATEGORIES ==================== */
function renderAdminCategories(){
  const body = document.getElementById('admin-categories-body');
  body.innerHTML = State.categories.map(c=>{
    const count = State.products.filter(p=>p.category===c).length;
    return `<tr><td>${escapeHtml(c)}</td><td>${count}</td><td><button class="btn btn-ghost btn-sm" data-delcat="${escapeHtml(c)}" style="color:var(--coral);">Supprimer</button></td></tr>`;
  }).join('');
  body.querySelectorAll('[data-delcat]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      try{
        await apiFetch(`/categories/${encodeURIComponent(b.dataset.delcat)}`, { method:'DELETE' });
        await loadAllAdmin();
        renderAdminCategories(); renderAdminProducts();
        showToast('Catégorie supprimée', 'success');
      }catch(e){ showToast(e.message, 'error'); }
    });
  });
}

function renderAdminAll(){
  renderAdminStats(); renderAdminProducts(); renderAdminOrders(); renderAdminCategories();
}

/* ==================== OVERLAY HELPERS ==================== */
function openOverlay(id){ document.getElementById(id).classList.add('open'); }
function closeOverlay(id){ document.getElementById(id).classList.remove('open'); }

/* ==================== WIRING ==================== */
function wireEvents(){
  document.getElementById('gate-back').addEventListener('click', ()=> window.location.href = '/');
  document.getElementById('gate-submit').addEventListener('click', attemptLogin);
  document.getElementById('admin-password').addEventListener('keydown', (e)=>{ if(e.key==='Enter') attemptLogin(); });
  document.getElementById('admin-logout-btn').addEventListener('click', logout);

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('add-product-btn').addEventListener('click', ()=> openProductForm(null));

  document.getElementById('add-category-btn').addEventListener('click', async ()=>{
    const input = document.getElementById('new-category-input');
    const val = input.value.trim();
    if(!val) return;
    try{
      await apiFetch('/categories', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: val }) });
      input.value='';
      await loadAllAdmin();
      renderAdminCategories();
      showToast('Catégorie ajoutée', 'success');
    }catch(e){ showToast(e.message, 'error'); }
  });

  document.getElementById('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id==='modal-overlay') closeOverlay('modal-overlay'); });
}

(async function boot(){
  wireEvents();
  if(TOKEN){
    try{ await showShell(); }
    catch(e){ showGate(); }
  } else {
    showGate();
  }
})();
