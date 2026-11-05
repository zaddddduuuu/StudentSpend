/**
 * StudentSpend - Personal Money Tracker for Students
 * Core Engine & Interactive UI
 */

// Global state types
export interface StudentSpendState {
  tx: Array<{
    id: number;
    type: 'income' | 'expense';
    desc: string;
    amount: number;
    cat: string;
    date: string;
    src?: string;
  }>;
  cats: string[];
  budgets: Record<string, number>;
  strict?: Record<string, boolean>;
  overall: number;
  hard: boolean;
  ef: Array<{
    id: number;
    kind: 'contribute' | 'withdraw';
    amount: number;
    date: string;
    note?: string;
    reason?: string;
  }>;
  efTarget: number;
  goals: Array<{
    id: number;
    name: string;
    target: number;
    saved: number;
    date?: string;
    hist: Array<{ date: string; amount: number }>;
  }>;
  imports: Array<{ date: string; n: number; skipped: number }>;
  trash: Array<{
    kind: 'tx' | 'goal' | 'all';
    item: any;
    at: number;
  }>;
  parents: Array<{
    id: number;
    name: string;
    email?: string;
    phone?: string;
  }>;
  theme?: string;
  lang?: string;
  custom?: { nv: string; ac: string; bg: string };
  profile?: {
    name?: string;
    college?: string;
    email?: string;
    parent?: string;
    parentEmail?: string;
  };
}

