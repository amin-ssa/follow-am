/* request.js – full request flow with Firestore integration */

const serviceNames = {
  followers: 'متابعين',
  views:     'مشاهدات',
  shares:    'مشاركات (شير)',
  likes:     'إعجابات'
};

const state = {
  username: '',
  service:  '',
  qty:      0,
  price:    0,
  orderId:  '',
  userEmail: '',
  userDisplayName: ''
};

/* ─── STEP 1 → STEP 2 ─── */
const btnNext1 = document.getElementById('btn-next-step1');
btnNext1.addEventListener('click', () => {
  const val = document.getElementById('instagram-username').value.trim();
  if (!val) { shakeInput(); return; }
  const clean = val.replace(/^@+/, '');
  state.username = '@' + clean;
  const dispEl = document.getElementById('display-username');
  dispEl.textContent = state.username;
  dispEl.style.direction = 'ltr';
  dispEl.style.unicodeBidi = 'embed';
  switchStep('step-instagram', 'step-services');
});

function shakeInput() {
  const inp = document.querySelector('.input-group');
  inp.style.borderColor = '#ef4444';
  inp.style.animation = 'shake 0.4s ease';
  setTimeout(() => { inp.style.borderColor = ''; inp.style.animation = ''; }, 500);
}

/* ─── SERVICE TABS ─── */
document.querySelectorAll('.stab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const svc = tab.dataset.service;

    // Hide all package panels
    document.querySelectorAll('.packages').forEach(p => {
      p.classList.add('hidden');
      p.style.display = 'none';
    });

    // Show the right one
    const panel = document.getElementById('pkg-' + svc);
    if (panel) {
      panel.classList.remove('hidden');
      panel.style.display = svc === 'special' ? 'block' : '';
    }

    document.querySelectorAll('.pkg-card.selected').forEach(c => c.classList.remove('selected'));
    state.service = ''; state.qty = 0; state.price = 0;
  });
});

/* ─── PACKAGE SELECTION ─── */
document.querySelectorAll('.pkg-card:not(.locked):not(.special-in-likes)').forEach(card => {
  card.addEventListener('click', () => {
    const svc = card.dataset.service;
    const qty = +card.dataset.qty;
    const price = +card.dataset.price;
    document.querySelectorAll(`.pkg-card[data-service="${svc}"]`).forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.service = svc; state.qty = qty; state.price = price;
    setTimeout(() => { fillOrderSummary(); switchStep('step-services', 'step-login'); }, 380);
  });
});

function fillOrderSummary() {
  document.getElementById('sum-username').textContent = state.username;
  document.getElementById('sum-service').textContent = serviceNames[state.service] || state.service;
  document.getElementById('sum-qty').textContent = state.qty;
  document.getElementById('sum-price').textContent = state.price + ' درهم';
}

