let createClient;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const CONFIG = window.BAZAAR_CONFIG || {};
const CATEGORIES = [
  { label: 'All items', icon: '▦' },
  { label: 'Cars & Vehicles', icon: '↗' },
  { label: 'Electronics', icon: '⌁' },
  { label: 'Home & Garden', icon: '⌂' },
  { label: 'Fashion', icon: '◇' },
  { label: 'Sports & Outdoors', icon: '◉' },
  { label: 'Property', icon: '▤' },
  { label: 'Hobbies & Collectibles', icon: '✳' },
  { label: 'Baby & Kids', icon: '♡' },
  { label: 'Free Stuff', icon: '↓' },
  { label: 'Other', icon: '□' }
];
const CONDITIONS = ['New', 'Like new', 'Good', 'Fair', 'For parts'];
const PAGE_SIZE = 24;
const readSavedTheme = () => { try { return localStorage.getItem('bz_theme') || 'light'; } catch { return 'light'; } };
const state = {
  client: null, user: null, profile: null, view: 'browse', category: 'All items',
  search: '', city: '', sort: 'newest', condition: '', minPrice: '', maxPrice: '',
  page: 0, total: 0, listings: [], favorites: new Set(), conversations: [],
  activeConversation: null, activeListing: null, activeGalleryIndex: 0,
  channel: null, searchTimer: null, locationTimer: null, editPhotos: [], stagedFiles: [],
  editingListing: null, theme: readSavedTheme()
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const safeImage = (url = '') => {
  try { const parsed = new URL(url, location.origin); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : ''; }
  catch { return ''; }
};
const initials = (name = 'Member') => name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'M';
const priceText = value => Number(value) === 0 ? 'Free' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
const shortDate = value => {
  if (!value) return '';
  const date = new Date(value), days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (!Number.isFinite(days) || days < 0) return '';
  if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const avatar = (profile, sizeClass = '') => {
  const name = profile?.display_name || 'Member';
  const url = safeImage(profile?.avatar_url || '');
  return `<span class="avatar ${sizeClass}" aria-label="${esc(name)}">${url ? `<img src="${esc(url)}" alt="${esc(name)}" loading="lazy">` : esc(initials(name))}</span>`;
};
const iconSvg = name => {
  const paths = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    box: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5M3 8v9l9 4 9-4V8M12 13v8"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    store: '<path d="M3 10h18M5 10v10h14V10M4 10l1-6h14l1 6M9 20v-6h6v6"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
};

function toast(message, type = '') {
  const item = document.createElement('div'); item.className = `toast ${type}`; item.textContent = message;
  $('#toastRegion').append(item); setTimeout(() => item.remove(), 3400);
}
function setTheme(theme) {
  state.theme = theme; document.documentElement.dataset.theme = theme; try { localStorage.setItem('bz_theme', theme); } catch { /* Private browsing / file previews may disable storage. */ }
  $('#themeButton').innerHTML = `<span class="icon ${theme === 'dark' ? 'icon-sun' : 'icon-moon'}"></span>`;
  $('#themeButton').setAttribute('aria-label', theme === 'dark' ? 'Use light mode' : 'Use dark mode');
}
function openModal(content, className = '') {
  const modal = $('#modal'); modal.className = `modal ${className}`; modal.innerHTML = content;
  $('#overlay').classList.add('open'); $('#overlay').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  setTimeout(() => $('input,textarea,select,button', modal)?.focus({ preventScroll: true }), 40);
}
function closeModal() {
  $('#overlay').classList.remove('open'); $('#overlay').setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
  if (state.channel) { state.client?.removeChannel(state.channel); state.channel = null; }
  state.activeConversation = null;
}
function showSetupHelp() {
  openModal(`<div class="modal-header"><div><h2 id="modalTitle">Connect your marketplace</h2><p>One-time setup for real accounts, listings, photos and chat.</p></div><button class="close-button" data-action="close-modal" aria-label="Close">${iconSvg('close')}</button></div>
    <div class="form-help"><strong>This build never inserts fake sellers or sample products.</strong><br><br>To make it live for real people, create a Supabase project, run the included <code>supabase/schema.sql</code> in its SQL Editor, then add your project URL and public anon key to <code>config.js</code> and redeploy.<br><br>The browser key is designed to be public; the SQL enables Row Level Security so users can only edit their own listings and profiles. Never use a service-role key in the browser.</div>
    <p style="margin:18px 0 0"><a class="button button-primary" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Open Supabase <span class="icon icon-arrow"></span></a></p>`);
}
function showBackendNotice() {
  $('#introStrip').hidden = true;
  $('#filterRow').hidden = true;
  $('#itemsHeading').hidden = true;
  $('#pageTitle').textContent = 'Your marketplace starts here.';
  $('#pageSubtitle').textContent = 'Real listings from real members, with no pretend inventory.';
  $('#resultsTitle').textContent = 'Backend connection needed';
  $('#resultsMeta').textContent = 'Your marketplace has no demo or fabricated seller data.';
  $('#listingGrid').innerHTML = `<div class="empty-state"><div><div class="empty-icon">${iconSvg('globe')}</div><h3>Connect the real marketplace</h3><p>The storefront is ready, but it needs your Supabase project to create accounts, store seller-uploaded photos, save listings and deliver real messages. No sample people or fake products are inserted.</p><button class="button button-primary" data-action="setup-help">View setup steps</button></div></div>`;
  $('#setupNotice').hidden = false;
  $('#setupNotice').textContent = 'Setup required: connect a Supabase project in config.js, then redeploy.';
}
function renderCategories() {
  $('#categoryNav').innerHTML = CATEGORIES.map((cat, index) => `<button class="category-item ${state.category === cat.label ? 'active' : ''}" data-action="category" data-category="${esc(cat.label)}"><span class="cat-dot">${esc(cat.icon)}</span><span>${esc(cat.label)}</span></button>`).join('');
  $('#quickCategories').innerHTML = CATEGORIES.slice(0, 6).map(cat => `<button class="quick-cat ${state.category === cat.label ? 'active' : ''}" data-action="category" data-category="${esc(cat.label)}">${esc(cat.label)}</button>`).join('');
}
function renderHeader() {
  const account = $('#accountButton');
  if (state.user) {
    account.textContent = state.profile?.display_name || state.user.email?.split('@')[0] || 'Account';
    account.title = 'Open your profile'; account.dataset.action = 'profile';
  } else {
    account.textContent = 'Sign in'; account.title = 'Sign in or create an account'; account.dataset.action = 'auth';
  }
  $('#savedCount').textContent = String(state.favorites.size || 0);
  $('#messageCount').textContent = state.user && state.conversations.length ? String(Math.min(state.conversations.length, 99)) : '';
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.action === `view-${state.view}`));
  $$('.mobile-nav button').forEach(button => button.classList.toggle('active', button.dataset.action === `view-${state.view}`));
}
function setView(view) {
  state.view = view;
  if (view !== 'browse') { state.category = 'All items'; }
  if (view === 'browse') {
    $('#introStrip').hidden = false; $('#filterRow').hidden = false; $('#itemsHeading').hidden = false;
    $('#pageTitle').textContent = 'Find something good.'; $('#pageSubtitle').textContent = 'Useful finds from people around you.';
    $('#resultsTitle').textContent = 'Explore listings'; $('#resultsMeta').textContent = 'Fresh finds from the community';
  } else if (view === 'saved') {
    $('#introStrip').hidden = true; $('#filterRow').hidden = true; $('#itemsHeading').hidden = false;
    $('#pageTitle').textContent = 'The good ones you saved.'; $('#pageSubtitle').textContent = 'Keep track of things you want to come back to.';
    $('#resultsTitle').textContent = 'Saved items'; $('#resultsMeta').textContent = 'Your personal shortlist';
  } else if (view === 'selling') {
    $('#introStrip').hidden = true; $('#filterRow').hidden = true; $('#itemsHeading').hidden = false;
    $('#pageTitle').textContent = 'Your listings.'; $('#pageSubtitle').textContent = 'Manage the things you are passing along.';
    $('#resultsTitle').textContent = 'Items you have listed'; $('#resultsMeta').textContent = 'Update prices, edit details or mark an item sold';
  } else if (view === 'inbox') {
    $('#introStrip').hidden = true; $('#filterRow').hidden = true; $('#itemsHeading').hidden = false;
    $('#pageTitle').textContent = 'Your conversations.'; $('#pageSubtitle').textContent = 'Talk directly with people about their listings.';
    $('#resultsTitle').textContent = 'Messages'; $('#resultsMeta').textContent = 'Conversations between real accounts';
  }
  renderCategories(); renderHeader();
  if (view === 'inbox') loadConversations(); else loadListings();
}
function setCategory(category) {
  state.view = 'browse'; state.category = category; state.page = 0;
  $('#introStrip').hidden = false; $('#filterRow').hidden = false; $('#itemsHeading').hidden = false;
  $('#pageTitle').textContent = category === 'All items' ? 'Find something good.' : `${category}, nearby.`;
  $('#pageSubtitle').textContent = 'Real items shared by members of your local community.';
  renderCategories(); renderHeader(); loadListings();
}
function imageMarkup(item, className = 'card-photo') {
  const images = Array.isArray(item.images) ? item.images : [];
  const image = safeImage(images[0] || '');
  return image ? `<img class="${className}" src="${esc(image)}" alt="${esc(item.title || 'Seller-uploaded item photo')}" loading="lazy">` : `<div class="photo-placeholder">${iconSvg('photo')}</div>`;
}
function renderListingCard(item, index) {
  const seller = item.seller || {};
  const saved = state.favorites.has(item.id);
  const isMine = state.user && item.seller_id === state.user.id;
  const status = item.status === 'sold' ? '<span class="condition-pill">Sold</span>' : item.condition ? `<span class="condition-pill">${esc(item.condition)}</span>` : '';
  const location = [item.locality, item.city].filter(Boolean).join(', ') || seller.city || 'Location not added';
  return `<article class="listing-card" style="animation-delay:${Math.min(index, 12) * 28}ms">
    <div class="card-photo-wrap" data-action="open-listing" data-id="${esc(item.id)}">${imageMarkup(item)}${status}</div>
    ${!isMine ? `<button class="favorite-button ${saved ? 'saved' : ''}" aria-label="${saved ? 'Remove from saved' : 'Save listing'}" title="${saved ? 'Remove from saved' : 'Save listing'}" data-action="favorite" data-id="${esc(item.id)}">${iconSvg('heart')}</button>` : ''}
    <div class="card-body"><div class="card-price">${priceText(item.price)}</div><h3 class="card-title" data-action="open-listing" data-id="${esc(item.id)}">${esc(item.title)}</h3><div class="card-location"><span class="icon icon-pin"></span><span>${esc(location)}</span><span aria-hidden="true">·</span><span>${esc(shortDate(item.created_at))}</span></div><div class="seller-line">${avatar(seller)}<div class="seller-name"><strong>${esc(seller.display_name || 'Member')}</strong>${isMine ? ' · Your listing' : ''}</div></div></div>
    ${state.view === 'selling' ? `<div class="card-actions"><button class="mini-action" data-action="edit-listing" data-id="${esc(item.id)}">Edit</button>${item.status === 'active' ? `<button class="mini-action" data-action="mark-sold" data-id="${esc(item.id)}">Mark sold</button>` : item.status === 'sold' ? `<button class="mini-action" data-action="mark-active" data-id="${esc(item.id)}">Relist</button>` : `<button class="mini-action" data-action="mark-active" data-id="${esc(item.id)}">Restore</button>`}</div>` : ''}
  </article>`;
}
function emptyState(title, body, actionLabel = '', action = '') {
  return `<div class="empty-state"><div><div class="empty-icon">${iconSvg('box')}</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${actionLabel ? `<button class="button button-primary" data-action="${esc(action)}">${esc(actionLabel)}</button>` : ''}</div></div>`;
}
function renderCards(items, append = false) {
  const grid = $('#listingGrid');
  if (!items.length && append) return;
  if (!append) {
    let title = 'No listings yet'; let body = 'When someone in your community posts an item, it will appear here. You can be the first seller.'; let label = 'Sell an item'; let action = 'sell';
    if (state.view === 'saved') { title = state.user ? 'Your saved list is empty' : 'Sign in to save your finds'; body = state.user ? 'Tap the heart on any listing to keep it here.' : 'Your saved items are tied to your account, so they follow you between devices.'; label = state.user ? 'Browse listings' : 'Sign in'; action = state.user ? 'view-browse' : 'auth'; }
    if (state.view === 'selling') { title = 'Nothing listed by you yet'; body = 'Add a few clear photos, set your price and publish your first real listing.'; label = 'Create a listing'; action = 'sell'; }
    if (state.view === 'browse' && (state.search || state.city || state.category !== 'All items' || state.condition || state.minPrice || state.maxPrice)) { title = 'No matches for these filters'; body = 'Try a wider search, another location or a different price range. We only show listings that real members have published.'; label = 'Clear filters'; action = 'clear-filters'; }
    if (items.length === 0) { grid.innerHTML = emptyState(title, body, label, action); $('#loadMoreWrap').hidden = true; return; }
    grid.innerHTML = items.map(renderListingCard).join('');
  } else {
    grid.insertAdjacentHTML('beforeend', items.map((item, index) => renderListingCard(item, index + state.page * PAGE_SIZE)).join(''));
  }
  $('#loadMoreWrap').hidden = state.page * PAGE_SIZE + items.length >= state.total;
}
async function loadListings({ append = false } = {}) {
  if (!state.client) return;
  if (!append) { state.page = 0; $('#listingGrid').innerHTML = `<div class="empty-state"><div><div class="empty-icon">${iconSvg('box')}</div><h3>Loading listings…</h3><p>Fetching published items from the marketplace database.</p></div></div>`; }
  try {
    let query = state.client.from('listings').select('*, seller:profiles!listings_seller_id_fkey(id,display_name,avatar_url,city)', { count: 'exact' });
    if (state.view === 'selling') {
      if (!state.user) { renderCards([]); return; }
      query = query.eq('seller_id', state.user.id);
    } else if (state.view === 'saved') {
      if (!state.user) { renderCards([]); return; }
      const ids = [...state.favorites];
      if (!ids.length) { state.total = 0; renderCards([]); return; }
      query = query.in('id', ids);
    } else {
      query = query.eq('status', 'active');
    }
    if (state.category !== 'All items' && state.view === 'browse') query = query.eq('category', state.category);
    const search = state.search.replace(/[\\%_,.()"']/g, ' ').replace(/\s+/g, ' ').trim();
    if (search && state.view !== 'selling') query = query.ilike('search_text', `%${search}%`);
    const city = state.city.replace(/[\\%_,.()"']/g, ' ').trim();
    if (city) query = query.ilike('location_text', `%${city}%`);
    if (state.condition && state.view !== 'selling') query = query.eq('condition', state.condition);
    if (state.minPrice !== '' && Number.isFinite(Number(state.minPrice))) query = query.gte('price', Number(state.minPrice));
    if (state.maxPrice !== '' && Number.isFinite(Number(state.maxPrice))) query = query.lte('price', Number(state.maxPrice));
    if (state.sort === 'price_asc') query = query.order('price', { ascending: true });
    else if (state.sort === 'price_desc') query = query.order('price', { ascending: false });
    else query = query.order('created_at', { ascending: false });
    query = query.range(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    state.total = count || 0;
    state.listings = append ? [...state.listings, ...(data || [])] : (data || []);
    renderCards(data || [], append);
    const meta = state.view === 'selling' ? `${state.total} listing${state.total === 1 ? '' : 's'} from your account` : `${state.total} real listing${state.total === 1 ? '' : 's'}${state.city ? ` near ${state.city}` : ''}`;
    $('#resultsMeta').textContent = meta;
  } catch (error) {
    console.error(error);
    $('#listingGrid').innerHTML = emptyState('Could not load listings', 'Check your Supabase setup and Row Level Security policies, then try again.', 'Retry', 'refresh-listings');
    toast('Could not load marketplace data. Check the backend setup.', 'error');
  }
}
async function loadAccountData() {
  if (!state.client || !state.user) { state.profile = null; state.favorites = new Set(); state.conversations = []; return; }
  const profileResult = await state.client.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  if (!profileResult.error && profileResult.data) state.profile = profileResult.data;
  else {
    const name = state.user.user_metadata?.display_name || state.user.email?.split('@')[0] || 'Member';
    const created = await state.client.from('profiles').upsert({ id: state.user.id, display_name: name, city: state.user.user_metadata?.city || '' }).select().maybeSingle();
    if (!created.error) state.profile = created.data;
  }
  const favoritesResult = await state.client.from('favorites').select('listing_id').eq('user_id', state.user.id);
  state.favorites = new Set((favoritesResult.data || []).map(row => row.listing_id));
}
function showAuth(mode = 'login', message = '') {
  const signup = mode === 'signup';
  openModal(`<div class="modal-header"><div><h2 id="modalTitle">${signup ? 'Join your local marketplace.' : 'Welcome back.'}</h2><p>${signup ? 'Create an account to list items, save finds and message sellers.' : 'Sign in to pick up where you left off.'}</p></div><button class="close-button" data-action="close-modal" aria-label="Close">${iconSvg('close')}</button></div>
    <form class="modal-form" id="authForm" novalidate>${signup ? `<label class="form-field">Your name<input name="display_name" required maxlength="60" autocomplete="name" placeholder="Name shown to other members"></label><label class="form-field">City or area<input name="city" maxlength="80" autocomplete="address-level2" placeholder="e.g. Ludhiana"></label>` : ''}
    <label class="form-field">Email address<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>
    <label class="form-field">Password<input name="password" type="password" required minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="At least 8 characters"></label>
    <div id="authMessage">${message ? `<div class="form-error">${esc(message)}</div>` : ''}</div><button class="button button-primary" type="submit" id="authSubmit">${signup ? 'Create account' : 'Sign in'}</button>
    <p class="form-help">Use your own account details. Bazaar does not create pretend seller profiles or auto-reply as another person.</p>
    <p class="auth-switch">${signup ? 'Already a member?' : 'New around here?'} <button class="text-button" type="button" data-action="auth-switch" data-mode="${signup ? 'login' : 'signup'}">${signup ? 'Sign in' : 'Create an account'}</button></p></form>`);
  $('#authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const email = String(form.get('email') || '').trim(); const password = String(form.get('password') || '');
    const name = String(form.get('display_name') || '').trim(); const city = String(form.get('city') || '').trim();
    const feedback = $('#authMessage'); const submit = $('#authSubmit'); feedback.innerHTML = '';
    if (signup && name.length < 2) { feedback.innerHTML = '<div class="form-error">Please enter a name with at least 2 characters.</div>'; return; }
    submit.disabled = true; submit.textContent = signup ? 'Creating account…' : 'Signing in…';
    try {
      const result = signup
        ? await state.client.auth.signUp({ email, password, options: { data: { display_name: name, city } } })
        : await state.client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signup && !result.data.session) {
        feedback.innerHTML = '<div class="form-success">Check your email for the confirmation link. Then return here and sign in.</div>';
        submit.disabled = false; submit.textContent = 'Create account'; return;
      }
      closeModal(); toast(signup ? 'Account created.' : 'Signed in.', 'success');
      state.user = result.data.user || result.data.session?.user || null; await loadAccountData(); renderHeader();
      if (state.view === 'inbox') await loadConversations(); else await loadListings();
    } catch (error) {
      feedback.innerHTML = `<div class="form-error">${esc(error.message || 'Could not authenticate. Please try again.')}</div>`;
    } finally { submit.disabled = false; submit.textContent = signup ? 'Create account' : 'Sign in'; }
  });
}
function showReportForm(item) {
  if (!state.user) { showAuth('login'); toast('Sign in to report a listing.'); return; }
  openModal(`<div class="modal-header"><div><h2 id="modalTitle">Report this listing</h2><p>Help keep the local marketplace useful and safe.</p></div><button class="close-button" data-action="close-modal" aria-label="Close">${iconSvg('close')}</button></div><p class="form-help" style="margin:0 0 15px">Reporting: <strong>${esc(item.title)}</strong></p><form class="modal-form" id="reportForm"><label class="form-field">Reason<select name="reason" required><option>Misleading listing</option><option>Prohibited item</option><option>Suspected scam</option><option>Harassment</option><option>Other</option></select></label><label class="form-field">Details <small>Optional · Do not include passwords or sensitive information.</small><textarea name="details" maxlength="1000" placeholder="What should the moderation team review?"></textarea></label><div id="reportMessage"></div><button class="button button-primary" type="submit">Submit report</button></form>`);
  $('#reportForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const reason = String(form.get('reason') || 'Other'); const details = String(form.get('details') || '').trim();
    const button = $('button[type="submit"]', event.currentTarget); button.disabled = true;
    const { error } = await state.client.from('reports').insert({ listing_id: item.id, reporter_id: state.user.id, reason, details });
    button.disabled = false;
    if (error) { $('#reportMessage').innerHTML = `<div class="form-error">${esc(error.message || 'Could not submit report.')}</div>`; return; }
    closeModal(); toast('Report submitted for review.', 'success');
  });
}
function showProfile() {
  if (!state.user) { showAuth('login'); return; }
  const profile = state.profile || {};
  openModal(`<div class="modal-header"><div><h2 id="modalTitle">Your profile</h2><p>Choose how other members see you.</p></div><button class="close-button" data-action="close-modal" aria-label="Close">${iconSvg('close')}</button></div>
    <div class="profile-header">${avatar(profile)}<div><h3>${esc(profile.display_name || state.user.email?.split('@')[0] || 'Member')}</h3><p>${esc(state.user.email || '')}</p></div></div>
    <form class="modal-form" id="profileForm"><label class="form-field">Display name<input name="display_name" required maxlength="60" value="${esc(profile.display_name || '')}"></label><label class="form-field">City or area<input name="city" maxlength="80" value="${esc(profile.city || '')}" placeholder="Add the area where you usually meet"></label><label class="form-field">About you <small>Optional · Do not include private contact details.</small><textarea name="bio" maxlength="240" placeholder="A little about what you buy or sell">${esc(profile.bio || '')}</textarea></label><div id="profileMessage"></div><button class="button button-primary" type="submit">Save profile</button><button class="button button-outline" type="button" data-action="sign-out">Sign out</button></form>`);
  $('#profileForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const display_name = String(form.get('display_name') || '').trim(); const city = String(form.get('city') || '').trim(); const bio = String(form.get('bio') || '').trim();
    if (display_name.length < 2) { $('#profileMessage').innerHTML = '<div class="form-error">Enter at least 2 characters for your name.</div>'; return; }
    const button = $('button[type="submit"]', event.currentTarget); button.disabled = true;
    const { data, error } = await state.client.from('profiles').update({ display_name, city, bio }).eq('id', state.user.id).select().single();
    button.disabled = false;
    if (error) { $('#profileMessage').innerHTML = `<div class="form-error">${esc(error.message)}</div>`; return; }
    state.profile = data; renderHeader(); closeModal(); toast('Profile updated.', 'success');
  });
}
function showSell(item = null) {
  if (!state.user) { showAuth('signup'); toast('Create an account to publish a listing.'); return; }
  state.editingListing = item; state.editPhotos = Array.isArray(item?.images) ? [...item.images] : []; state.stagedFiles = [];
  const editing = Boolean(item);
  openModal(`<div class="modal-header"><div><h2 id="modalTitle">${editing ? 'Edit your listing' : 'Sell an item'}</h2><p>${editing ? 'Update your details or add newer photos.' : 'Show the real item you have, with clear photos and honest details.'}</p></div><button class="close-button" data-action="close-modal" aria-label="Close">${iconSvg('close')}</button></div>
    <form class="modal-form" id="listingForm">
      <label class="form-field">What are you selling?<input name="title" required maxlength="110" value="${esc(item?.title || '')}" placeholder="e.g. Used mountain bike, 2021"></label>
      <div class="form-row"><label class="form-field">Price (₹)<input name="price" type="number" required min="0" max="999999999" step="1" value="${item ? esc(item.price) : ''}" placeholder="0 for free"></label><label class="form-field">Category<select name="category" required>${CATEGORIES.slice(1).map(cat => `<option ${item?.category === cat.label ? 'selected' : ''}>${esc(cat.label)}</option>`).join('')}</select></label></div>
      <div class="form-row"><label class="form-field">Condition<select name="condition" required>${CONDITIONS.map(value => `<option ${item?.condition === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label><label class="form-field">City<input name="city" required maxlength="80" value="${esc(item?.city || state.profile?.city || '')}" placeholder="e.g. Ludhiana"></label></div>
      <label class="form-field">Locality <small>Optional · Share an area, not your home address.</small><input name="locality" maxlength="80" value="${esc(item?.locality || '')}" placeholder="Neighbourhood or convenient meeting area"></label>
      <label class="form-field">Description<textarea name="description" required maxlength="2500" placeholder="Describe the item's condition, age, size and anything a buyer should know.">${esc(item?.description || '')}</textarea><small>Be accurate about condition, defects, included accessories and pickup.</small></label>
      <div class="form-field"><span>Photos <small>Required · 1 to 6 clear pictures of the actual item, taken or selected by you.</small></span><label class="upload-drop" for="listingImages"><span class="icon icon-photo">${iconSvg('photo')}</span><strong>Add item photos</strong><span>JPG, PNG or WebP · up to 10 MB each</span></label><input id="listingImages" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><div class="photo-previews" id="photoPreviews"></div></div>
      <div id="listingMessage"></div><button class="button button-primary" type="submit" id="publishButton">${editing ? 'Save changes' : 'Publish listing'}</button>
      <p class="form-help">Your listing is visible to other marketplace members. Arrange payment and meetups directly; Bazaar does not hold payments or guarantee items.</p>
    </form>`);
  renderPhotoPreviews();
  $('#listingImages').addEventListener('change', event => {
    const selected = [...event.target.files];
    if (selected.length > 6) toast('Choose up to 6 photos.');
    state.stagedFiles = selected.slice(0, Math.max(0, 6 - state.editPhotos.length));
    if (selected.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      state.stagedFiles = [];
      $('#listingMessage').innerHTML = '<div class="form-error">Use JPG, PNG or WebP images only.</div>';
    } else if (selected.some(file => file.size > 10 * 1024 * 1024)) {
      state.stagedFiles = [];
      $('#listingMessage').innerHTML = '<div class="form-error">Each image must be 10 MB or smaller.</div>';
    } else {
      $('#listingMessage').innerHTML = '';
    }
    renderPhotoPreviews();
  });
  $('#listingForm').addEventListener('submit', saveListing);
}
function renderPhotoPreviews() {
  const root = $('#photoPreviews'); if (!root) return;
  const existing = state.editPhotos.map((url, index) => `<div class="photo-preview"><img src="${esc(safeImage(url))}" alt="Existing item photo ${index + 1}"><button type="button" data-action="remove-existing-photo" data-index="${index}" aria-label="Remove photo">×</button></div>`).join('');
  const added = state.stagedFiles.map((file, index) => `<div class="photo-preview"><img src="${esc(URL.createObjectURL(file))}" alt="Selected new photo ${index + 1}"><button type="button" data-action="remove-new-photo" data-index="${index}" aria-label="Remove photo">×</button></div>`).join('');
  root.innerHTML = existing + added;
  const total = state.editPhotos.length + state.stagedFiles.length;
  if (total === 0) root.innerHTML = '<span class="form-help">No photos added yet.</span>';
}
async function imageAsJpeg(file) {
  const maxEdge = 1800;
  if (!file.type.startsWith('image/')) throw new Error('Only image files are accepted.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { return file; }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { alpha: false }); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', .84));
}
async function saveListing(event) {
  event.preventDefault(); const wasEditing = Boolean(state.editingListing); const form = new FormData(event.currentTarget); const message = $('#listingMessage'); const button = $('#publishButton');
  const title = String(form.get('title') || '').trim(); const price = Number(form.get('price')); const category = String(form.get('category') || 'Other');
  const condition = String(form.get('condition') || 'Good'); const city = String(form.get('city') || '').trim(); const locality = String(form.get('locality') || '').trim(); const description = String(form.get('description') || '').trim();
  if (!title || !city || !description || !Number.isFinite(price) || price < 0) { message.innerHTML = '<div class="form-error">Add a title, valid price, city and description.</div>'; return; }
  if (state.editPhotos.length + state.stagedFiles.length < 1) { message.innerHTML = '<div class="form-error">Add at least one photo of the actual item.</div>'; return; }
  if (state.editPhotos.length + state.stagedFiles.length > 6) { message.innerHTML = '<div class="form-error">A listing can contain up to 6 photos.</div>'; return; }
  button.disabled = true; button.textContent = 'Publishing…'; message.innerHTML = '';
  try {
    const images = [...state.editPhotos];
    for (const file of state.stagedFiles) {
      const blob = await imageAsJpeg(file);
      const path = `${state.user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await state.client.storage.from('listing-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
      if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
      const { data: publicData } = state.client.storage.from('listing-photos').getPublicUrl(path);
      images.push(publicData.publicUrl);
    }
    const payload = { seller_id: state.user.id, title, price, category, condition, city, locality: locality || null, description, images, status: state.editingListing?.status || 'active' };
    const result = state.editingListing
      ? await state.client.from('listings').update(payload).eq('id', state.editingListing.id).select().single()
      : await state.client.from('listings').insert(payload).select().single();
    if (result.error) throw result.error;
    closeModal(); state.editingListing = null; state.editPhotos = []; state.stagedFiles = [];
    state.view = 'selling'; setView('selling'); toast(wasEditing ? 'Listing updated.' : 'Your listing is live.', 'success');
  } catch (error) {
    console.error(error); message.innerHTML = `<div class="form-error">${esc(error.message || 'Could not publish this listing.')}</div>`;
    button.disabled = false; button.textContent = state.editingListing ? 'Save changes' : 'Publish listing';
  }
}
function showListingDetail(item) {
  state.activeListing = item; state.activeGalleryIndex = 0;
  const seller = item.seller || {};
  const images = (Array.isArray(item.images) ? item.images : []).map(safeImage).filter(Boolean);
  const mine = state.user?.id === item.seller_id;
  const saved = state.favorites.has(item.id);
  openModal(`<div class="modal-header"><div><div class="eyebrow">${esc(item.category || 'Listing')}</div><h2 id="modalTitle">Item details</h2></div><button class="close-button" data-action="close-modal" aria-label="Close">${iconSvg('close')}</button></div>
    <div class="detail-layout"><div class="detail-gallery"><div class="detail-main-image" id="detailMainImage">${images[0] ? `<img src="${esc(images[0])}" alt="${esc(item.title)} photo 1">` : ''}</div><div class="detail-thumbs">${images.map((url, index) => `<button class="detail-thumb ${index === 0 ? 'active' : ''}" data-action="detail-photo" data-index="${index}" aria-label="View photo ${index + 1}"><img src="${esc(url)}" alt="${esc(item.title)} photo ${index + 1}"></button>`).join('')}</div></div>
    <div class="detail-info">${item.status === 'sold' ? '<div class="sold-banner">This item has been marked as sold.</div>' : ''}<div class="detail-price">${priceText(item.price)}</div><h2>${esc(item.title)}</h2><div class="detail-meta">${esc(item.category)} · ${esc(item.condition)} · Listed ${esc(shortDate(item.created_at))}</div><p class="detail-description">${esc(item.description)}</p><div class="card-location" style="margin-top:14px"><span class="icon icon-pin"></span><span>${esc([item.locality, item.city].filter(Boolean).join(', ') || 'Location not added')}</span></div><div class="detail-seller">${avatar(seller)}<div><strong>${esc(seller.display_name || 'Member')}</strong><span>${esc(seller.city || item.city || 'Marketplace member')}</span></div></div>
    <div class="detail-buttons">${mine ? `<button class="button button-outline" data-action="edit-listing" data-id="${esc(item.id)}">Edit</button>${item.status === 'active' ? `<button class="button button-primary" data-action="mark-sold" data-id="${esc(item.id)}">Mark sold</button>` : `<button class="button button-primary" data-action="mark-active" data-id="${esc(item.id)}">Relist</button>`}<button class="button button-outline" data-action="archive-listing" data-id="${esc(item.id)}">Remove</button>` : `<button class="button button-primary" data-action="message-seller" data-id="${esc(item.id)}" ${item.status !== 'active' ? 'disabled' : ''}>${iconSvg('chat')} Message seller</button><button class="button button-outline" data-action="favorite" data-id="${esc(item.id)}">${iconSvg('heart')} ${saved ? 'Saved' : 'Save'}</button><button class="button button-outline" data-action="report-listing" data-id="${esc(item.id)}">Report</button>`}</div>
    <p class="form-help" style="margin-top:14px">Keep conversations on-platform until you feel comfortable. Never share passwords or one-time codes, and inspect an item before paying.</p></div></div>`, 'modal-wide');
}
async function toggleFavorite(id) {
  if (!state.user) { showAuth('login'); toast('Sign in to save listings.'); return; }
  const wasSaved = state.favorites.has(id);
  const result = wasSaved
    ? await state.client.from('favorites').delete().eq('user_id', state.user.id).eq('listing_id', id)
    : await state.client.from('favorites').insert({ user_id: state.user.id, listing_id: id });
  if (result.error) { toast(result.error.message || 'Could not update saved items.', 'error'); return; }
  wasSaved ? state.favorites.delete(id) : state.favorites.add(id);
  renderHeader();
  if (state.view === 'saved' && wasSaved) loadListings();
  else {
    const button = $(`[data-action="favorite"][data-id="${CSS.escape(id)}"]`);
    if (button) { button.classList.toggle('saved', !wasSaved); button.innerHTML = button.classList.contains('favorite-button') ? iconSvg('heart') : `${iconSvg('heart')} ${!wasSaved ? 'Saved' : 'Save'}`; }
  }
  if (state.activeListing?.id === id && $('#overlay').classList.contains('open')) showListingDetail({ ...state.activeListing });
}
async function messageSeller(id) {
  if (!state.user) { showAuth('login'); toast('Sign in to message a seller.'); return; }
  const item = state.listings.find(row => row.id === id) || state.activeListing;
  if (!item) { toast('Listing not found. Refresh and try again.', 'error'); return; }
  if (item.seller_id === state.user.id) { toast('This is your own listing.'); return; }
  try {
    const lookup = await state.client.from('conversations').select('id').eq('listing_id', item.id).eq('buyer_id', state.user.id).eq('seller_id', item.seller_id).maybeSingle();
    if (lookup.error) throw lookup.error;
    let conversationId = lookup.data?.id;
    if (!conversationId) {
      const created = await state.client.from('conversations').insert({ listing_id: item.id, buyer_id: state.user.id, seller_id: item.seller_id }).select('id').single();
      if (created.error) throw created.error;
      conversationId = created.data.id;
    }
    closeModal(); state.view = 'inbox'; setView('inbox'); await openThread(conversationId);
  } catch (error) {
    console.error(error); toast(error.message || 'Could not start a conversation.', 'error');
  }
}
async function loadConversations() {
  if (!state.client) return;
  if (!state.user) { renderCards([]); $('#listingGrid').innerHTML = emptyState('Sign in to see your messages', 'Conversations are private to the real accounts taking part in them.', 'Sign in', 'auth'); return; }
  $('#listingGrid').innerHTML = `<div class="empty-state"><div><div class="empty-icon">${iconSvg('chat')}</div><h3>Loading conversations…</h3><p>Checking your message inbox.</p></div></div>`;
  try {
    const result = await state.client.from('conversations').select('id,listing_id,buyer_id,seller_id,last_message_at,listing:listings(id,title,price,images),buyer:profiles!conversations_buyer_id_fkey(id,display_name,avatar_url,city),seller:profiles!conversations_seller_id_fkey(id,display_name,avatar_url,city)').order('last_message_at', { ascending: false });
    if (result.error) throw result.error;
    state.conversations = result.data || [];
    renderHeader();
    const ids = state.conversations.map(row => row.id); let latest = new Map();
    if (ids.length) {
      const recent = await state.client.from('messages').select('conversation_id,body,created_at,sender_id').in('conversation_id', ids).order('created_at', { ascending: false }).limit(500);
      if (!recent.error) for (const row of recent.data || []) if (!latest.has(row.conversation_id)) latest.set(row.conversation_id, row);
    }
    if (!state.conversations.length) {
      $('#listingGrid').innerHTML = emptyState('No conversations yet', 'When you message a seller about a listing, your conversation will show up here.', 'Browse listings', 'view-browse'); return;
    }
    $('#listingGrid').innerHTML = `<div class="inbox-layout">${state.conversations.map(row => {
      const other = row.buyer_id === state.user.id ? row.seller : row.buyer;
      const last = latest.get(row.id); const title = row.listing?.title || 'Marketplace listing';
      const item = row.listing?.images?.[0] ? safeImage(row.listing.images[0]) : '';
      return `<button class="conversation-row" data-action="open-thread" data-id="${esc(row.id)}">${item ? `<span class="avatar" style="border-radius:9px;width:45px;height:45px"><img src="${esc(item)}" alt="${esc(title)}" loading="lazy"></span>` : avatar(other)}<span class="conversation-details"><span class="conversation-top"><strong>${esc(other?.display_name || 'Member')}</strong><time>${esc(shortDate(last?.created_at || row.last_message_at))}</time></span><p>${esc(last?.body || 'Start the conversation')}</p><span class="conversation-listing">${esc(title)}</span></span><span class="icon icon-chevron"></span></button>`;
    }).join('')}</div>`;
  } catch (error) {
    console.error(error); $('#listingGrid').innerHTML = emptyState('Your inbox is unavailable', 'Check the conversations and messages policies in the included database setup, then retry.', 'Retry', 'view-inbox');
  }
}
async function openThread(conversationId) {
  const row = state.conversations.find(item => item.id === conversationId);
  if (!row) {
    const result = await state.client.from('conversations').select('id,listing_id,buyer_id,seller_id,last_message_at,listing:listings(id,title,price,images),buyer:profiles!conversations_buyer_id_fkey(id,display_name,avatar_url,city),seller:profiles!conversations_seller_id_fkey(id,display_name,avatar_url,city)').eq('id', conversationId).single();
    if (result.error) { toast('Could not open that conversation.', 'error'); return; }
    state.conversations.unshift(result.data);
  }
  const conversation = state.conversations.find(item => item.id === conversationId);
  const other = conversation.buyer_id === state.user.id ? conversation.seller : conversation.buyer;
  const listingTitle = conversation.listing?.title || 'Marketplace listing';
  state.activeConversation = conversationId;
  openModal(`<div class="chat-header">${avatar(other)}<div><strong>${esc(other?.display_name || 'Member')}</strong><span>${esc(listingTitle)}</span></div><button class="close-button" data-action="close-modal" aria-label="Close conversation">${iconSvg('close')}</button></div><div class="chat-messages" id="chatMessages"><p class="form-help">Loading messages…</p></div><form class="chat-compose" id="chatForm"><textarea name="body" required maxlength="2000" rows="1" aria-label="Message" placeholder="Write a message…"></textarea><button class="button button-primary" type="submit" aria-label="Send message">${iconSvg('send')}</button></form>`, 'modal-chat');
  await loadThreadMessages(conversationId);
  if (state.channel) state.client.removeChannel(state.channel);
  state.channel = state.client.channel(`bazaar-conversation-${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => loadThreadMessages(conversationId)).subscribe();
  $('#chatForm').addEventListener('submit', async event => {
    event.preventDefault(); const textarea = $('textarea[name="body"]', event.currentTarget); const body = textarea.value.trim(); if (!body) return;
    const sendButton = $('button[type="submit"]', event.currentTarget); sendButton.disabled = true;
    const inserted = await state.client.from('messages').insert({ conversation_id: conversationId, sender_id: state.user.id, body });
    sendButton.disabled = false;
    if (inserted.error) { toast(inserted.error.message || 'Message could not be sent.', 'error'); return; }
    textarea.value = ''; await loadThreadMessages(conversationId);
  });
  $('textarea[name="body"]', $('#chatForm'))?.focus({ preventScroll: true });
}
async function loadThreadMessages(conversationId) {
  const root = $('#chatMessages'); if (!root || state.activeConversation !== conversationId) return;
  const { data, error } = await state.client.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(500);
  if (error) { root.innerHTML = `<p class="form-help">Could not load messages: ${esc(error.message)}</p>`; return; }
  root.innerHTML = data?.length ? data.map(message => `<div class="chat-bubble ${message.sender_id === state.user.id ? 'mine' : ''}">${esc(message.body)}<span class="chat-time">${new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') : '<p class="form-help">No messages yet. Say hello and ask any questions you have about the item.</p>';
  root.scrollTop = root.scrollHeight;
}
async function changeListingStatus(id, status) {
  const { error } = await state.client.from('listings').update({ status }).eq('id', id).eq('seller_id', state.user.id);
  if (error) { toast(error.message || 'Could not update listing status.', 'error'); return; }
  closeModal(); toast(status === 'sold' ? 'Marked as sold.' : status === 'archived' ? 'Listing removed from browse.' : 'Listing is active again.', 'success');
  state.page = 0; await loadListings();
}
function confirmArchive(item) {
  openModal(`<div class="modal-header"><div><h2 id="modalTitle">Remove this listing?</h2><p>It will disappear from the public browse page. Existing messages are retained unless you delete the listing through your database.</p></div><button class="close-button" data-action="close-modal" aria-label="Close">${iconSvg('close')}</button></div><p style="font-size:13px;margin:0 0 18px"><strong>${esc(item.title)}</strong></p><div class="detail-buttons"><button class="button button-outline" data-action="close-modal">Keep listing</button><button class="button button-primary" data-action="confirm-archive" data-id="${esc(item.id)}">Remove listing</button></div>`);
}
function openProfileFromListing(id) { const item = state.listings.find(row => row.id === id); if (item) showListingDetail(item); }
function listingById(id) { return state.listings.find(item => item.id === id) || (state.activeListing?.id === id ? state.activeListing : null); }
function showGlobalSetupMessage() { showSetupHelp(); }

async function handleAction(element) {
  const action = element.dataset.action; const id = element.dataset.id; const item = id ? listingById(id) : null;
  if (!state.client && ['auth','profile','sell','view-saved','view-selling','view-inbox','message-seller','favorite','report-listing'].includes(action)) {
    showSetupHelp();
    return;
  }
  switch (action) {
    case 'close-modal': closeModal(); break;
    case 'setup-help': showGlobalSetupMessage(); break;
    case 'auth': showAuth('login'); break;
    case 'auth-switch': showAuth(element.dataset.mode || 'login'); break;
    case 'profile': showProfile(); break;
    case 'sign-out': {
      const { error } = await state.client.auth.signOut(); if (error) { toast(error.message, 'error'); break; }
      closeModal(); state.user = null; state.profile = null; state.favorites.clear(); state.conversations = []; renderHeader(); setView('browse'); toast('Signed out.', 'success'); break;
    }
    case 'sell': showSell(); break;
    case 'view-browse': setView('browse'); break;
    case 'view-saved': if (!state.user) { state.view = 'saved'; setView('saved'); showAuth('login'); } else setView('saved'); break;
    case 'view-selling': if (!state.user) showAuth('login'); else setView('selling'); break;
    case 'view-inbox': if (!state.user) { state.view = 'inbox'; setView('inbox'); showAuth('login'); } else setView('inbox'); break;
    case 'category': setCategory(element.dataset.category || 'All items'); break;
    case 'open-listing': if (item) showListingDetail(item); break;
    case 'favorite': if (id) await toggleFavorite(id); break;
    case 'message-seller': if (id) await messageSeller(id); break;
    case 'report-listing': if (item && item.seller_id !== state.user?.id) showReportForm(item); break;
    case 'edit-listing': if (item && item.seller_id === state.user?.id) showSell(item); break;
    case 'mark-sold': if (id) await changeListingStatus(id, 'sold'); break;
    case 'mark-active': if (id) await changeListingStatus(id, 'active'); break;
    case 'archive-listing': if (item && item.seller_id === state.user?.id) confirmArchive(item); break;
    case 'confirm-archive': if (id) await changeListingStatus(id, 'archived'); break;
    case 'open-thread': if (id) await openThread(id); break;
    case 'detail-photo': {
      const index = Number(element.dataset.index || 0); const images = (state.activeListing?.images || []).map(safeImage).filter(Boolean);
      if (!images[index]) break; state.activeGalleryIndex = index;
      $('#detailMainImage').innerHTML = `<img src="${esc(images[index])}" alt="${esc(state.activeListing.title)} photo ${index + 1}">`;
      $$('.detail-thumb').forEach((button, i) => button.classList.toggle('active', i === index)); break;
    }
    case 'remove-existing-photo': state.editPhotos.splice(Number(element.dataset.index), 1); renderPhotoPreviews(); break;
    case 'remove-new-photo': state.stagedFiles.splice(Number(element.dataset.index), 1); renderPhotoPreviews(); break;
    case 'clear-filters': state.search = ''; state.city = ''; state.condition = ''; state.minPrice = ''; state.maxPrice = ''; state.category = 'All items'; $('#searchInput').value = ''; $('#locationInput').value = ''; $('#conditionSelect').value = ''; $('#minPrice').value = ''; $('#maxPrice').value = ''; setCategory('All items'); break;
    case 'refresh-listings': await loadListings(); break;
    default: break;
  }
}
function bindStaticEvents() {
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]'); if (target) { event.preventDefault(); handleAction(target); }
  });
  $('#overlay').addEventListener('click', event => { if (event.target.id === 'overlay') closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#overlay').classList.contains('open')) closeModal(); });
  $('#themeButton').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
  $('#searchInput').addEventListener('input', event => {
    state.search = event.target.value; if (state.view !== 'browse') setView('browse');
    clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => loadListings(), 260);
  });
  $('#searchInput').addEventListener('keydown', event => { if (event.key === 'Enter') { clearTimeout(state.searchTimer); loadListings(); } });
  $('#locationInput').addEventListener('input', event => {
    state.city = event.target.value; if (state.view !== 'browse') setView('browse');
    clearTimeout(state.locationTimer); state.locationTimer = setTimeout(() => loadListings(), 320);
  });
  $('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; loadListings(); });
  $('#conditionSelect').addEventListener('change', event => { state.condition = event.target.value; loadListings(); });
  $('#priceButton').addEventListener('click', () => { const popover = $('#pricePopover'); popover.hidden = !popover.hidden; if (!popover.hidden) $('#minPrice').focus(); });
  $('#applyPrice').addEventListener('click', () => { state.minPrice = $('#minPrice').value; state.maxPrice = $('#maxPrice').value; $('#pricePopover').hidden = true; loadListings(); });
  $('#clearFilters').addEventListener('click', () => handleAction({ dataset: { action: 'clear-filters' } }));
  $('#loadMoreButton').addEventListener('click', async () => { state.page += 1; await loadListings({ append: true }); });
}

async function boot() {
  setTheme(state.theme); renderCategories(); bindStaticEvents();
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey || CONFIG.supabaseUrl.includes('YOUR_PROJECT') || CONFIG.supabaseAnonKey.includes('YOUR_PUBLIC')) {
    showBackendNotice(); renderHeader(); return;
  }
  try {
    const supabaseModule = await import('https://esm.sh/@supabase/supabase-js@2.57.0');
    createClient = supabaseModule.createClient;
    state.client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 8 } }
    });
    const sessionResult = await state.client.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    state.user = sessionResult.data.session?.user || null;
    await loadAccountData(); renderHeader();
    state.client.auth.onAuthStateChange((_event, session) => {
      state.user = session?.user || null;
      queueMicrotask(async () => {
        try { await loadAccountData(); renderHeader(); if (state.view === 'inbox') await loadConversations(); else await loadListings(); }
        catch (error) { console.error(error); }
      });
    });
    await loadListings();
  } catch (error) {
    console.error(error);
    $('#listingGrid').innerHTML = emptyState('Could not connect to the marketplace', 'Check the Supabase URL and public anon key in config.js and confirm that the included schema has been run.', 'View setup steps', 'setup-help');
    $('#pageSubtitle').textContent = 'A real backend connection is required for listings and messages.';
  }
}

boot();