export function initStudentSpend() {
  const DEF = ["Food", "Transport", "Education", "Hostel", "Shopping", "Entertainment", "Bills", "Health", "Travel", "Pocket Money", "Other"];
  const DEFS = (): StudentSpendState => ({
    tx: [],
    cats: [],
    budgets: {},
    overall: 0,
    hard: false,
    ef: [],
    efTarget: 0,
    goals: [],
    imports: [],
    trash: [],
    parents: []
  });

  let S: StudentSpendState = DEFS();
  let flash: [string, string] | null = null;
  let wd: { amt: number; reason: string; note: string } | null = null;
  let RO = false;
  let dbDoc: any = null;
  let pt: any = null;
  let UK = 'ss1';
  let USER: any = null;

  const R = (n: number) => "₹" + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN");
  const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
  const norm = (s: string) => String(s || "").trim().replace(/\s+/g, " ");
  const allCats = () => [...DEF, ...(S.cats || [])];
  const today = () => new Date().toISOString().slice(0, 10);
  const mo = (d: string) => String(d || "").slice(0, 7);
  const curMo = () => today().slice(0, 7);
  const pmo = () => {
    const d = new Date();
    const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return p.getFullYear() + "-" + String(p.getMonth() + 1).padStart(2, "0");
  };
  const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const fd = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const sum = (a: any[]) => (a || []).reduce((t, x) => t + (Number(x.amount) || 0), 0);
  const inc = () => sum(S.tx.filter(t => t.type == "income"));
  const exp = () => sum(S.tx.filter(t => t.type == "expense"));
  const efBal = () => sum(S.ef.filter(e => e.kind == "contribute")) - sum(S.ef.filter(e => e.kind == "withdraw"));
  const gSaved = () => (S.goals || []).reduce((t, g) => t + (Number(g.saved) || 0), 0);
  const avail = () => inc() - exp() - efBal() - gSaved();
  const spent = (cat: string | null, m: string) => sum(S.tx.filter(t => t.type == "expense" && mo(t.date) == m && (!cat || t.cat == cat)));
  const pb = (p: number) => { const c = p >= 100 ? "x" : p >= 80 ? "w" : ""; return `<div class="bar ${c}"><i style="width:${Math.min(Math.max(p, 0), 100)}%"></i></div>`; };
  const lvl = (p: number) => p >= 100 ? "Budget exceeded" : p >= 80 ? "Budget warning" : "Normal";
  const notice = () => { const f = flash; flash = null; return f ? `<div class="msg ${f[0]}" role="status">${esc(f[1])}</div>` : ""; };
  const catOpts = (sel: string) => allCats().map(c => `<option ${c == sel ? "selected" : ""}>${esc(c)}</option>`).join("");
  const $ = (id: string): any => document.getElementById(id);

  const save = () => {
    if (RO) return;
    try { localStorage.setItem(UK, JSON.stringify(S)); } catch (e) { }
    pushDb();
  };

  const pushDb = () => {
    if (!USER) return;
    clearTimeout(pt);
    pt = setTimeout(() => {
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER.id, data: S }),
      }).catch(() => { });
    }, 600);
  };

  const toTrash = (k: 'tx' | 'goal' | 'all', i: any) => {
    S.trash = S.trash || [];
    S.trash.push({ kind: k, item: JSON.parse(JSON.stringify(i)), at: Date.now() });
  };

  const USERS_K = 'ss_users';
  const users = (): any[] => { try { return JSON.parse(localStorage.getItem(USERS_K) || '[]'); } catch (e) { return []; } };
  const saveUsers = (a: any[]) => { try { localStorage.setItem(USERS_K, JSON.stringify(a)); } catch (e) { } };
  const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b as any)));
  const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function hashPw(pw: string, salt: Uint8Array) {
    if (!window.crypto || !crypto.subtle) return btoa(pw);
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as any, iterations: 150000, hash: 'SHA-256' }, k, 256));
  }
  function normId(raw: string) {
    const s = String(raw || '').trim();
    if (/^\S+@\S+\.\S+$/.test(s)) return { t: 'email', v: s.toLowerCase() };
    const d = s.replace(/[\s()-]/g, '');
    if (/^(\+91|91|0)?[6-9]\d{9}$/.test(d)) return { t: 'phone', v: d.slice(-10) };
    if (/^[A-Za-z0-9_.]{3,20}$/.test(s)) return { t: 'id', v: s.toLowerCase() };
    return null;
  }
  const normCode = (s: any) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function genCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const r = crypto.getRandomValues(new Uint8Array(12));
    const c = [...r].map(x => A[x % A.length]).join('');
    return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8);
  }
  async function setCode(u: any) {
    const code = genCode();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    u.rs = b64(salt);
    u.rh = await hashPw(normCode(code), salt);
    return code;
  }

  let au = { tab: 'in', msg: '', fails: 0, lock: 0, id: '', name: '', ok: false };
  function authErr(m: string) { au.msg = m; au.ok = false; authView(); }

  function authView() {
    applyTheme();
    document.body.classList.add('na');
    let a = document.getElementById('auth');
    if (!a) {
      a = document.createElement('div');
      a.id = 'auth';
      document.body.appendChild(a);
    }
    const T = au.tab, up = T == 'up', rs = T == 'reset';
    const legacy = !users().length && (() => { try { return !!localStorage.getItem('ss1'); } catch (e) { return false; } })();
    a.innerHTML = `<div class='ab'><h1>₹ StudentSpend</h1><p class='note'>${up ? 'Create your account' : rs ? 'Reset your password' : 'Sign in to your tracker'}</p>
<div class='f'><button class='o ${T == 'in' ? 'sel' : ''}' onclick="au.tab='in';au.msg='';authView()">Sign in</button><button class='o ${up ? 'sel' : ''}' onclick="au.tab='up';au.msg='';authView()">Create account</button></div>
${au.msg ? `<div class='msg ${au.ok ? '' : 'e'}' role='alert'>${esc(au.msg)}</div>` : ''}
${up ? `<input id='un' type='text' autocomplete='name' placeholder='Your name' aria-label='Name' value="${esc(au.name || '')}">` : ''}
<input id='ui' type='text' autocomplete='username' placeholder='Email, mobile number or user ID' aria-label='Email, mobile number or user ID' value="${esc(au.id || '')}">
${rs ? `<input id='rc' type='text' autocomplete='off' placeholder='Recovery code (XXXX-XXXX-XXXX)' aria-label='Recovery code'>` : ''}
<input id='up' type='password' autocomplete='${T == 'in' ? 'current-password' : 'new-password'}' placeholder='${rs ? 'New password' : 'Password'}' aria-label='Password' onkeydown="if(event.key=='Enter'){${T == 'in' ? 'doSignIn()' : ''}}">
${T != 'in' ? `<input id='uc' type='password' autocomplete='new-password' placeholder='Confirm password' aria-label='Confirm password' onkeydown="if(event.key=='Enter'){${up ? 'doSignUp()' : 'doReset()'}}"><p class='note'>At least 8 characters, with letters and numbers.</p>` : ''}
<label class='note'><input type='checkbox' onchange="document.getElementById('up').type=this.checked?'text':'password'"> Show password</label><br>
${rs ? '' : `<label class='note'><input id='uk' type='checkbox'> Keep me signed in on this device</label>`}
${up && legacy ? `<br><label class='note'><input id='um' type='checkbox' checked> Move the data already saved in this browser into this account</label>` : ''}
<p><button class='big' onclick='${up ? 'doSignUp()' : rs ? 'doReset()' : 'doSignIn()'}'>${up ? 'Create account' : rs ? 'Reset password' : 'Sign in'}</button></p>
${T == 'in' ? `<p><button class='o' onclick="au.tab='reset';au.msg='';authView()">Forgot password?</button></p>` : ''}
${rs ? `<p><button class='o' onclick="au.tab='in';au.msg='';authView()">Back to sign in</button> <button class='s' onclick='eraseAcct()'>No recovery code? Erase account</button></p>` : ''}
<p class='note'>Accounts and data are stored only in this browser on this device. There is no email or SMS verification.</p></div>`;
    au.ok = false;
    const f = document.getElementById(up ? 'un' : 'ui');
    if (f && !au.msg) f.focus();
  }

  async function doSignUp() {
    const unEl = $('un');
    const name = unEl ? unEl.value.trim() : '';
    const raw = ($('ui') || {}).value || '';
    const pw = ($('up') || {}).value || '';
    const pc = ($('uc') || {}).value || '';
    au.id = raw; au.name = name;
    if (!window.crypto || !crypto.subtle) return authErr('This browser cannot create secure passwords. Open the page in a modern browser over https or on localhost.');
    if (!name) return authErr('Enter your name.');
    const id = normId(raw);
    if (!id) return authErr('Enter a valid email, a 10-digit Indian mobile number, or a user ID (3 to 20 letters, numbers, _ or .).');
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return authErr('Password must be at least 8 characters with letters and numbers.');
    if (pw !== pc) return authErr('The passwords do not match.');
    const us = users();
    if (us.some(u => u.idv == id.v)) return authErr('An account with this email, number or ID already exists on this device. Sign in instead.');
    const mv = $('um') && $('um').checked, keep = $('uk') && $('uk').checked;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const u: any = { id: 'u' + Date.now().toString(36), name, idt: id.t, idv: id.v, salt: b64(salt), hash: await hashPw(pw, salt), at: Date.now() };
    const code = await setCode(u);
    us.push(u);
    saveUsers(us);

    // Sync to backend MongoDB API
    fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u),
    }).catch(() => { });

    if (mv) {
      try {
        const old = localStorage.getItem('ss1');
        if (old) { localStorage.setItem('ss1_' + u.id, old); localStorage.removeItem('ss1'); }
      } catch (e) { }
    }
    showCode(code, () => enter(u, keep));
  }

  async function doSignIn() {
    const raw = ($('ui') || {}).value || '';
    const pw = ($('up') || {}).value || '';
    const keep = $('uk') && $('uk').checked;
    au.id = raw;
    if (Date.now() < au.lock) return authErr(`Too many attempts. Try again in ${Math.ceil((au.lock - Date.now()) / 1000)} seconds.`);
    const id = normId(raw);
    if (!id) return authErr('Enter a valid email, mobile number or user ID.');

    let u = users().find(x => x.idv == id.v);
    if (!u) {
      // Query backend MongoDB if not cached on this device
      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idv: id.v }),
        });
        const json = await res.json();
        if (json && json.ok && json.user) {
          u = json.user;
          const currentUsers = users();
          currentUsers.push(u);
          saveUsers(currentUsers);
        }
      } catch (e) { }
    }

    let ok = false;
    if (u && window.crypto && crypto.subtle) ok = (await hashPw(pw, unb64(u.salt))) === u.hash;
    if (!ok) {
      au.fails++;
      if (au.fails >= 5) {
        au.lock = Date.now() + 30000;
        au.fails = 0;
        return authErr('Too many attempts. Try again in 30 seconds.');
      }
      return authErr('Incorrect email, number, user ID or password.');
    }
    au.fails = 0;
    enter(u, keep);
  }

  async function doReset() {
    const raw = ($('ui') || {}).value || '';
    const code = ($('rc') || {}).value || '';
    const pw = ($('up') || {}).value || '';
    const pc = ($('uc') || {}).value || '';
    au.id = raw;
    if (Date.now() < au.lock) return authErr(`Too many attempts. Try again in ${Math.ceil((au.lock - Date.now()) / 1000)} seconds.`);
    if (!window.crypto || !crypto.subtle) return authErr('This browser cannot create secure passwords.');
    const id = normId(raw);
    const us = users();
    const u = id && us.find(x => x.idv == id.v);
    if (!u) return authErr('No account found for that email, number or user ID on this device.');
    if (!u.rh) return authErr('This account was created before recovery codes existed, so it has none. You can erase it and create it again.');
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return authErr('New password must be at least 8 characters with letters and numbers.');
    if (pw !== pc) return authErr('The passwords do not match.');
    if ((await hashPw(normCode(code), unb64(u.rs))) !== u.rh) {
      au.fails++;
      if (au.fails >= 5) {
        au.lock = Date.now() + 30000;
        au.fails = 0;
        return authErr('Too many attempts. Try again in 30 seconds.');
      }
      return authErr('That recovery code is not correct.');
    }
    au.fails = 0;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    u.salt = b64(salt);
    u.hash = await hashPw(pw, salt);
    const ncode = await setCode(u);
    saveUsers(us);

    // Sync auth update to backend MongoDB API
    fetch('/api/auth/update-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, hash: u.hash, salt: u.salt, rs: u.rs, rh: u.rh }),
    }).catch(() => { });

    showCode(ncode, () => {
      au.tab = 'in';
      au.msg = 'Password changed. Sign in with your new password.';
      au.ok = true;
      authView();
    });
  }

  function eraseAcct() {
    const id = normId(($('ui') || {}).value);
    const u = id && users().find(x => x.idv == id.v);
    if (!u) return authErr('Type your email, number or user ID in the first box, then tap Erase account.');
    cfm('Erase this account and all its data on this device? You can then create it again. This cannot be undone.', () => {
      saveUsers(users().filter(x => x.id != u.id));
      try { localStorage.removeItem('ss1_' + u.id); } catch (e) { }

      // Erase from MongoDB backend
      fetch('/api/auth/erase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id }),
      }).catch(() => { });

      au.tab = 'up';
      authErr('Account erased. You can create it again.');
    });
  }

  function forgot() { au.tab = 'reset'; au.msg = ''; authView(); }

  function showCode(code: string, next: () => void) {
    const d = document.createElement('div');
    d.className = 'mo';
    d.innerHTML = `<div class='mb' role='dialog' aria-modal='true'><h3 style='margin-top:0'>Save your recovery code</h3><p class='note'>If you forget your password, this code is the only way to reset it without losing your data. It is shown only once. Write it down or keep a screenshot somewhere safe.</p><div class='fb' style='text-align:center;font-size:20px;letter-spacing:2px;margin-bottom:10px'><b id='rcv'>${code}</b></div><div class='f'><button class='o' id='rcc'>Copy</button><button id='rcd'>I have saved it</button></div><span id='rcm' class='note'></span></div>`;
    document.body.appendChild(d);
    $('rcc').onclick = () => copyText(code, 'rcm');
    $('rcd').onclick = () => { d.remove(); next(); };
  }

  function loadUser(u: any) {
    USER = u;
    UK = 'ss1_' + u.id;
    let d: any = {};
    try { d = JSON.parse(localStorage.getItem(UK) || '{}'); } catch (e) { }
    S = Object.assign(DEFS(), d);
    if (!S.profile) S.profile = { name: u.name, email: u.idt == 'email' ? u.idv : '' };
    S.trash = (S.trash || []).filter(x => Date.now() - x.at < 30 * 864e5);
    S.parents = S.parents || [];
    S.goals = S.goals || [];
    S.ef = S.ef || [];
    S.tx = S.tx || [];
    S.cats = S.cats || [];
    S.budgets = S.budgets || {};

    // Background fetch from MongoDB to sync latest records across sessions/devices
    fetch('/api/data?userId=' + encodeURIComponent(u.id))
      .then(r => r.json())
      .then(res => {
        if (res && res.ok && res.data) {
          const remote = res.data;
          const localTime = d.updatedAt || 0;
          const remoteTime = remote.updatedAt || 0;
          if (remoteTime >= localTime && remote.tx && remote.tx.length >= S.tx.length) {
            S = Object.assign(DEFS(), remote);
            try { localStorage.setItem(UK, JSON.stringify(S)); } catch (e) { }
            render();
          }
        }
      })
      .catch(() => { });
  }

  function enter(u: any, keep: boolean) {
    try {
      localStorage.removeItem('ss_sess');
      sessionStorage.removeItem('ss_sess');
      (keep ? localStorage : sessionStorage).setItem('ss_sess', u.id);
    } catch (e) { }
    loadUser(u);
    document.body.classList.remove('na');
    const a = document.getElementById('auth');
    if (a) a.remove();
    au.msg = ''; au.id = ''; au.name = '';
    flash = null;
    location.hash = 'dashboard';
    render();
    pushDb();
  }

  function doSignOut() {
    try {
      localStorage.removeItem('ss_sess');
      sessionStorage.removeItem('ss_sess');
    } catch (e) { }
    USER = null;
    UK = 'ss1';
    S = DEFS();
    wd = null;
    imp = null;
    flash = null;
    au.tab = 'in';
    render();
  }

  function signOut() {
    if (RO) return;
    cfm('Sign out of StudentSpend? You can sign in again with your password.', doSignOut);
  }

  function cfm(msg: string, fn: (val?: any) => void, inp?: string) {
    const d = document.createElement('div');
    d.className = 'mo';
    d.innerHTML = `<div class='mb' role='dialog' aria-modal='true'><p>${esc(msg)}</p>${inp != null ? `<input id='mi' value="${esc(inp)}">` : ''}<div class='f'><button id='my'>Confirm</button><button class='o' id='mn'>Cancel</button></div></div>`;
    document.body.appendChild(d);
    translate();
    const x = () => d.remove();
    $('mn').onclick = x;
    $('my').onclick = () => { const v = inp != null ? $('mi').value : null; x(); fn(v); };
    (inp != null ? $('mi') : $('mn')).focus();
  }

  const ini = () => (((S.profile && S.profile.name) || (USER && USER.name) || 'S').trim().charAt(0) || 'S').toUpperCase();
  function who() {
    const p = S.profile || {}, e = $('who'), a = $('av');
    if (e) e.textContent = (RO ? '👪 Parent view (read only)' + (p.name ? ' · ' + p.name : '') : (p.name ? 'Hi, ' + p.name : 'Profile not set'));
    if (a) a.textContent = RO ? '👪' : ini();
  }

  function showProfile() {
    if (document.querySelector('.mo')) return;
    const p = S.profile || {}, u = USER || {};
    const d = document.createElement('div');
    d.className = 'mo';
    d.onclick = e => { if (e.target == d) d.remove(); };
    d.innerHTML = `<div class='mb' role='dialog' aria-modal='true' aria-label='Your profile'><div style='display:flex;gap:14px;align-items:center;margin-bottom:12px'><div class='av big2'>${RO ? '👪' : ini()}</div><div><b style='font-size:18px'>${esc(p.name || u.name || 'Student')}</b><br><span class='note'>${esc(u.idv || (RO ? 'Parent view' : ''))}</span></div></div><div class='note'>College: ${esc(p.college || 'Not set')}<br>Email: ${esc(p.email || 'Not set')}<br>Parent: ${esc(p.parent || 'Not set')}</div><div class='f' style='margin-top:14px'>${RO ? '' : `<button id='pe1'>Edit profile</button><button class='o' id='pe2'>Sign out</button>`}<button class='o' id='pe3'>Close</button></div></div>`;
    document.body.appendChild(d);
    if (!RO) {
      $('pe1').onclick = () => { d.remove(); location.hash = 'settings'; };
      $('pe2').onclick = () => { d.remove(); signOut(); };
    }
    $('pe3').onclick = () => d.remove();
  }

  // Alerts logic
  function alerts(): Array<[string, string]> {
    const m = curMo(), A: Array<[string, string]> = [], ms = spent(null, m);
    if (S.overall) {
      const p = ms / S.overall * 100;
      if (p >= 100) A.push(['e', `You have crossed your monthly budget: ${R(ms)} of ${R(S.overall)}.`]);
      else if (p >= 80) A.push(['w', `You have used ${Math.round(p)}% of your monthly budget.`]);
    }
    Object.entries(S.budgets || {}).forEach(([c, b]) => {
      const p = spent(c, m) / b * 100;
      if (p >= 100) A.push(['e', `${c}: over budget (${R(spent(c, m))} of ${R(b)}). Spend less here.`]);
      else if (p >= 80) A.push(['w', `${c}: ${Math.round(p)}% of its budget is used.`]);
    });
    const by = byCat(t => t.type == 'expense' && mo(t.date) == m);
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    if (top && ms > 0 && Object.keys(by).length > 1 && top[1] / ms >= 0.4) {
      A.push(['w', `You are spending the most on ${top[0]}: ${Math.round(top[1] / ms * 100)}% of this month’s spending.`]);
    }
    const lm = spent(null, pmo());
    if (lm > 0 && ms > lm * 1.2) {
      A.push(['w', `Spending is up ${Math.round((ms / lm - 1) * 100)}% compared with last month.`]);
    }
    if (S.tx.length) {
      const last = [...S.tx].sort((a, b) => b.date.localeCompare(a.date))[0].date;
      const d = Math.floor((Date.now() - new Date(last).getTime()) / 864e5);
      if (d >= 3) A.push(['', `Reminder: nothing recorded for ${d} days. Add your recent expenses.`]);
    }
    if (avail() < 0) A.push(['e', 'Your available balance is negative. Check your entries.']);
    return A;
  }

  function alertBox() {
    const A = alerts();
    return `<div class='c'><h3>🔔 Alerts &amp; reminders${A.length ? ` <span class='badge'>${A.length}</span>` : ''}</h3>${A.length ? A.map(a => `<div class='msg ${a[0]}'>${esc(a[1])}</div>`).join('') : `<div class='note'>All good. No overspending alerts.</div>`}</div>`;
  }

  // Dashboard
  function dashboard() {
    const m = curMo(), ms = spent(null, m), rem = S.overall ? S.overall - ms : null;
    const months = [...new Set(S.tx.map(t => mo(t.date)))].sort().slice(-6);
    const mx = Math.max(1, ...months.map(x => Math.max(sum(S.tx.filter(t => t.type == "income" && mo(t.date) == x)), spent(null, x))));
    const bars = months.map(x => {
      const i = sum(S.tx.filter(t => t.type == "income" && mo(t.date) == x)), e = spent(null, x);
      return `<div><span><b style="height:${(i / mx * 100) || 0}%;background:var(--ac)" title="Income ${R(i)}"></b><b style="height:${(e / mx * 100) || 0}%;background:var(--er)" title="Expenses ${R(e)}"></b></span>${x}</div>`;
    }).join("");
    const bycat: Record<string, number> = {};
    S.tx.filter(t => t.type == "expense" && mo(t.date) == m).forEach(t => bycat[t.cat] = (bycat[t.cat] || 0) + t.amount);
    const cr = Object.entries(bycat).sort((a, b) => b[1] - a[1]);
    const recent = [...S.tx].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 5);
    return `<h2>Dashboard</h2><p class="sub">Everything below is calculated from your saved entries.</p>${notice()}${alertBox()}
${!S.tx.length ? `<div class="msg">No transactions yet. <a href="#transactions">Add your first pocket money entry</a> to get started.</div>` : ""}
<div class="hero"><div><div class="k">Available to spend</div><div class="big">${R(avail())}</div><div class="k">Money you can use right now</div></div><div class="pills"><span>🛡️ Emergency ${R(efBal())}</span><span>🐷 Goals ${R(gSaved())}</span></div></div>
<div class="g">
<div class="c"><div class="k">Total received</div><div class="v">${R(inc())}</div></div>
<div class="c"><div class="k">Total spent</div><div class="v">${R(exp())}</div></div>
<div class="c"><div class="k">Emergency Fund (protected)</div><div class="v">${R(efBal())}</div></div>
<div class="c"><div class="k">Monthly budget</div><div class="v">${S.overall ? R(S.overall) : "Not set"}</div><div class="note">${rem === null ? "" : "Remaining: " + R(rem)}</div></div></div>
<div class="c"><h3>Income vs expenses by month</h3>${months.length ? `<div class="cols">${bars}</div><div class="note">Green: income · Red: expenses</div>` : `<div class="note">Add transactions to see this chart.</div>`}</div>
<div class="c"><h3>This month’s spending by category</h3>${cr.length ? cr.map(([c, a]) => `<div class="row"><span>${esc(c)}</span><span>${R(a)} (${Math.round(a / (ms || 1) * 100)}%)</span></div><div class="bar"><i style="width:${(a / (ms || 1) * 100) || 0}%"></i></div>`).join("") : `<div class="note">No expenses this month.</div>`}</div>
<div class="c"><h3>Recent transactions</h3>${recent.length ? `<div class="tw"><table>${recent.map(t => `<tr><td>${t.date}</td><td>${esc(t.desc)}</td><td>${esc(t.cat)}</td><td class="${t.type == "income" ? "pos" : "neg"}">${t.type == "income" ? "+" : "−"}${R(t.amount)}</td></tr>`).join("")}</table></div>` : `<div class="note">Nothing yet.</div>`}</div>`;
  }

  // Transactions
  function transactions() {
    const q = ($("q") || {}).value || "", fc = ($("fc") || {}).value || "", ft = ($("ft") || {}).value || "", so = ($("so") || {}).value || "date";
    let L = S.tx.filter(t => t.desc.toLowerCase().includes(q.toLowerCase()) && (!fc || t.cat == fc) && (!ft || t.type == ft));
    L.sort(so == "amt" ? (a, b) => b.amount - a.amount : (a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    return `<h2>Transactions</h2><p class="sub">Pocket money can arrive in any amount on any date. Add each entry as it happens.</p>${notice()}
<div class="c"><h3>Add transaction</h3><div class="f">
<select id="ty" aria-label="Type"><option value="income">Income</option><option value="expense" selected>Expense</option></select>
<input id="de" placeholder="Description" aria-label="Description"><input id="am" type="number" min="0.01" step="0.01" placeholder="Amount (₹)" aria-label="Amount">
<select id="ca" aria-label="Category">${catOpts("Food")}</select><input id="da" type="date" value="${today()}" aria-label="Date"></div>
<button onclick="addTx()">Save transaction</button> <button class="o" onclick="aiCat()">✨ Suggest category</button> <span id="sg" class="note"></span> <span class="note" style="display:block;margin-top:6px">Income and expenses only. Emergency Fund transfers live on their own page.</span></div>
<div class="c"><div class="f"><input id="q" value="${esc(q)}" placeholder="Search description" oninput="go()" aria-label="Search">
<select id="fc" onchange="go()" aria-label="Filter category"><option value="">All categories</option>${catOpts(fc)}</select>
<select id="ft" onchange="go()" aria-label="Filter type"><option value="">Income and expense</option><option value="income" ${ft == "income" ? "selected" : ""}>Income</option><option value="expense" ${ft == "expense" ? "selected" : ""}>Expense</option></select>
<select id="so" onchange="go()" aria-label="Sort"><option value="date">Newest first</option><option value="amt" ${so == "amt" ? "selected" : ""}>Largest first</option></select></div>
${L.length ? `<div class="tw"><table><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th></th></tr>${L.map(t => `<tr><td>${t.date}</td><td>${esc(t.desc)}</td><td>${esc(t.cat)}</td><td class="${t.type == "income" ? "pos" : "neg"}">${t.type == "income" ? "+" : "−"}${R(t.amount)}</td><td><button class="s" onclick="delTx(${t.id})">Delete</button></td></tr>`).join("")}</table></div>` : `<div class="note">No matching transactions.</div>`}</div>`;
  }

  function addTx() {
    const type = $("ty").value as 'income' | 'expense';
    const desc = $("de").value.trim();
    const amount = parseFloat($("am").value);
    const cat = type == "income" ? "Pocket Money" : $("ca").value;
    const date = $("da").value;
    if (!desc || !(amount > 0) || !date) {
      flash = ["e", "Enter a description, a positive amount and a date."];
      return render();
    }
    if (type == "expense") {
      if (amount > avail()) {
        flash = ["e", "This expense is more than your available balance of " + R(avail()) + ". Add income first, or move money back from the Emergency Fund only if it is a genuine emergency."];
        return render();
      }
      const m = date.slice(0, 7), cb = S.budgets[cat];
      if (S.hard || (S.strict && S.strict[cat])) {
        if (cb && spent(cat, m) + amount > cb) {
          flash = ["e", `Blocked by your in-app limit: ${cat} budget is ${R(cb)} and you have spent ${R(spent(cat, m))}. Raise the limit on the Budgets page to continue.`];
          return render();
        }
        if (S.hard && S.overall && spent(null, m) + amount > S.overall) {
          flash = ["e", `Blocked by your in-app limit: monthly budget ${R(S.overall)} would be exceeded. Raise the limit on the Budgets page to continue.`];
          return render();
        }
      }
    }
    S.tx.push({ id: Date.now(), type, desc, amount, cat, date });
    save();
    let msg = "Saved.";
    const m = date.slice(0, 7);
    if (type == "expense") {
      const cb = S.budgets[cat];
      if (cb && spent(cat, m) >= cb * 0.8) msg = `Saved. ${cat} budget: ${lvl(spent(cat, m) / cb * 100)} (${Math.round(spent(cat, m) / cb * 100)}%).`;
      else if (S.overall && spent(null, m) >= S.overall * 0.8) msg = `Saved. Monthly budget: ${lvl(spent(null, m) / S.overall * 100)}.`;
    }
    flash = ["", msg];
    render();
  }

  function delTx(id: number) {
    const t = S.tx.find(x => x.id == id);
    if (!t) return;
    cfm(`Delete "${t.desc}"? You can restore it from Recently deleted for 30 days.`, () => {
      toTrash('tx', t);
      S.tx = S.tx.filter(x => x.id != id);
      save();
      flash = ['', 'Moved to Recently deleted.'];
      render();
    });
  }

  const CK: Record<string, RegExp> = {
    Food: /zomato|swiggy|cafe|restaurant|canteen|mess|pizza|food|burger|tea|chai|coffee|snacks|lunch|dinner|breakfast|maggi|dosa|biryani/i,
    Transport: /uber|ola|rapido|metro|bus|irctc|petrol|fuel|auto|train|cab|flight|fare/i,
    Education: /book|course|udemy|fees|exam|print|xerox|stationery|pen|notebook|tution|tuition|library/i,
    Entertainment: /netflix|spotify|movie|bookmyshow|game|steam|cinema|prime|hotstar|party/i,
    Shopping: /amazon|flipkart|myntra|ajio|meesho|zara|h&m|clothes|shoes|mall/i,
    Bills: /recharge|jio|airtel|vi|electric|wifi|bill|electricity|water|gas|broadband|rent/i,
    Health: /pharm|medic|hospital|clinic|doctor|tablet|apollo|1mg|dentist|eyewear/i,
    Hostel: /hostel|mess fees|room rent|laundry|maintenance/i,
    Travel: /trip|vacation|hotel|resort|oyo|tour|trek/i
  };

  const suggest = (d: string) => {
    for (const [c, r] of Object.entries(CK)) {
      if (r.test(d)) return c;
    }
    return "Other";
  };

  async function aiCat() {
    const d = ($('de') || {}).value?.trim() || '';
    const sg = $('sg');
    if (!d) {
      if (sg) sg.textContent = 'Type a description first.';
      return;
    }
    let pick = suggest(d), src = 'Keyword match';
    if (sg) sg.textContent = 'Thinking…';

    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desc: d, categories: allCats() }),
      });
      const json = await res.json();
      if (json && json.ok && json.category) {
        const match = allCats().find(c => c.toLowerCase() === json.category.toLowerCase());
        if (match) {
          pick = match;
          src = json.source === 'gemini' ? 'Gemini AI' : 'Smart match';
        }
      }
    } catch (e) {
      // Fallback seamlessly to local keyword matching
    }

    const el = $('ca');
    if (el) el.value = pick;
    if (sg) sg.textContent = 'Suggested: ' + pick + ' (' + src + '). You can change it.';
  }

  // Budgets
  function budgets() {
    const m = curMo(), ms = spent(null, m), op = S.overall ? ms / S.overall * 100 : 0;
    return `<h2>Budgets</h2><p class="sub">Spending for ${m}.</p>${notice()}
<div class="c"><h3>Monthly limit</h3><div class="f"><input id="ov" type="number" min="0" value="${S.overall || ""}" placeholder="Overall monthly budget (₹)" aria-label="Overall budget"><button onclick="setOv()">Save limit</button></div>
${S.overall ? `<div class="row"><span>${R(ms)} of ${R(S.overall)}</span><span>${Math.round(op)}% · ${lvl(op)}</span></div>${pb(op)}` : `<div class="note">No monthly limit set.</div>`}
<p><label><input type="checkbox" ${S.hard ? "checked" : ""} onchange="S.hard=this.checked;save();render()"> In-app spending restriction: refuse to record expenses that exceed a limit</label></p>
<div class="note">Warning mode (default) only alerts you. Restriction mode applies inside StudentSpend only. It cannot block real UPI, card or bank payments.</div></div>
<div class="c"><h3>Category budgets</h3><div class="f"><select id="bc" aria-label="Category">${catOpts("")}</select><input id="ba" type="number" min="1" placeholder="Amount (₹)" aria-label="Category budget"><button onclick="setB()">Set budget</button></div>
${Object.keys(S.budgets || {}).length ? Object.entries(S.budgets).map(([c, b]) => {
      const s = spent(c, m), p = s / b * 100;
      return `<div class="row"><span>${esc(c)} <button class="s" onclick="delB('${esc(c).replace(/'/g, "\\'")}')">Remove</button> <label class="note"><input type="checkbox" ${S.strict && S.strict[c] ? "checked" : ""} onchange="setStrict('${esc(c).replace(/'/g, "\\'")}',this.checked)"> Strict limit</label></span><span>${R(s)} of ${R(b)} · ${Math.round(p)}% · ${lvl(p)}</span></div>${pb(p)}`;
    }).join("") : `<div class="note">No category budgets yet.</div>`}</div>`;
  }

  function setOv() {
    const v = parseFloat($("ov").value);
    if (!(v >= 0)) { flash = ["e", "Enter a valid amount."]; return render(); }
    S.overall = v; save(); flash = ["", "Monthly limit saved."]; render();
  }

  function setB() {
    const v = parseFloat($("ba").value), c = $("bc").value;
    if (!(v > 0)) { flash = ["e", "Enter a positive budget amount."]; return render(); }
    S.budgets[c] = v; save(); flash = ["", `${c} budget saved.`]; render();
  }

  function delB(c: string) { delete S.budgets[c]; save(); render(); }
  function setStrict(c: string, v: boolean) {
    S.strict = S.strict || {};
    if (v) S.strict[c] = true; else delete S.strict[c];
    save();
    flash = ["", v ? c + " now has a strict limit: expenses over its budget are refused inside StudentSpend." : c + " is back to warning-only."];
    render();
  }

  // Emergency Fund
  function emergency() {
    const con = sum(S.ef.filter(e => e.kind == "contribute")), wdw = sum(S.ef.filter(e => e.kind == "withdraw")), p = S.efTarget ? efBal() / S.efTarget * 100 : 0;
    const reasons = ["Urgent medical needs", "Essential emergency travel", "Urgent family needs", "Unexpected essential expenses", "Other genuine emergencies"];
    const wdBox = wd ? `<div class="msg e"><b>Confirm emergency withdrawal</b><p>You are about to move ${R(wd.amt)} out of protected savings (reason: ${esc(wd.reason)}). Your Emergency Fund will become ${R(efBal() - wd.amt)}. Only continue for a genuine emergency.</p>
