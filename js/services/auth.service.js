/* =========================================================
   services/auth.service.js — احراز هویت، نقش‌ها، نشست
   ========================================================= */
window.App = window.App || {};

App.AuthService = (function () {
  const Err   = App.Err;
  const Crypt = App.Crypto;
  const Bus   = App.Bus;
  const Users = App.Repo.create('users');

  const SESSION_KEY   = 'gh_fund_session';
  const SESSION_TTL   = 30 * 60 * 1000;   // ۳۰ دقیقه بی‌کاری
  const MAX_ATTEMPTS  = 5;
  const LOCK_MS       = 5 * 60 * 1000;

  const ROLES = ['admin', 'treasurer', 'auditor', 'member'];
  const ROLE_LABELS = {
    admin:     'مدیر',
    treasurer: 'خزانه‌دار',
    auditor:   'بازرس',
    member:    'عضو'
  };

  /* ماتریس دسترسی */
  const PERMISSIONS = {
    admin:     ['*'],
    treasurer: ['members.read', 'loans.read', 'loans.write', 'txn.read', 'txn.write',
                'reports.read', 'audit.read', 'data.read'],
    auditor:   ['members.read', 'loans.read', 'txn.read', 'reports.read', 'audit.read'],
    member:    ['self.read']
  };

  let currentUser = null;

  /* ---------- CRUD کاربران ---------- */
  async function hasAnyUser() {
    return (await Users.count()) > 0;
  }
  async function getUser(username) {
    return Users.get(String(username || '').trim().toLowerCase());
  }
  async function listUsers() {
    const arr = await Users.all();
    return arr.sort((a, b) => a.username.localeCompare(b.username));
  }
  async function createUser({ username, password, displayName, role, memberCode }) {
    username = String(username || '').trim().toLowerCase();
    if (!username) throw Err.Validation('نام کاربری الزامی است');
    if (!password || password.length < 8) throw Err.Validation('رمز عبور باید حداقل ۸ کاراکتر باشد');
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw Err.Validation('رمز عبور باید شامل حرف و عدد باشد');
    }
    if (!ROLES.includes(role)) throw Err.Validation('نقش نامعتبر است');
    if (await Users.get(username)) throw Err.Conflict('این نام کاربری قبلاً ثبت شده');

    const { hash, salt, iterations } = await Crypt.hashPassword(password);
    const user = {
      username,
      displayName: displayName || username,
      role,
      memberCode: memberCode || null,
      passwordHash: hash, salt, iterations,
      failedAttempts: 0, lockedUntil: null,
      isActive: true,
      mustChangePassword: false,   /* فقط برای admin اولیه false */
      createdAt: Date.now(), updatedAt: Date.now()
    };
    await Users.put(user);
    await App.DataService.logAudit({
      action: 'user:create', entity: 'user', entityId: username,
      after: { username, role, displayName }
    });
    return user;
  }
  async function updateUser(username, patch) {
    const user = await Users.get(username);
    if (!user) throw Err.NotFound('کاربر یافت نشد');

    /* S-06: username قابل تغییر نیست */
    delete patch.username;

    /* S-06: اگر آخرین مدیر فعال است، نقش/فعال بودنش نباید خراب شود */
    if (user.role === 'admin' && user.isActive) {
      const all = await Users.all();
      const activeAdmins = all.filter(u => u.role === 'admin' && u.isActive);
      const willDemote = patch.role && patch.role !== 'admin';
      const willDisable = patch.isActive === false;
      if (activeAdmins.length <= 1 && (willDemote || willDisable)) {
        throw Err.Permission('نمی‌توان آخرین مدیر فعال را غیرفعال یا تنزل داد');
      }
    }

    const before = { role: user.role, displayName: user.displayName, isActive: user.isActive };
    Object.assign(user, patch, { updatedAt: Date.now() });
    await Users.put(user);
    await App.DataService.logAudit({
      action: 'user:update', entity: 'user', entityId: username, before, after: patch
    });
    return user;
  }
  async function deleteUser(username) {
    if (username === 'admin') throw Err.Permission('حساب مدیر پیش‌فرض حذف‌شدنی نیست');

    /* S-06: جلوگیری از حذف آخرین مدیر فعال */
    const all = await Users.all();
    const activeAdmins = all.filter(u => u.role === 'admin' && u.isActive);
    const target = all.find(u => u.username === username);
    if (target?.role === 'admin' && target.isActive && activeAdmins.length <= 1) {
      throw Err.Permission('نمی‌توان آخرین مدیر فعال را حذف کرد');
    }

    await Users.del(username);
    await App.DataService.logAudit({ action: 'user:delete', entity: 'user', entityId: username });
  }
  async function changePassword(username, newPassword) {
    if (!newPassword || newPassword.length < 6) throw Err.Validation('رمز عبور باید حداقل ۶ کاراکتر باشد');
    const user = await Users.get(username);
    if (!user) throw Err.NotFound('کاربر یافت نشد');

    const { hash, salt, iterations } = await Crypt.hashPassword(newPassword);
    Object.assign(user, {
      passwordHash: hash, salt, iterations,
      mustChangePassword: false,
      failedAttempts: 0, lockedUntil: null,
      updatedAt: Date.now()
    });
    await Users.put(user);
    await App.DataService.logAudit({ action: 'user:change-password', entity: 'user', entityId: username });
    return user;
  }

  /* ---------- ورود ---------- */
  async function login(username, password) {
    username = String(username || '').trim().toLowerCase();
    const INVALID = 'نام کاربری یا رمز عبور نادرست است';

    const user = await Users.get(username);
    /* S-06: پیام‌های یکسان برای جلوگیری از لو رفتن وجود حساب */
    if (!user) throw Err.Permission(INVALID);
    if (!user.isActive) throw Err.Permission(INVALID);

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      throw Err.Permission(`حساب تا ${App.Utils.toFa(mins)} دقیقه دیگر قفل است`);
    }

    const ok = await Crypt.verifyPassword(password, {
      hash: user.passwordHash, salt: user.salt, iterations: user.iterations
    });

    if (!ok) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= MAX_ATTEMPTS) {
        user.lockedUntil = Date.now() + LOCK_MS;
        user.failedAttempts = 0;
      }
      await Users.put(user);
      if (user.lockedUntil) throw Err.Permission('حساب به‌دلیل تلاش‌های ناموفق قفل شد');
      throw Err.Permission(INVALID);
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = Date.now();
    await Users.put(user);

    currentUser = {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      memberCode: user.memberCode,
      mustChangePassword: user.mustChangePassword,
      loginAt: Date.now(),
      lastActivity: Date.now()
    };
    saveSession();
    await App.DataService.logAudit({ action: 'user:login', entity: 'user', entityId: username });
    Bus.emit('auth:login', currentUser);
    return currentUser;
  }

  function logout() {
    const uname = currentUser?.username;
    currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
    if (uname) App.DataService.logAudit({ action: 'user:logout', entity: 'user', entityId: uname }).catch(() => {});
    Bus.emit('auth:logout');
  }

  /* ---------- نشست ---------- */
  function saveSession() {
    if (!currentUser) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  }
  function getSession() {
    if (currentUser) return currentUser;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (Date.now() - s.lastActivity > SESSION_TTL) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      currentUser = s;
      return currentUser;
    } catch { return null; }
  }
  async function validateSession() {
    const s = getSession();
    if (!s) return false;
    const user = await Users.get(s.username);
    if (!user || !user.isActive) { logout(); return false; }
    Object.assign(currentUser, {
      role: user.role,
      displayName: user.displayName,
      memberCode: user.memberCode,
      mustChangePassword: user.mustChangePassword
    });
    saveSession();
    return true;
  }
  function touchSession() {
    if (!currentUser) return;
    currentUser.lastActivity = Date.now();
    saveSession();
  }

  const isLoggedIn    = () => !!getSession();
  const getCurrentUser = () => getSession();

  /* ---------- دسترسی ---------- */
  function hasRole(...roles) {
    const u = getCurrentUser();
    return !!u && roles.includes(u.role);
  }
  function can(permission) {
    const u = getCurrentUser();
    if (!u) return false;
    const perms = PERMISSIONS[u.role] || [];
    return perms.includes('*') || perms.includes(permission);
  }

  return {
    ROLES, ROLE_LABELS, MAX_ATTEMPTS, PERMISSIONS,
    hasAnyUser, getUser, listUsers, createUser, updateUser, deleteUser, changePassword,
    login, logout, getSession, getCurrentUser, isLoggedIn, validateSession, touchSession,
    hasRole, can
  };
})();