/* ─── GOOGLE LOGIN + SAVE TO FIRESTORE ─── */
function handleGoogleLogin() {
  const auth     = window.__firebaseAuth;
  const provider = window.__googleProvider;
  const signIn   = window.__signInWithPopup;
  const db       = window.__firestore;
  const btn      = document.getElementById('btn-google-login');

  if (!auth || !signIn || !db) {
    btn.textContent = '⏳ جارٍ التحميل…';
    btn.disabled = true;
    window.addEventListener('firebase-ready', () => { btn.disabled = false; btn.textContent = 'تسجيل الدخول بـ Google'; });
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;animation:spin .8s linear infinite">⏳</span> جارٍ الاتصال…';

  signIn(auth, provider)
    .then(result => {
      state.userEmail = result.user.email || '';
      state.userDisplayName = result.user.displayName || 'مستخدم';
      state.orderId = generateOrderId();

      document.getElementById('order-id-display').textContent = state.orderId;
      buildFinalMessage();
      switchStep('step-login', 'step-complete');
    })
    .catch(err => {
      console.error(err);
      btn.disabled = false;
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 24 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> حاول مجدداً`;
      showToast('فشل تسجيل الدخول — حاول مرة أخرى');
    });
}

document.getElementById('btn-google-login').addEventListener('click', handleGoogleLogin);

/* ─── REAL-TIME STATUS WATCH ─── */
function startStatusWatch() {
  const db = window.__firestore;
  if (!db || !window.__firestoreApi) return;
  const { collection, query, where, onSnapshot } = window.__firestoreApi;
  const q = query(collection(db, 'orders'), where('orderId', '==', state.orderId));
  const unsub = onSnapshot(q, snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      updateStatusBadge(data.status);
    });
  });
  window.__orderUnsub = unsub;
}

function updateStatusBadge(status) {
  const pEl = document.getElementById('status-pending');
  const aEl = document.getElementById('status-approved');
  const rEl = document.getElementById('status-rejected');
  
  if (!pEl || !aEl || !rEl) return;

  // Reset to default inactive style
  const resetStyle = (el) => {
    el.style.opacity = '0.4';
    el.style.background = 'rgba(255,255,255,0.02)';
    el.style.borderColor = 'rgba(255,255,255,0.05)';
    el.style.borderStyle = 'solid';
  };
  
  resetStyle(pEl);
  resetStyle(aEl);
  resetStyle(rEl);

  if (status === 'approved') {
    aEl.style.opacity = '1';
    aEl.style.background = 'rgba(16, 185, 129, 0.08)';
    aEl.style.borderColor = '#10b981';
    confettiEffect();
  } else if (status === 'rejected') {
    rEl.style.opacity = '1';
    rEl.style.background = 'rgba(239, 68, 68, 0.08)';
    rEl.style.borderColor = '#ef4444';
  } else {
    // pending
    pEl.style.opacity = '1';
    pEl.style.background = 'rgba(245, 158, 11, 0.08)';
    pEl.style.borderColor = '#f59e0b';
    pEl.style.borderStyle = 'dashed';
  }
}

function confettiEffect() {
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div');
    const colors = ['#7c3aed','#f59e0b','#10b981','#3b82f6','#f43f5e'];
    el.style.cssText = `
      position:fixed; width:8px; height:8px; border-radius:2px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      left:${Math.random()*100}vw; top:-10px; z-index:9999;
      animation: confettiFall ${1.5+Math.random()*2}s ease forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

/* ─── GENERATE ORDER ID ─── */
function generateOrderId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/* ─── BUILD FINAL MESSAGE ─── */
function buildFinalMessage() {
  const msg =
`🌟 مرحباً Hicham Y Saif!

📋 طلب جديد:
━━━━━━━━━━━━━━━━━━
👤 حساب إنستاغرم: ${state.username}
⚙️ الخدمة: ${serviceNames[state.service]}
📊 الكمية: ${state.qty}
💰 السعر: ${state.price} درهم
🆔 رقم الطلب: #${state.orderId}
━━━━━━━━━━━━━━━━━━
✅ الرجاء تأكيد الطلب وإعلامي بطريقة الدفع.
شكراً! 🙏`;

  document.getElementById('final-message-box').textContent = msg;
  window.__orderMessage = msg;
}

state.isSubmitted = false;

async function submitOrderToFirestore() {
  if (state.isSubmitted) return true;
  const db = window.__firestore;
  if (!db || !window.__firestoreApi) {
    showToast('سيرفر قاعدة البيانات غير متصل!');
    return false;
  }

  try {
    const { collection, addDoc, serverTimestamp } = window.__firestoreApi;
    await addDoc(collection(db, 'orders'), {
      orderId:     state.orderId,
      username:    state.username,
      service:     state.service,
      serviceName: serviceNames[state.service],
      qty:         state.qty,
      price:       state.price,
      userEmail:   state.userEmail,
      userName:    state.userDisplayName,
      status:      'pending',
      createdAt:   serverTimestamp()
    });
    state.isSubmitted = true;
    startStatusWatch();
    return true;
  } catch(e) {
    console.error('Firestore save error:', e);
    showToast('خطأ في إرسال الطلب للسيرفر، يرجى المحاولة مرة أخرى.');
    return false;
  }
}

/* ─── COPY MESSAGE ─── */
document.getElementById('btn-copy-message').addEventListener('click', async () => {
  // Save order when copied too, to make sure it exists in admin panel
  await submitOrderToFirestore();
  navigator.clipboard.writeText(window.__orderMessage || '').then(() => {
    const txt = document.querySelector('#btn-copy-message .btn-text');
    txt.textContent = '✓ تم النسخ والارسال!';
    setTimeout(() => { txt.textContent = 'نسخ الرسالة'; }, 2500);
  });
});

/* ─── SEND TO INSTAGRAM ─── */
document.getElementById('btn-send-instagram').addEventListener('click', async (e) => {
  e.preventDefault();
  const url = e.currentTarget.getAttribute('href');
  const btn = document.getElementById('btn-send-instagram');
  const originalText = btn.innerHTML;

  btn.style.pointerEvents = 'none';
  btn.innerHTML = '<span>⏳</span> جارٍ وضع الطلب في قائمة الانتظار...';

  const success = await submitOrderToFirestore();
  btn.innerHTML = originalText;
  btn.style.pointerEvents = '';

  if (success) {
    window.open(url, '_blank');
  }
});

/* ─── SWITCH STEPS ─── */
function switchStep(fromId, toId) {
  const from = document.getElementById(fromId);
  const to   = document.getElementById(toId);
  from.style.opacity = '0';
  from.style.transform = 'scale(.95)';
  setTimeout(() => {
    from.classList.add('hidden');
    from.style.opacity = ''; from.style.transform = '';
    to.classList.remove('hidden');
    to.style.opacity = '0'; to.style.transform = 'scale(1.04)';
    requestAnimationFrame(() => {
      to.style.transition = 'opacity .45s ease, transform .45s ease';
      to.style.opacity = '1'; to.style.transform = 'scale(1)';
    });
  }, 300);
}

/* ─── TOAST ─── */
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
    background:rgba(30,10,60,.95);color:#f1f5f9;padding:.7rem 1.5rem;
    border-radius:30px;font-family:'Cairo',sans-serif;font-size:.9rem;
    border:1px solid rgba(124,58,237,.4);z-index:9999;
    animation:toastIn .3s ease;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,.5);`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* Enter key */
document.getElementById('instagram-username').addEventListener('keydown', e => {
  if (e.key === 'Enter') btnNext1.click();
});

/* ─── INJECT STYLES ─── */
const s = document.createElement('style');
s.textContent = `
  @keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-5px);}80%{transform:translateX(5px);}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
  @keyframes confettiFall{to{transform:translateY(100vh) rotate(720deg);opacity:0;}}
  .page-wrapper{transition:opacity .3s ease,transform .3s ease;}
`;
document.head.appendChild(s);