<button onclick="doWd()">Yes, withdraw ${R(wd.amt)}</button> <button class="o" onclick="wd=null;render()">Cancel</button></div>`
      : `<div class="f"><input id="wa" type="number" min="1" placeholder="Amount (₹)" aria-label="Withdrawal amount"><select id="wr" aria-label="Reason">${reasons.map(r => `<option>${r}</option>`).join("")}</select><input id="wn" placeholder="Optional explanation" aria-label="Explanation"></div><button onclick="reqWd()">Withdraw for Emergency</button>`;
    return `<h2>Emergency Fund</h2><p class="sub"><b>Protected Emergency Savings — Reserved for Genuine Emergencies.</b></p>${notice()}
<div class="g"><div class="c"><div class="k">Balance</div><div class="v">${R(efBal())}</div></div><div class="c"><div class="k">Contributed</div><div class="v">${R(con)}</div></div><div class="c"><div class="k">Withdrawn</div><div class="v">${R(wdw)}</div></div><div class="c"><div class="k">Available to spend</div><div class="v">${R(avail())}</div></div></div>
<div class="c"><h3>Target</h3><div class="f"><input id="tg" type="number" min="0" value="${S.efTarget || ""}" placeholder="Optional target (₹)" aria-label="Target"><button onclick="S.efTarget=Math.max(0,parseFloat($('tg').value)||0);save();render()">Save target</button></div>${S.efTarget ? `<div class="row"><span>${Math.round(p)}% of ${R(S.efTarget)}</span></div>${pb(Math.min(p, 99))}` : ""}</div>
<div class="c"><h3>Add to Emergency Fund</h3><div class="f"><input id="ca2" type="number" min="1" placeholder="Amount (₹)" aria-label="Contribution"><input id="cn" placeholder="Optional note" aria-label="Note"></div><button onclick="contrib()">Reserve money</button></div>
<div class="c"><h3>Withdraw for Emergency</h3>${wdBox}</div>
<div class="c"><h3>History</h3>${S.ef.length ? `<div class="tw"><table>${[...S.ef].reverse().map(e => `<tr><td>${e.date}</td><td>${e.kind == "contribute" ? "Contribution" : "Emergency withdrawal"}</td><td>${R(e.amount)}</td><td>${esc(e.reason || e.note || "")}</td></tr>`).join("")}</table></div>` : `<div class="note">No activity yet.</div>`}</div>
<p class="note">This is an app-level safeguard, not a bank lock. It cannot stop you from spending the real money elsewhere.</p>`;
  }

  function contrib() {
    const a = parseFloat($("ca2").value);
    if (!(a > 0)) { flash = ["e", "Enter a positive amount."]; return render(); }
    if (a > avail()) { flash = ["e", "You only have " + R(avail()) + " available to reserve."]; return render(); }
    S.ef.push({ id: Date.now(), kind: "contribute", amount: a, note: ($("cn").value || "").trim(), date: today() });
    save();
    flash = ["", R(a) + " moved into protected savings."];
    render();
  }

  function reqWd() {
    const a = parseFloat($("wa").value);
    if (!(a > 0)) { flash = ["e", "Enter a positive amount."]; return render(); }
    if (a > efBal()) { flash = ["e", "Withdrawal is more than the Emergency Fund balance of " + R(efBal()) + "."]; return render(); }
    wd = { amt: a, reason: $("wr").value, note: ($("wn").value || "").trim() };
    render();
  }

  function doWd() {
    if (!wd || wd.amt > efBal()) { wd = null; flash = ["e", "Balance changed. Try again."]; return render(); }
    S.ef.push({ id: Date.now(), kind: "withdraw", amount: wd.amt, reason: wd.reason + (wd.note ? " — " + wd.note : ""), date: today() });
    wd = null;
    save();
    flash = ["", "Withdrawal recorded. It is not income and not an expense; record any actual spending separately."];
    render();
  }

  // Categories
  function categories() {
    return `<h2>Categories</h2><p class="sub">Custom categories work in transactions, budgets and filters.</p>${notice()}
<div class="c"><h3>Add category</h3><div class="f"><input id="nc" placeholder="e.g. Stationery" aria-label="New category"><button onclick="addCat()">Add category</button></div></div>
<div class="c"><h3>Your categories</h3>${S.cats.length ? S.cats.map((c, i) => `<div class="row"><span>${esc(c)} <span class="note">(${S.tx.filter(t => t.cat == c).length} transactions)</span></span><span><button class="o" onclick="renCat(${i})">Rename</button> <button class="s" onclick="delCat(${i})">Delete</button></span></div>`).join("") : `<div class="note">None yet.</div>`}
<p class="note">Built-in: ${DEF.join(", ")}</p></div>`;
  }

  const dup = (n: string) => allCats().some(c => c.toLowerCase() == n.toLowerCase());
  function addCat() {
    const n = norm($("nc").value);
    if (!n) { flash = ["e", "Category name cannot be empty."]; return render(); }
    if (dup(n)) { flash = ["e", "That category already exists."]; return render(); }
    S.cats.push(n);
    save();
    flash = ["", n + " added."];
    render();
  }

  function renCat(i: number) {
    const old = S.cats[i];
    cfm('New name for this category', v => {
      const n = norm(v || '');
      if (!n || n == old) return;
      if (dup(n)) { flash = ['e', 'That name is already used.']; return render(); }
      S.tx.forEach(t => { if (t.cat == old) t.cat = n; });
      if (S.budgets[old] != null) { S.budgets[n] = S.budgets[old]; delete S.budgets[old]; }
      if (S.strict && S.strict[old]) { S.strict[n] = true; delete S.strict[old]; }
      S.cats[i] = n;
      save();
      flash = ['', 'Renamed everywhere.'];
      render();
    }, old);
  }

  function delCat(i: number) {
    const c = S.cats[i], n = S.tx.filter(t => t.cat == c).length;
    cfm(n ? `${n} transactions use "${c}". They will move to "Other"; nothing is deleted.` : `Delete category "${c}"?`, () => {
      S.tx.forEach(t => { if (t.cat == c) t.cat = 'Other'; });
      delete S.budgets[c];
      if (S.strict) delete S.strict[c];
      S.cats.splice(i, 1);
      save();
      flash = ['', 'Category deleted. Transactions kept.'];
      render();
    });
  }

  // Category Period & Trend Charts
  let cv = { p: 'month', c: '' };
  function periodRange(p: string, off: number): [string, string] {
    const d = new Date();
    if (p == 'week') {
      const day = (d.getDay() + 6) % 7;
      const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day - off * 7);
      const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
      return [iso(s), iso(e)];
    }
    const s = new Date(d.getFullYear(), d.getMonth() - off, 1);
    const e = new Date(d.getFullYear(), d.getMonth() - off + 1, 0);
    return [iso(s), iso(e)];
  }

  const inR = (r: [string, string], c: string) => sum(S.tx.filter(t => t.type == 'expense' && t.date >= r[0] && t.date <= r[1] && (!c || t.cat == c)));
  const byCat = (f: (t: any) => boolean) => {
    const b: Record<string, number> = {};
    S.tx.filter(f).forEach(t => b[t.cat] = (b[t.cat] || 0) + t.amount);
    return b;
  };

  const PAL = ['#2f6fed', '#12a594', '#e0536a', '#d99a0b', '#8b5cf6', '#ec4899', '#0ea5e9', '#84cc16', '#f97316', '#64748b', '#14b8a6'];
  function pie(map: Record<string, number>) {
    const e = Object.entries(map).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]), t = e.reduce((s, x) => s + x[1], 0);
    if (!t) return `<div class='note'>No data to chart yet.</div>`;
    let a = 0;
    const g = e.map((x, i) => {
      const s = a;
      a += x[1] / t * 100;
      return `${PAL[i % PAL.length]} ${s}% ${a}%`;
    }).join(',');
    return `<div class='pw'><div class='pie' style='background:conic-gradient(${g})' role='img' aria-label='Pie chart'></div><div>${e.map((x, i) => `<div class='lg'><i style='background:${PAL[i % PAL.length]}'></i>${esc(x[0])} <b>${R(x[1])}</b> (${Math.round(x[1] / t * 100)}%)</div>`).join('')}</div></div>`;
  }

  function catPeriod() {
    const w = cv.p == 'week', cur = periodRange(cv.p, 0), prev = periodRange(cv.p, 1);
    const by = byCat(t => t.type == 'expense' && t.date >= cur[0] && t.date <= cur[1]);
    const pv = byCat(t => t.type == 'expense' && t.date >= prev[0] && t.date <= prev[1]);
    const names = [...new Set([...Object.keys(by), ...Object.keys(pv)])].sort((a, b) => (by[b] || 0) - (by[a] || 0));
    const bars = [5, 4, 3, 2, 1, 0].map(o => {
      const r = periodRange(cv.p, o);
      return [w ? r[0].slice(5) : r[0].slice(2, 7), inR(r, cv.c)] as [string, number];
    });
    const mx = Math.max(1, ...bars.map(x => x[1]));
    return `<div class='c'><h3>Expenses by category</h3><div class='f'><button class='o ${w ? 'sel' : ''}' onclick="cv.p='week';render()">Weekly</button><button class='o ${!w ? 'sel' : ''}' onclick="cv.p='month';render()">Monthly</button></div><p class='note'>${w ? 'This week' : 'This month'}: ${cur[0]} to ${cur[1]}</p>${names.length ? `<div class='tw'><table><tr><th>Category</th><th>${w ? 'This week' : 'This month'}</th><th>${w ? 'Last week' : 'Last month'}</th><th>Change</th></tr>${names.map(n => {
      const a = by[n] || 0, b = pv[n] || 0;
      return `<tr><td>${esc(n)}</td><td>${R(a)}</td><td>${R(b)}</td><td>${b ? (a >= b ? '+' : '−') + Math.round(Math.abs(a - b) / b * 100) + '%' : 'new'}</td></tr>`;
    }).join('')}</table></div>` : `<div class='note'>No expenses in this period.</div>`}</div>
<div class='c'><h3>${w ? 'Weekly' : 'Monthly'} expense trend</h3><div class='f'><select onchange='cv.c=this.value;render()' aria-label='Category'><option value=''>All categories</option>${catOpts(cv.c)}</select></div><div class='cols'>${bars.map(x => `<div><span><b style='height:${(x[1] / mx * 100) || 0}%;background:var(--nv)' title='${R(x[1])}'></b></span>${x[0]}<br>${R(x[1])}</div>`).join('')}</div></div>
<div class='c'><h3>${w ? 'Weekly' : 'Monthly'} split by category</h3>${pie(by)}</div>`;
  }

  let tv = 'daily';
  const kf = (v: number) => v >= 100000 ? (v / 100000).toFixed(1).replace('.0', '') + 'L' : v >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'k' : String(Math.round(v));
  function smooth(p: Array<[number, number]>) {
    if (p.length < 2) return '';
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += ` C${b[0] + (c[0] - a[0]) / 6},${Math.min(260, b[1] + (c[1] - a[1]) / 6)} ${c[0] - (e[0] - b[0]) / 6},${Math.min(260, c[1] - (e[1] - b[1]) / 6)} ${c[0]},${c[1]}`;
    }
    return d;
  }

  function trendSeries() {
    const sR = (ty: string, a: string, b: string) => sum(S.tx.filter(t => t.type == ty && t.date >= a && t.date <= b));
    const B: any[] = [];
    if (tv == 'daily') {
      const n = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = iso(new Date(n.getFullYear(), n.getMonth(), n.getDate() - i));
        B.push({ a: d, b: d, l: fd(d).slice(0, 6) });
      }
    } else {
      for (let o = 11; o >= 0; o--) {
        const r = periodRange(tv == 'weekly' ? 'week' : 'month', o);
        B.push({ a: r[0], b: r[1], l: tv == 'weekly' ? fd(r[0]).slice(0, 6) : new Date(r[0] + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) });
      }
    }
    return B.map(x => Object.assign(x, { i: sR('income', x.a, x.b), e: sR('expense', x.a, x.b) }));
  }

  function trendChart(B: any[]) {
    const W = 640, H = 250, pl = 44, pr = 16, pt = 22, pb = 34, iw = W - pl - pr, ih = H - pt - pb;
    const mx = Math.max(1, ...B.flatMap(x => [x.i, x.e])) * 1.12, base = pt + ih;
    const X = (i: number) => pl + i * iw / (B.length - 1 || 1);
    const Y = (v: number) => Math.min(base, pt + ih - (v / mx * ih));
    const pi = B.map((x, i) => [X(i), Y(x.i)] as [number, number]);
    const pe = B.map((x, i) => [X(i), Y(x.e)] as [number, number]);
    const ar = (p: Array<[number, number]>) => smooth(p) + ` L${p[p.length - 1][0]},${base} L${p[0][0]},${base} Z`;
    const step = Math.ceil(B.length / 7);
    const pk = B.reduce((m, x, i) => x.e > B[m].e ? i : m, 0);
    const r = B.length > 14 ? 0 : 4.5;
    const dots = (p: Array<[number, number]>, c: string, k: string) => B.map((x, i) => `<circle cx='${p[i][0]}' cy='${p[i][1]}' r='${r}' fill='${c}' style='stroke:var(--card);stroke-width:2'/><circle cx='${p[i][0]}' cy='${p[i][1]}' r='9' fill='transparent'><title>${x.l}: ${k == 'i' ? 'Income' : 'Expenses'} ${R(x[k])}</title></circle>`).join('');
    return `<svg viewBox='0 0 ${W} ${H}' style='width:100%;height:auto' role='img' aria-label='Income and expense trend chart'><defs><linearGradient id='gi' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='#12a594' stop-opacity='.35'/><stop offset='100%' stop-color='#12a594' stop-opacity='0'/></linearGradient><linearGradient id='ge' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='#e0536a' stop-opacity='.35'/><stop offset='100%' stop-color='#e0536a' stop-opacity='0'/></linearGradient></defs>
${[0, 0.25, 0.5, 0.75, 1].map(f => `<line x1='${pl}' y1='${Y(mx * f)}' x2='${W - pr}' y2='${Y(mx * f)}' stroke='#9aa8c6' stroke-opacity='.3' stroke-dasharray='${f ? '4 4' : '0'}'/><text x='${pl - 6}' y='${Y(mx * f) + 4}' font-size='10' text-anchor='end' fill='#9aa8c6'>${kf(mx * f)}</text>`).join('')}
<path d='${ar(pi)}' fill='url(#gi)'/><path d='${ar(pe)}' fill='url(#ge)'/><path d='${smooth(pi)}' fill='none' stroke='#12a594' stroke-width='3' stroke-linecap='round'/><path d='${smooth(pe)}' fill='none' stroke='#e0536a' stroke-width='3' stroke-linecap='round'/>${dots(pi, '#12a594', 'i')}${dots(pe, '#e0536a', 'e')}
${B[pk].e > 0 ? `<text x='${Math.min(W - pr - 30, Math.max(pl + 30, pe[pk][0]))}' y='${pe[pk][1] - 9}' font-size='11' font-weight='700' text-anchor='middle' fill='#e0536a'>Peak ${kf(B[pk].e)}</text>` : ''}
${B.map((x, i) => i % step == 0 || i == B.length - 1 ? `<text x='${X(i)}' y='${H - 10}' font-size='10' text-anchor='middle' fill='#9aa8c6'>${x.l}</text>` : '').join('')}</svg><div class='note'><span style='color:#12a594'>●</span> Income <span style='color:#e0536a'>●</span> Expenses · hover or tap a point for the amount</div>`;
  }

  const fb = (l: string, v: number) => `<div class='fb'>${l}<b>${R(v)}</b></div>`;
  function catTrend() {
    const by = byCat(t => t.type == 'expense'), top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const B = S.tx.length ? trendSeries() : null;
    const ti = B ? sum(B.map(x => ({ amount: x.i }))) : 0;
    const te = B ? sum(B.map(x => ({ amount: x.e }))) : 0;
    return `<div class='c'><div class='row' style='margin-top:0;flex-wrap:wrap;align-items:center'><h3 style='margin:0'>Income and expense trend</h3><div class='f' style='margin:0;flex:0 0 auto'>${[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(x => `<button class='o ${tv == x[0] ? 'sel' : ''}' style='flex:0 0 auto' onclick="tv='${x[0]}';render()">${x[1]}</button>`).join('')}</div></div><p class='note'>${tv == 'daily' ? 'Last 30 days' : tv == 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}</p>${B ? `<div class='flow'>${fb('Total income', ti)}${fb('Total expenses', te)}${fb('Net saving', ti - te)}${fb('Average spend', te / B.length)}</div>` + trendChart(B) : `<div class='note'>Add transactions to see the trend.</div>`}</div>
<div class='c'><h3>Money flow</h3><div class='flow'>${fb('Income', inc())}<span class='fa'>→</span><div class='fc'>${fb('Spent', exp())}${fb('Emergency Fund', efBal())}${fb('Savings goals', gSaved())}${fb('Available', avail())}</div></div>${top.length ? `<div class='flow'>${fb('All expenses', exp())}<span class='fa'>→</span><div class='fc'>${top.map(x => fb(esc(x[0]), x[1])).join('')}</div></div>` : ''}</div>
<div class='c'><h3>Spending by category</h3>${pie(by)}</div>`;
  }

  // Savings
  function savings() {
    return `<h2>Savings goals</h2><p class="sub">Money in goals is set aside from your spendable balance. It is separate from the Emergency Fund.</p>${notice()}
<div class="g"><div class="c"><div class="k">Total in goals</div><div class="v">${R(gSaved())}</div></div><div class="c"><div class="k">Available to spend</div><div class="v">${R(avail())}</div></div></div>
<div class="c"><h3>New goal</h3><div class="f"><input id="gn" placeholder="Goal name" aria-label="Goal name"><input id="gt" type="number" min="1" placeholder="Target (₹)" aria-label="Target"><input id="gd" type="date" aria-label="Optional target date"></div><button onclick="addGoal()">Create goal</button></div>
${S.goals.length ? S.goals.map(g => {
      const p = g.target ? g.saved / g.target * 100 : 0;
      return `<div class="c"><h3>${esc(g.name)}</h3><div class="row"><span>${R(g.saved)} of ${R(g.target)}${g.date ? " · by " + g.date : ""}</span><span>${Math.round(p)}%</span></div><div class="bar"><i style="width:${Math.min(p, 100)}%"></i></div>
<div class="f" style="margin-top:10px"><input id="gc${g.id}" type="number" min="1" placeholder="Amount (₹)" aria-label="Contribution"><button onclick="goalAdd(${g.id})">Add money</button><button class="s" onclick="delGoal(${g.id})">Delete goal</button></div>
${g.hist && g.hist.length ? `<div class="note">History: ${g.hist.map(h => h.date + " " + R(h.amount)).join(" · ")}</div>` : ""}</div>`;
    }).join("") : `<div class="msg">No goals yet. Create one above.</div>`}`;
  }

  function addGoal() {
    const n = norm($("gn").value), t = parseFloat($("gt").value);
    if (!n || !(t > 0)) { flash = ["e", "Enter a goal name and a positive target."]; return render(); }
    S.goals.push({ id: Date.now(), name: n, target: t, date: $("gd").value, saved: 0, hist: [] });
    save();
    flash = ["", "Goal created."];
    render();
  }

  function goalAdd(id: number) {
    const g = S.goals.find(x => x.id == id);
    if (!g) return;
    const a = parseFloat($("gc" + id).value);
    if (!(a > 0)) { flash = ["e", "Enter a positive amount."]; return render(); }
    if (a > avail()) { flash = ["e", "You only have " + R(avail()) + " available."]; return render(); }
    g.saved += a;
    g.hist = g.hist || [];
    g.hist.push({ date: today(), amount: a });
    save();
    flash = ["", R(a) + " added to " + g.name + "."];
    render();
  }

  function delGoal(id: number) {
    const g = S.goals.find(x => x.id == id);
    if (!g) return;
    cfm(`Delete goal "${g.name}"? Its ${R(g.saved)} returns to your available balance. You can restore it for 30 days.`, () => {
      toTrash('goal', g);
      S.goals = S.goals.filter(x => x.id != id);
      save();
      flash = ['', 'Goal moved to Recently deleted.'];
      render();
    });
  }

  // CSV Import
  let imp: any = null;
  function parseCSV(t: string) {
    const rows: string[][] = [];
    let r: string[] = [], c = "", q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) {
        if (ch == '"' && t[i + 1] == '"') { c += '"'; i++; }
        else if (ch == '"') q = false;
        else c += ch;
      } else if (ch == '"') q = true;
      else if (ch == ",") { r.push(c); c = ""; }
      else if (ch == "\n" || ch == "\r") {
        if (ch == "\r" && t[i + 1] == "\n") i++;
        r.push(c); c = "";
        if (r.some(x => x.trim())) rows.push(r);
        r = [];
      } else c += ch;
    }
    r.push(c);
    if (r.some(x => x.trim())) rows.push(r);
    return rows;
  }

  function nd(s: string) {
    s = (s || "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
  }
  const num = (s: any) => parseFloat(String(s || "").replace(/[₹,\s]/g, ""));

  function onFile(f: File) {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { flash = ["e", "Please choose a .csv file."]; return render(); }
    const rd = new FileReader();
    rd.onload = () => {
      const rows = parseCSV(String(rd.result));
      if (rows.length < 2) { flash = ["e", "The file has no data rows."]; return render(); }
      const h = rows[0].map(x => x.trim().toLowerCase());
      const col = (...n: string[]) => h.findIndex(x => n.some(k => x.includes(k)));
      const di = col("date");
      const ds = col("desc", "narration", "particular", "details", "merchant");
      const ai = col("amount");
      const db = col("debit", "withdraw");
      const cr = col("credit", "deposit");
      const ti = col("type", "dr/cr");
      if (di < 0 || ds < 0 || (ai < 0 && db < 0 && cr < 0)) {
        flash = ["e", "Could not find columns. The file needs date, description and amount (or debit and credit) columns."];
        return render();
      }
      imp = rows.slice(1).map(r => {
        const date = nd(r[di] || "");
        let amount = 0, type: 'income' | 'expense' = "expense";
        if (ai >= 0) {
          const v = num(r[ai]);
          amount = Math.abs(v);
          type = v < 0 ? "expense" : "income";
          if (ti >= 0) {
            const t = (r[ti] || "").toLowerCase();
            if (/cr|credit|income/.test(t)) type = "income";
            else if (/dr|debit|expense/.test(t)) type = "expense";
          }
        } else {
          const d = num(r[db]) || 0, c = num(r[cr]) || 0;
          if (c > 0) { amount = c; type = "income"; }
          else amount = d;
        }
        const desc = (r[ds] || "").trim();
        const ok = !!date && amount > 0 && !!desc;
        const isDup = ok && S.tx.some(t => t.date == date && t.amount == amount && t.type == type && t.desc.toLowerCase() == desc.toLowerCase());
        return { date, desc, amount, type, cat: type == "income" ? "Pocket Money" : suggest(desc), ok, isDup, use: ok && !isDup };
      });
      render();
    };
    rd.readAsText(f);
  }

  function importPage() {
    return `<h2>Import CSV</h2><p class="sub">Upload a statement you downloaded yourself. Nothing is saved until you confirm.</p>${notice()}
<div class="c"><input type="file" accept=".csv" onchange="onFile(this.files[0])" aria-label="CSV file"><p class="note">Needs date, description and amount columns (or separate debit and credit columns). With a single amount column and no type column, negative amounts are read as expenses and positive as income. StudentSpend never asks for bank passwords, UPI PINs or OTPs, and has no live bank link.</p></div>
${imp ? `<div class="c"><h3>Preview: ${imp.length} rows</h3><div class="tw"><table><tr><th>Use</th><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th><th>Status</th></tr>
${imp.map((x: any, i: number) => `<tr><td><input type="checkbox" ${x.use ? "checked" : ""} ${x.ok ? "" : "disabled"} onchange="imp[${i}].use=this.checked" aria-label="Import row ${i + 1}"></td><td>${x.date || "?"}</td><td><input value="${esc(x.desc)}" onchange="imp[${i}].desc=this.value"></td><td><select onchange="imp[${i}].cat=this.value">${catOpts(x.cat)}</select></td><td>${x.type}</td><td>${x.amount ? R(x.amount) : "?"}</td><td>${!x.ok ? "Invalid row" : x.isDup ? "Possible duplicate" : "New"}</td></tr>`).join("")}</table></div>
<p><button onclick="commitImp()">Import selected rows</button> <button class="o" onclick="imp=null;render()">Cancel</button></p></div>` : ""}
<div class="c"><h3>Import history</h3>${S.imports && S.imports.length ? `<div class="tw"><table>${[...S.imports].reverse().map(h => `<tr><td>${esc(h.date)}</td><td>${h.n} imported</td><td>${h.skipped} skipped</td></tr>`).join("")}</table></div>` : `<div class="note">No imports yet.</div>`}</div>`;
  }

  function commitImp() {
    const rows = (imp || []).filter((x: any) => x.use && x.ok && x.desc.trim());
    if (!rows.length) { flash = ["e", "Select at least one valid row."]; return render(); }
    rows.forEach((x: any, i: number) => S.tx.push({ id: Date.now() + i, type: x.type, desc: x.desc.trim(), amount: x.amount, cat: x.cat, date: x.date, src: "csv" }));
    S.imports = S.imports || [];
    S.imports.push({ date: new Date().toLocaleString(), n: rows.length, skipped: imp.length - rows.length });
    const n = rows.length;
    imp = null;
    save();
    flash = ["", `Imported ${n} transactions.`];
    render();
  }

  // Insights & AI
  let ans = "";
  const QS: Array<[string, () => string]> = [
    ["How much can I spend?", () => `You have ${R(avail())} available to spend. ${R(efBal())} is protected in the Emergency Fund and ${R(gSaved())} is set aside in savings goals.`],
    ["Where did most of my money go this month?", () => {
      const b: Record<string, number> = {};
      S.tx.filter(t => t.type == "expense" && mo(t.date) == curMo()).forEach(t => b[t.cat] = (b[t.cat] || 0) + t.amount);
      const e = Object.entries(b).sort((a, c) => c[1] - a[1]);
      return e.length ? `${e[0][0]} is your biggest category at ${R(e[0][1])}.${e.length > 1 ? " Next: " + e.slice(1, 3).map(x => x[0] + " " + R(x[1])).join(", ") + "." : ""}` : "No expenses recorded this month yet.";
    }],
    ["Am I close to my budget?", () => {
      if (!S.overall) return "You have not set a monthly budget yet. Set one on the Budgets page.";
      const s = spent(null, curMo()), p = s / S.overall * 100;
      return `You have spent ${R(s)} of ${R(S.overall)} (${Math.round(p)}%): ${lvl(p)}. Remaining: ${R(Math.max(0, S.overall - s))}.`;
    }],
    ["How does this month compare with last month?", () => {
      const a = spent(null, curMo()), b = spent(null, pmo());
      if (!b) return "No spending was recorded last month, so there is nothing to compare with.";
      const d = a - b;
      return `This month ${R(a)}, last month ${R(b)}: ${d >= 0 ? "up" : "down"} ${R(Math.abs(d))} (${Math.round(Math.abs(d) / (b || 1) * 100)}%).`;
    }],
    ["How much have I saved?", () => `Emergency Fund: ${R(efBal())}. Savings goals: ${R(gSaved())}. Total set aside: ${R(efBal() + gSaved())}.`],
    ["How can I spread my remaining money?", () => {
      const left = S.overall ? S.overall - spent(null, curMo()) : avail();
      const dt = new Date();
      const days = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate() - dt.getDate() + 1;
      return left > 0 ? `You have ${R(left)} left ${S.overall ? "in this month's budget" : "to spend"} and ${days} days left in the month, about ${R(left / days)} per day.` : "You have no spendable amount left under your current limit.";
    }]
  ];

  function ask(i: number) { ans = QS[i][1](); render(); }

  function ctx() {
    const m = curMo(), b: Record<string, number> = {};
    S.tx.filter(t => t.type == "expense" && mo(t.date) == m).forEach(t => b[t.cat] = (b[t.cat] || 0) + t.amount);
    return JSON.stringify({
      currency: "INR",
      month: m,
      available: avail(),
      totalIncome: inc(),
      totalExpenses: exp(),
      emergencyFund: efBal(),
      goalsSaved: gSaved(),
      monthlyBudget: S.overall || null,
      thisMonthSpendByCategory: b,
      lastMonthSpend: spent(null, pmo()),
      categoryBudgets: S.budgets,
      goals: S.goals.map(g => ({ name: g.name, target: g.target, saved: g.saved })),
      recentTransactions: [...S.tx].sort((a, c) => c.date.localeCompare(a.date)).slice(0, 30).map(t => ({ date: t.date, type: t.type, desc: t.desc, category: t.cat, amount: t.amount }))
    });
  }

  async function askAI() {
    const q = ($("aq") || {}).value?.trim() || "";
    const o = $("ao");
    const ab = $("ab");
    if (!q || !o) return;
    o.style.display = "block";
    o.textContent = "Thinking…";
    if (ab) ab.disabled = true;

    // Direct contextual answer generator based on data
    const generateSmartAdvice = (question: string) => {
      const lq = question.toLowerCase();
      const m = curMo();
      const b: Record<string, number> = {};
      S.tx.filter(t => t.type == "expense" && mo(t.date) == m).forEach(t => b[t.cat] = (b[t.cat] || 0) + t.amount);
      const top = Object.entries(b).sort((x, y) => y[1] - x[1]);
      const av = avail();
      const ef = efBal();

      if (lq.includes("food") || lq.includes("mess") || lq.includes("canteen")) {
        const fSpend = b["Food"] || 0;
        return `You've spent ${R(fSpend)} on food this month. To cut down, try limiting food delivery orders (Zomato/Swiggy) to once a week and using the campus canteen or hostel mess. Packing simple snacks like fruit or biscuits can save ₹50–₹100 daily.`;
      }
      if (lq.includes("cut") || lq.includes("reduce") || lq.includes("save money")) {
        const topCat = top[0] ? `${top[0][0]} (${R(top[0][1])})` : "discretionary spending";
        return `Your biggest spending area this month is ${topCat}. Focus on cutting non-essential purchases there first. Set a category budget on the Budgets page with a strict limit to prevent overspending.`;
      }
      if (lq.includes("emergency") || lq.includes("safe")) {
        return `Your Emergency Fund currently has ${R(ef)}. Aim to build at least 1–2 months of living expenses (around ₹3,000–₹5,000) for real medical or travel emergencies. Only withdraw for genuine emergencies.`;
      }
      if (lq.includes("budget") || lq.includes("limit")) {
        if (!S.overall) return `You haven't set an overall monthly budget yet. Set one on the Budgets page to track your remaining limit and daily allowance.`;
        const s = spent(null, m);
        return `You've spent ${R(s)} of your ${R(S.overall)} monthly budget. You have ${R(Math.max(0, S.overall - s))} left for the rest of the month.`;
      }
      return `Based on your records, your available balance is ${R(av)}, with ${R(inc())} received and ${R(exp())} spent so far. Prioritize essentials like education and hostel, and set aside a small fixed amount into savings goals right after receiving pocket money.`;
    };

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: JSON.parse(ctx()) }),
      });
      const json = await res.json();
      if (json && json.ok && json.text) {
        o.textContent = json.text;
        if (ab) ab.disabled = false;
        return;
      }
      // Instant intelligent fallback grounded in student data
      o.textContent = generateSmartAdvice(q);
      if (ab) ab.disabled = false;
    } catch (e: any) {
      o.textContent = generateSmartAdvice(q);
      if (ab) ab.disabled = false;
    }
  }

  function insights() {
    return `<h2>Insights</h2><p class="sub">Quick answers are calculated on your device. For anything else, ask the AI assistant below.</p>${notice()}
<div class="c"><div class="f">${QS.map((q, i) => `<button class="o" onclick="ask(${i})">${q[0]}</button>`).join("")}</div>${ans ? `<div class="msg" role="status">${esc(ans)}</div>` : `<div class="note">Pick a question.</div>`}</div>
<div class="c ai"><h3>Ask the AI assistant</h3><p class="note">When you press Ask, a summary of your records (totals, categories, budgets, recent transactions) is sent to the assistant. It can explain and suggest, but it cannot change your records.</p>
<div class="f"><input id="aq" placeholder="e.g. How can I cut my food spending?" aria-label="Question for AI" onkeydown="if(event.key=='Enter')askAI()"><button id="ab" onclick="askAI()">Ask AI</button></div><div id="ao" class="msg" role="status" style="display:none;white-space:pre-wrap"></div></div>`;
  }

  // Statement & Export
  let st = { f: '', t: '', k: 'all' };
  function stRows() {
    const f = st.f || '0000-00-00', t = st.t || '9999-99-99';
    return [...S.tx].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).filter(x => x.date >= f && x.date <= t);
  }
  const sg = (x: any) => x.type == 'income' ? x.amount : -x.amount;

  function setRange(k: string) {
    const d = new Date();
    if (k == 'month') {
      st.f = iso(new Date(d.getFullYear(), d.getMonth(), 1));
      st.t = iso(d);
    } else if (k == 'last') {
      st.f = iso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
      st.t = iso(new Date(d.getFullYear(), d.getMonth(), 0));
    } else {
      st.f = '';
      st.t = '';
    }
    render();
  }

  function statement() {
    const f = st.f || '0000-00-00', all = stRows();
    const open = S.tx.filter(x => x.date < f).reduce((b, x) => b + sg(x), 0);
    const dr = sum(all.filter(x => x.type == 'expense'));
    const cr = sum(all.filter(x => x.type == 'income'));
    const k = st.k || 'all';
    let bal = open;
    const rows = all.map(x => { bal += sg(x); return Object.assign({}, x, { bal }); }).filter(x => k == 'all' || (k == 'credit' ? x.type == 'income' : x.type == 'expense'));
    const dts = S.tx.map(x => x.date).sort();
    const from = st.f || dts[0] || '';
    const to = st.t || dts[dts.length - 1] || '';
    return `<h2>Statement</h2><p class='sub'>Period: <b>${from ? fd(from) + ' to ' + fd(to) : 'no transactions yet'}</b>. Emergency Fund and goal transfers are not included.</p>${notice()}
<div class='c'><div class='f'><label class='note'>From <input type='date' value='${from}' onchange='st.f=this.value;render()'></label><label class='note'>To <input type='date' value='${to}' onchange='st.t=this.value;render()'></label></div>
<div class='f'><button class='o' onclick="setRange('month')">This month</button><button class='o' onclick="setRange('last')">Last month</button><button class='o' onclick="setRange('all')">All time</button></div>
<div class='f'>${[['all', 'All'], ['credit', 'Credit'], ['debit', 'Debit']].map(x => `<button class='o ${k == x[0] ? 'sel' : ''}' onclick="st.k='${x[0]}';render()">${x[1]}</button>`).join('')}<button onclick='dlSt()'>Download statement (Excel)</button></div></div>
<div class='g'><div class='c'><div class='k'>Opening balance</div><div class='v'>${R(open)}</div></div><div class='c'><div class='k'>Credits</div><div class='v pos'>${R(cr)}</div></div><div class='c'><div class='k'>Debits</div><div class='v neg'>${R(dr)}</div></div><div class='c'><div class='k'>Closing balance</div><div class='v'>${R(open + cr - dr)}</div></div></div>
<div class='c'>${rows.length ? `<div class='tw'><table><tr><th>Date</th><th>Description</th><th>Category</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>${rows.map(x => `<tr><td>${fd(x.date)}</td><td>${esc(x.desc)}</td><td>${esc(x.cat)}</td><td>${x.type == 'expense' ? R(x.amount) : ''}</td><td>${x.type == 'income' ? R(x.amount) : ''}</td><td>${R(x.bal)}</td></tr>`).join('')}</table></div>` : `<div class='note'>No ${k == 'all' ? '' : k + ' '}transactions in this period.</div>`}</div>`;
  }

  function localSave(name: string, data: any, type: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function saveOut(name: string, data: any, type: string) {
    const win = window as any;
    const d = win.claude ? await win.claude.use('downloads') : null;
    if (d) { await d.save({ filename: name, data }); return; }
    localSave(name, data, type);
  }

  const q2 = (s: any) => '"' + String(s || '').replace(/"/g, '""') + '"';
  async function dl(name: string, text: string) {
    try {
      await saveOut(name, '\ufeff' + text, 'text/csv');
      flash = ['', 'Saved ' + name + '.'];
    } catch (e: any) {
      flash = ['e', e && e.code == 'declined' ? 'Download cancelled.' : 'The file was not saved.'];
    }
    render();
  }

  function exp2() {
    dl('studentspend-transactions.csv', [['date', 'type', 'description', 'category', 'amount_inr'], ...S.tx.map(t => [t.date, t.type, q2(t.desc), q2(t.cat), t.amount])].map(r => r.join(',')).join('\n'));
  }

  async function dlSt() {
    const f = st.f || '0000-00-00';
    let bal = S.tx.filter(x => x.date < f).reduce((b, x) => b + sg(x), 0);
    const open = bal, rows = stRows();
    const aoa: any[][] = [['Date', 'Description', 'Category', 'Debit (INR)', 'Credit (INR)', 'Balance (INR)'], ['', 'Opening balance', '', '', '', open]];
    rows.forEach(x => {
      bal += sg(x);
      const [y, m, d] = x.date.split('-').map(Number);
      aoa.push([new Date(Date.UTC(y, m - 1, d, 12)), x.desc, x.cat, x.type == 'expense' ? x.amount : '', x.type == 'income' ? x.amount : '', bal]);
    });
    let done = false;
    const win = window as any;
    if (win.XLSX) {
      try {
        const XLSX = win.XLSX;
        const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
        for (let i = 2; i < aoa.length; i++) {
          const c = ws['A' + (i + 1)];
          if (c) c.z = 'dd mmm yyyy';
        }
        for (let i = 1; i < aoa.length; i++) {
          ['D', 'E', 'F'].forEach(L => {
            const c = ws[L + (i + 1)];
            if (c && c.t == 'n') c.z = '#,##0.00';
          });
        }
        ws['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Statement');
        await saveOut('studentspend-statement.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        done = true;
        flash = ['', 'Statement saved as an Excel file with proper dates.'];
      } catch (e: any) {
        if (e && e.code == 'declined') { flash = ['', 'Download cancelled.']; return render(); }
      }
    }
    if (!done) {
      let b = open;
      const out = [['Date', 'Description', 'Category', 'Debit (INR)', 'Credit (INR)', 'Balance (INR)'].join(','), ['', 'Opening balance', '', '', '', open].join(',')];
      rows.forEach(x => {
        b += sg(x);
        out.push(['="' + fd(x.date) + '"', q2(x.desc), q2(x.cat), x.type == 'expense' ? x.amount : '', x.type == 'income' ? x.amount : '', b].join(','));
      });
      try {
        await saveOut('studentspend-statement.csv', '\ufeff' + out.join('\n'), 'text/csv');
        flash = ['', 'Statement saved as CSV.'];
      } catch (e: any) {
        flash = ['e', e && e.code == 'declined' ? 'Download cancelled.' : 'The file was not saved.'];
      }
    }
    render();
  }

  // Trash
  function trashPage() {
    const T = S.trash || [];
    return `<h2>Recently deleted</h2><p class='sub'>Deleted items stay here for 30 days, then are removed for good.</p>${notice()}<div class='c'>${T.length ? `<div class='tw'><table><tr><th>Item</th><th>Details</th><th>Days left</th><th></th></tr>${T.map((x, k) => `<tr><td>${x.kind == 'tx' ? 'Transaction' : x.kind == 'goal' ? 'Savings goal' : 'All data'}</td><td>${x.kind == 'tx' ? esc(x.item.desc) + ' · ' + R(x.item.amount) : x.kind == 'goal' ? esc(x.item.name) + ' · ' + R(x.item.saved) : 'Full backup'}</td><td>${Math.max(0, Math.ceil(30 - (Date.now() - x.at) / 864e5))}</td><td><button onclick='restore(${k})'>Restore</button> <button class='s' onclick='purge(${k})'>Delete forever</button></td></tr>`).join('')}</table></div>` : `<div class='note'>Nothing here.</div>`}</div>`;
  }

  function restore(k: number) {
    const x = S.trash[k];
    if (!x) return;
    if (x.kind == 'all') {
      const tr = S.trash.filter((_, i) => i != k);
      S = Object.assign({}, x.item, { trash: tr });
      save();
      flash = ['', 'All data restored.'];
      return render();
    }
    if (x.kind == 'tx') {
      if (!S.tx.some(t => t.id == x.item.id)) S.tx.push(x.item);
      if (!allCats().includes(x.item.cat)) S.cats.push(x.item.cat);
    } else if (!S.goals.some(g => g.id == x.item.id)) {
      S.goals.push(x.item);
    }
    S.trash.splice(k, 1);
    save();
    flash = ['', 'Restored.'];
    render();
  }

  function purge(k: number) {
    cfm('Delete this item forever? This cannot be undone.', () => {
      S.trash.splice(k, 1);
      save();
      render();
    });
  }

  function delAll() {
    cfm('Delete ALL your data? It moves to Recently deleted and can be restored for 30 days.', () => {
      const snap = Object.assign({}, S, { trash: [] });
      const keep = { theme: S.theme, lang: S.lang, custom: S.custom, profile: S.profile };
      const tr = (S.trash || []).concat([{ kind: 'all', item: JSON.parse(JSON.stringify(snap)), at: Date.now() }]);
      S = Object.assign({ tx: [], cats: [], budgets: {}, overall: 0, hard: false, ef: [], efTarget: 0, goals: [], imports: [], trash: tr, parents: S.parents || [] }, keep);
      save();
      flash = ['', 'All data moved to Recently deleted.'];
      render();
    });
  }

  // Share
  const LINK = window.location.href.split('#')[0];
  let sh = { who: '' };
  const curName = () => {
    const p = (S.parents || []).find(x => x.id == Number(sh.who));
    return p ? p.name : '';
  };
  function shareMsg(n?: string) {
    return `Hi${n ? ' ' + n : ''}, here is my StudentSpend money tracker where you can view my spending and savings: ${LINK}`;
  }

  function copyText(t: string, el: string) {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { }
    ta.remove();
    const bad = 'Copy was blocked here. Select the text above and copy it yourself.';
    if (!ok && navigator.clipboard) {
      navigator.clipboard.writeText(t).then(() => { if ($(el)) $(el).textContent = 'Copied.'; }, () => { if ($(el)) $(el).textContent = bad; });
      return;
    }
    if ($(el)) $(el).textContent = ok ? 'Copied.' : bad;
  }

  function copyLink() { copyText(LINK, 'cm'); }
  function copyMsg() { copyText(shareMsg(curName()), 'cm'); }
  async function nativeShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My StudentSpend tracker', text: shareMsg(curName()) });
        return;
      }
    } catch (e: any) {
      if (e && e.name == 'AbortError') return;
    }
    copyMsg();
  }

  function openOut(u: string) {
    try {
      const w = window.open(u, '_blank');
      if (!w) {
        copyMsg();
        setTimeout(() => {
          const c = $('cm');
          if (c) c.textContent = 'Your browser blocked opening the app, so the message was copied. Paste it yourself.';
        }, 50);
      }
    } catch (e) {
      copyMsg();
    }
  }

  function sendMail() {
    const email = ($('se') || {}).value?.trim() || '';
    openOut('mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('My StudentSpend tracker') + '&body=' + encodeURIComponent(shareMsg(curName())));
  }

  function sendWa() {
    const ph = (($('sp') || {}).value || '').replace(/\D/g, '');
    openOut('https://wa.me/' + ph + '?text=' + encodeURIComponent(shareMsg(curName())));
  }

  function addParent() {
    const n = ($('an') || {}).value?.trim() || '';
    const e = ($('ae') || {}).value?.trim() || '';
    const ph = (($('ap') || {}).value || '').replace(/\D/g, '');
    if (!n || (!e && !ph)) {
      flash = ['e', 'Enter the parent’s name and an email or phone number.'];
      return render();
    }
    if (e && !/^\S+@\S+\.\S+$/.test(e)) {
      flash = ['e', 'Enter a valid email address.'];
      return render();
    }
    S.parents = S.parents || [];
    if (e && S.parents.some(x => (x.email || '').toLowerCase() == e.toLowerCase())) {
      flash = ['e', 'That email is already added.'];
      return render();
    }
    S.parents.push({ id: Date.now(), name: n, email: e, phone: ph });
    save();
    flash = ['', n + ' added. Send them the link below so they can view your tracker.'];
    render();
  }

  function delParent(id: number) {
    const p = (S.parents || []).find(x => x.id == id);
    if (!p) return;
    cfm(`Remove ${p.name} from this list?`, () => {
      S.parents = S.parents.filter(x => x.id != id);
      save();
      render();
    });
  }

  function syncNow() {
    pushDb();
    if ($('cm2')) $('cm2').textContent = dbDoc ? 'Sync requested.' : 'Data is saved locally in this browser.';
  }

  function sharePage() {
    const P = S.parents || [], cur = P.find(p => p.id == Number(sh.who));
    return `<h2>Share</h2><p class='sub'>Share your tracker with anyone, including your parents. People you share with can view it in read-only mode.</p>${notice()}
<div class='c'><h3>Share with</h3><select onchange='sh.who=this.value;render()' aria-label='Share with'><option value=''>Anyone</option>${P.map(p => `<option value='${p.id}' ${p.id == Number(sh.who) ? 'selected' : ''}>${esc(p.name)} (parent)</option>`).join('')}</select>
<div class='f' style='margin-top:10px'><input id='se' type='email' value="${esc(cur ? cur.email || '' : '')}" placeholder='Email (optional)' aria-label='Email'><input id='sp' value="${esc(cur ? cur.phone || '' : '')}" placeholder='Phone with country code (optional)' aria-label='Phone'></div>
<div class='f'><button onclick='sendMail()'>Email</button><button class='o' onclick='sendWa()'>WhatsApp</button><button class='o' onclick='copyMsg()'>Copy message</button><button class='o' onclick='nativeShare()'>Share…</button></div><span id='cm' class='note'></span></div>
<div class='c'><h3>Link</h3><input id='lk' readonly value="${LINK}" aria-label='Page link' style='width:100%' onfocus='this.select()'><div class='f' style='margin-top:10px'><button onclick='copyLink()'>Copy link</button></div></div>
<div class='c'><h3>Saved parents</h3><p class='note'>Save a parent once so they appear in the Share with list.</p><div class='f'><input id='an' placeholder='Parent name' aria-label='Parent name'><input id='ae' type='email' placeholder='Email' aria-label='Parent email'><input id='ap' placeholder='Phone with country code' aria-label='Parent phone'></div><button onclick='addParent()'>Save parent</button>${P.map(p => `<div class='row'><span><b>${esc(p.name)}</b> <span class='note'>${esc(p.email || '')} ${p.phone ? '· +' + esc(p.phone) : ''}</span></span><button class='s' onclick='delParent(${p.id})'>Remove</button></div>`).join('')}</div>
<div class='c'><h3>Sync</h3><p class='note'>${dbDoc ? '✅ Sync is on. Your data updates for viewers each time you save.' : 'Data is safely preserved in this browser on this device.'}</p><button class='o' onclick='syncNow()'>Sync now</button> <span id='cm2' class='note'></span></div>`;
  }

  // Settings & Theme
  const TH: Record<string, Record<string, string>> = {
    light: { bg: "#f6f8fc", card: "#ffffff", tx: "#1c2a44", mu: "#667491", nv: "#2f6fed", ac: "#12a594", bd: "#e3e9f4", ef: "#eaf1ff", side: "#ffffff", h1: "#3b82f6", h2: "#14b8a6", wa: "#d99a0b", er: "#e0536a" },
    dark: { bg: "#0b1424", card: "#12203a", tx: "#e8eefb", mu: "#9aa8c6", nv: "#6c97f0", ac: "#2fd0a0", bd: "#24345a", ef: "#1a2c52", side: "#0f1c33", h1: "#1b4b8f", h2: "#14a98a", wa: "#e8b23a", er: "#ef6c82" }
  };
  const CU0 = { nv: "#7c3aed", ac: "#ec4899", bg: "#fdf6ff" };

  function applyTheme() {
    const t = S.theme || "light", cu = Object.assign({}, CU0, S.custom);
    const p = t == "custom" ? Object.assign({}, TH.light, { nv: cu.nv, ac: cu.ac, bg: cu.bg, h1: cu.nv, h2: cu.ac, ef: `color-mix(in srgb,${cu.nv} 12%,#fff)` }) : (TH[t] || TH.light);
    const r = document.documentElement;
    r.dataset.theme = t == "dark" ? "dark" : "light";
    r.style.colorScheme = t == "dark" ? "dark" : "light";
    for (const k in p) r.style.setProperty("--" + k, p[k]);
  }

  function setTheme(t: string) { S.theme = t; save(); render(); }
  function setCu(k: string, v: string) {
    S.custom = Object.assign({}, CU0, S.custom, { [k]: v });
    save();
    applyTheme();
  }

  const HI: Record<string, string> = {
    "Dashboard": "डैशबोर्ड", "Transactions": "लेन-देन", "Budgets": "बजट", "Savings": "बचत", "Emergency Fund": "आपातकालीन फंड",
    "Import CSV": "CSV आयात", "Insights & AI": "इनसाइट्स और AI", "Insights": "इनसाइट्स", "Categories": "श्रेणियाँ", "Settings": "सेटिंग्स",
    "Export & Data": "निर्यात और डेटा", "Available to spend": "खर्च के लिए उपलब्ध", "Money you can use right now": "अभी इस्तेमाल कर सकने वाला पैसा",
    "Total received": "कुल प्राप्त", "Total spent": "कुल खर्च", "Emergency Fund (protected)": "आपातकालीन फंड (सुरक्षित)", "Monthly budget": "मासिक बजट",
    "Recent transactions": "हाल के लेन-देन", "Income vs expenses by month": "मासिक आय बनाम खर्च", "Add transaction": "लेन-देन जोड़ें",
    "Save transaction": "लेन-देन सहेजें", "Monthly limit": "मासिक सीमा", "Save limit": "सीमा सहेजें", "Category budgets": "श्रेणी बजट",
    "Set budget": "बजट सेट करें", "Strict limit": "कड़ी सीमा", "Savings goals": "बचत लक्ष्य", "New goal": "नया लक्ष्य", "Create goal": "लक्ष्य बनाएँ",
    "Add money": "पैसे जोड़ें", "Delete goal": "लक्ष्य हटाएँ", "Delete": "हटाएँ", "Remove": "हटाएँ", "Cancel": "रद्द करें",
    "Reserve money": "पैसे सुरक्षित करें", "Add to Emergency Fund": "आपातकालीन फंड में जोड़ें", "Withdraw for Emergency": "आपात निकासी",
    "History": "इतिहास", "Add category": "श्रेणी जोड़ें", "Rename": "नाम बदलें", "Import selected rows": "चुनी पंक्तियाँ आयात करें",
    "Import history": "आयात इतिहास", "Ask AI": "AI से पूछें", "Ask the AI assistant": "AI सहायक से पूछें", "Theme": "थीम", "Language": "भाषा",
    "Light": "लाइट", "Dark": "डार्क", "Custom": "कस्टम", "Export": "निर्यात", "Description": "विवरण", "Amount (₹)": "राशि (₹)",
    "Search description": "विवरण खोजें", "Date": "तारीख", "Category": "श्रेणी", "Amount": "राशि",
    "Everything below is calculated from your saved entries.": "नीचे सब कुछ आपकी सहेजी प्रविष्टियों से गणना किया गया है।",
    "Make StudentSpend look and read the way you like.": "StudentSpend को अपनी पसंद के अनुसार बदलें।",
    "Share": "शेयर", "Sign out": "साइन आउट", "Share with": "इनके साथ शेयर करें", "Saved parents": "सहेजे गए अभिभावक",
    "Save parent": "अभिभावक सहेजें", "Link": "लिंक", "Copy link": "लिंक कॉपी करें", "Copy message": "संदेश कॉपी करें",
    "Email": "ईमेल", "WhatsApp": "व्हाट्सएप", "Sync": "सिंक", "Sync now": "अभी सिंक करें", "Account": "खाता",
    "Opening balance": "शुरुआती शेष", "Closing balance": "अंतिम शेष", "Credits": "कुल जमा", "Debits": "कुल डेबिट",
    "All": "सभी", "Credit": "जमा", "Debit": "डेबिट", "Balance": "शेष", "Download statement (Excel)": "स्टेटमेंट डाउनलोड करें (Excel)",
    "This month": "इस महीने", "Last month": "पिछला महीना", "All time": "सभी समय", "Daily": "दैनिक", "Weekly": "साप्ताहिक",
    "Monthly": "मासिक", "Expenses by category": "श्रेणी के अनुसार खर्च", "Spending by category": "श्रेणी के अनुसार खर्च",
    "Money flow": "पैसे का प्रवाह", "Income and expense trend": "आय और खर्च का रुझान", "Total income": "कुल आय",
    "Total expenses": "कुल खर्च", "Net saving": "शुद्ध बचत", "Average spend": "औसत खर्च", "Alerts & reminders": "अलर्ट और रिमाइंडर",
    "Item": "वस्तु", "Details": "विवरण", "Days left": "बचे दिन", "Delete forever": "हमेशा के लिए हटाएँ", "Confirm": "पुष्टि करें",
    "Close": "बंद करें", "Edit profile": "प्रोफ़ाइल संपादित करें", "Your categories": "आपकी श्रेणियाँ", "Income": "आय", "Spent": "खर्च",
    "Available": "उपलब्ध", "Last 30 days": "पिछले 30 दिन", "Last 12 weeks": "पिछले 12 सप्ताह", "Last 12 months": "पिछले 12 महीने"
  };

  function translate() {
    const L = S.lang || "en", D = L == "hi" ? HI : null;
    document.documentElement.lang = L == "hi" ? "hi" : "en";
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: any;
    while (n = w.nextNode()) {
      if (!n.parentNode || /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(n.parentNode.tagName)) continue;
      if (n._o === undefined) n._o = n.nodeValue;
      const o = n._o, pre = (o.match(/^[^A-Za-z]*/) || [''])[0], core = o.slice(pre.length).trim();
      n.nodeValue = D && D[core] ? pre + D[core] + (/\s$/.test(o) ? " " : "") : o;
    }
    document.querySelectorAll("[placeholder]").forEach((e: any) => {
      if (e._p === undefined) e._p = e.placeholder;
      e.placeholder = D && D[e._p] || e._p;
    });
  }

  function saveProfile() {
    S.profile = {
      name: ($('pn') || {}).value?.trim() || '',
      college: ($('pc') || {}).value?.trim() || '',
      email: ($('pe') || {}).value?.trim() || '',
      parent: ($('pp') || {}).value?.trim() || '',
      parentEmail: ($('ppe') || {}).value?.trim() || ''
    };
    save();
    flash = ['', 'Profile saved.'];
    render();
  }

  function newCode() {
    cfm('Create a new recovery code? Your old code will stop working.', async () => {
      const us = users(), u = us.find(x => x.id == USER.id);
      if (!u) return;
      const code = await setCode(u);
      saveUsers(us);
      USER = u;
      showCode(code, () => {
        flash = ['', 'New recovery code saved.'];
        render();
      });
    });
  }

  function accountCard() {
    const u = USER;
    return u ? `<div class='c'><h3>Account</h3><p class='note'>Signed in as <b>${esc(u.name)}</b> (${esc(u.idv)}). Accounts on this device: ${users().length}.</p><p class='note'>Recovery code: ${u.rh ? 'created. It is needed if you forget your password.' : 'not created yet. Create one so you can reset a forgotten password.'}</p><div class='f'><button class='o' onclick='newCode()'>${u.rh ? 'Create a new recovery code' : 'Create recovery code'}</button><button class='o' onclick='signOut()'>Sign out</button></div></div>` : '';
  }

  let deployGuideOpen = false;
  function toggleDeployGuide() {
    deployGuideOpen = !deployGuideOpen;
    const el = $('deployGuide');
    if (el) el.style.display = deployGuideOpen ? 'block' : 'none';
  }

  async function checkDbStatus() {
    const el = $('dbNote');
    if (el) el.innerHTML = '<span class="note">Checking MongoDB connection...</span>';
    try {
      const res = await fetch('/api/status');
      const json = await res.json();
      if (json && json.ok && json.database) {
        const dbInfo = json.database;
        if (dbInfo.connected) {
          if (el) {
            el.innerHTML = `<div style="background: rgba(14, 159, 120, 0.12); border-left: 4px solid var(--ac); padding: 10px 14px; border-radius: 6px; margin: 8px 0;">
              <b style="color: var(--ac)">🟢 Connected to MongoDB</b><br>
              <span class="note">Database: <code>${esc(dbInfo.database)}</code> &bull; Cluster: ${esc(dbInfo.clusterType || 'MongoDB Atlas')} &bull; Auto-sync active</span>
            </div>`;
          }
        } else if (dbInfo.isConfigured) {
          if (el) {
            el.innerHTML = `<div style="background: rgba(201, 138, 6, 0.12); border-left: 4px solid var(--wa); padding: 10px 14px; border-radius: 6px; margin: 8px 0;">
              <b style="color: var(--wa)">🟡 MONGODB_URI configured, but not connected</b><br>
              <span class="note">${esc(dbInfo.error || 'Attempting to establish connection to cluster...')}</span>
              <p class="note" style="margin: 6px 0 0"><b>Tip for Render:</b> In MongoDB Atlas &rarr; <i>Network Access</i>, make sure <code>0.0.0.0/0</code> (Allow Access from Anywhere) is whitelisted so Render's servers can connect.</p>
            </div>`;
          }
        } else {
          if (el) {
            el.innerHTML = `<div style="background: rgba(91, 105, 133, 0.1); border-left: 4px solid var(--mu); padding: 10px 14px; border-radius: 6px; margin: 8px 0;">
              <b>⚪ Running in Local Fallback Mode</b><br>
              <span class="note">Data is saved locally in this browser. To persist in cloud MongoDB, configure <code>MONGODB_URI</code> in Render Environment Variables or your local <code>.env</code>.</span>
            </div>`;
          }
        }
      }
    } catch (e) {
      if (el) el.innerHTML = '<span class="note">Unable to reach backend API. Local offline mode is active.</span>';
    }
  }

  async function reconnectDb() {
    const el = $('dbNote');
    if (el) el.innerHTML = '<span class="note">Reconnecting to MongoDB...</span>';
    try {
      const res = await fetch('/api/status/reconnect', { method: 'POST' });
      const json = await res.json();
      if (json && json.ok && json.connected) {
        flash = ['', 'Successfully connected to MongoDB!'];
      } else {
        flash = ['w', json?.database?.error ? 'Connection failed: ' + json.database.error : 'MongoDB not connected. Check MONGODB_URI.'];
      }
      render();
    } catch (e) {
      flash = ['e', 'Failed to send reconnect request.'];
      render();
    }
  }

  async function syncWithServer() {
    if (!USER) {
      flash = ['w', 'Sign in to sync with your database.'];
      return render();
    }
    const el = $('dbNote');
    if (el) el.innerHTML = '<span class="note">Syncing data with MongoDB...</span>';
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER.id, data: S }),
      });
      const res = await fetch('/api/data?userId=' + encodeURIComponent(USER.id));
      const json = await res.json();
      if (json && json.ok && json.data) {
        S = Object.assign(DEFS(), json.data);
        save();
        flash = ['', 'Synchronized with database.'];
        render();
      }
    } catch (e) {
      flash = ['e', 'Sync error. Check server and database connection.'];
      render();
    }
  }

  function settings() {
    const t = S.theme || 'light', cu = Object.assign({}, CU0, S.custom), p = S.profile || {}, v = (k: string) => esc((p as any)[k] || '');
    setTimeout(() => checkDbStatus(), 50);
    return `<h2>Settings</h2><p class='sub'>Make StudentSpend look and read the way you like.</p>${notice()}
<div class='c'><h3>Profile</h3><div class='f'><input id='pn' value="${v('name')}" placeholder='Your name' aria-label='Name'><input id='pc' value="${v('college')}" placeholder='College' aria-label='College'><input id='pe' value="${v('email')}" placeholder='Your email' aria-label='Email'></div><div class='f'><input id='pp' value="${v('parent')}" placeholder='Parent or guardian name' aria-label='Parent name'><input id='ppe' value="${v('parentEmail')}" placeholder='Parent email' aria-label='Parent email'></div><button onclick='saveProfile()'>Save profile</button></div>
${accountCard()}
<div class='c'>
  <h3>🚀 Render &amp; MongoDB Atlas Status</h3>
  <div id='dbNote'><span class='note'>Checking database status...</span></div>
  <div class='f' style='margin-top:10px'>
    <button class='o' onclick='checkDbStatus()'>Check Status</button>
    <button class='o' onclick='reconnectDb()'>Test / Reconnect</button>
    <button class='o' onclick='syncWithServer()'>Sync with Database</button>
    <button class='o' onclick='toggleDeployGuide()'>📖 Render Deployment Guide</button>
  </div>
  
  <div id='deployGuide' style='display:${deployGuideOpen ? 'block' : 'none'};margin-top:14px;padding:14px;background:var(--ef);border-radius:10px;border:1px solid var(--bd)'>
    <h4 style='margin:0 0 8px;font-size:15px'>Deploying StudentSpend to Render &amp; MongoDB Atlas</h4>
    <ol style='margin:0 0 10px 18px;padding:0;font-size:13px;line-height:1.6'>
      <li><b>MongoDB Atlas:</b> Create a free cluster at <a href='https://mongodb.com' target='_blank' rel='noopener' style='color:var(--nv);font-weight:600'>mongodb.com</a>. Under <i>Database Access</i>, add a user and password. Under <i>Network Access</i>, add IP <code>0.0.0.0/0</code> (Allow Access from Anywhere).</li>
      <li><b>Copy URI:</b> In Atlas &rarr; Connect &rarr; Drivers, copy your connection string: <code>mongodb+srv://&lt;username&gt;:&lt;password&gt;@cluster0.mongodb.net/studentspend?retryWrites=true&w=majority</code>.</li>
      <li><b>Push Code to GitHub:</b> Commit this project and push to your GitHub repo.</li>
      <li><b>Deploy on Render:</b> Go to <a href='https://render.com' target='_blank' rel='noopener' style='color:var(--nv);font-weight:600'>render.com</a> &rarr; <i>New +</i> &rarr; <i>Web Service</i> &rarr; Select your repo.
        <ul style='margin:4px 0 6px 14px'>
          <li><b>Build Command:</b> <code>npm install &amp;&amp; npm run build</code></li>
          <li><b>Start Command:</b> <code>npm start</code></li>
        </ul>
      </li>
      <li><b>Add Environment Variables on Render:</b>
        <div style='background:var(--card);padding:8px;border-radius:6px;font-family:monospace;font-size:12px;margin:6px 0;border:1px solid var(--bd)'>
          NODE_ENV=production<br>
          MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/studentspend?retryWrites=true&amp;w=majority<br>
          GEMINI_API_KEY=(optional, for Gemini AI)
        </div>
      </li>
      <li>Render automatically handles SSL, domain, and auto-deploys on every git push!</li>
    </ol>
  </div>
</div>
<div class='c'><h3>Theme</h3><div class='f'>${['light', 'dark', 'custom'].map(x => `<button class='o ${t == x ? 'sel' : ''}' onclick="setTheme('${x}')">${{ light: 'Light', dark: 'Dark', custom: 'Custom' }[x as keyof typeof TH] || x}</button>`).join('')}</div>${t == 'custom' ? `<div class='f'><label class='note'>Main colour <input type='color' value='${cu.nv}' onchange="setCu('nv',this.value)"></label><label class='note'>Accent colour <input type='color' value='${cu.ac}' onchange="setCu('ac',this.value)"></label><label class='note'>Background <input type='color' value='${cu.bg}' onchange="setCu('bg',this.value)"></label></div>` : ''}</div>
<div class='c'><h3>Language</h3><select onchange='S.lang=this.value;save();render()' aria-label='Language'><option value='en' ${S.lang != 'hi' ? 'selected' : ''}>English</option><option value='hi' ${S.lang == 'hi' ? 'selected' : ''}>हिन्दी (Hindi)</option></select><p class='note'>Hindi covers menus, page titles and the main buttons.</p></div>
<div class='c'><h3>Data &amp; Backup</h3><div class='f'><button class='o' onclick="exp2()">Download transactions (CSV)</button><button class='s' onclick="delAll()">Delete all data</button></div></div>`;
  }

  // Page registry
  const pages: Record<string, () => string> = {
    dashboard,
    transactions,
    budgets,
    savings,
    emergency,
    insights,
    categories: () => categories() + catPeriod() + catTrend(),
    share: sharePage,
    statement,
    trash: trashPage,
    settings,
    importPage,
    import: importPage
  };

  function go() {
    const qEl = $("q");
    const a = qEl && document.activeElement == qEl;
    const pos = a ? qEl.selectionStart : 0;
    render();
    if (a) {
      const newQ = $("q");
      if (newQ) {
        newQ.focus();
        newQ.setSelectionRange(pos, pos);
      }
    }
  }

  function render() {
    if (RO) {
      document.body.classList.remove('na');
      const a0 = document.getElementById('auth');
      if (a0) a0.remove();
    } else if (!USER) {
      return authView();
    }
    const h0 = (location.hash || "#dashboard").slice(1);
    const h = h0 == "import" ? "importPage" : h0;
    const p = pages[h] ? h : "dashboard";
    const mEl = $("m");
    if (mEl) mEl.innerHTML = pages[p]();
    applyTheme();
    who();
    translate();
    document.querySelectorAll("nav a").forEach((a: any) => {
      a.classList.toggle("on", a.getAttribute("href") == "#" + (p == "importPage" ? "import" : p));
    });
  }

  // Export functions to window so inline onclick handlers work natively
  const win = window as any;
  win.S = S;
  win.au = au;
  win.imp = imp;
  win.wd = wd;
  win.st = st;
  win.cv = cv;
  win.sh = sh;
  win.tv = tv;
  win.authView = authView;
  win.doSignUp = doSignUp;
  win.doSignIn = doSignIn;
  win.doReset = doReset;
  win.eraseAcct = eraseAcct;
  win.forgot = forgot;
  win.signOut = signOut;
  win.showProfile = showProfile;
  win.addTx = addTx;
  win.delTx = delTx;
  win.aiCat = aiCat;
  win.go = go;
  win.setOv = setOv;
  win.setB = setB;
  win.delB = delB;
  win.setStrict = setStrict;
  win.contrib = contrib;
  win.reqWd = reqWd;
  win.doWd = doWd;
  win.addCat = addCat;
  win.renCat = renCat;
  win.delCat = delCat;
  win.addGoal = addGoal;
  win.goalAdd = goalAdd;
  win.delGoal = delGoal;
  win.onFile = onFile;
  win.commitImp = commitImp;
  win.ask = ask;
  win.askAI = askAI;
  win.setRange = setRange;
  win.dlSt = dlSt;
  win.exp2 = exp2;
  win.restore = restore;
  win.purge = purge;
  win.delAll = delAll;
  win.sendMail = sendMail;
  win.sendWa = sendWa;
  win.copyMsg = copyMsg;
  win.copyLink = copyLink;
  win.nativeShare = nativeShare;
  win.addParent = addParent;
  win.delParent = delParent;
  win.syncNow = syncNow;
  win.saveProfile = saveProfile;
  win.newCode = newCode;
  win.setTheme = setTheme;
  win.setCu = setCu;
  win.checkDbStatus = checkDbStatus;
  win.reconnectDb = reconnectDb;
  win.toggleDeployGuide = toggleDeployGuide;
  win.syncWithServer = syncWithServer;
  win.render = render;

  // Restore session
  try {
    const sid = localStorage.getItem('ss_sess') || sessionStorage.getItem('ss_sess');
    const su = users().find(x => x.id == sid);
    if (su) loadUser(su);
  } catch (e) { }

  window.addEventListener("hashchange", () => {
    wd = null;
    render();
  });

  render();
}
