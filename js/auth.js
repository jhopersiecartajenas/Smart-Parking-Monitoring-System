/* ===========================================================
   ParkFlow — authentication (Admin + Security accounts)
   Session uses sessionStorage, so you can stay logged in as
   Admin in one tab and Security in another tab at the same time.
   =========================================================== */
const Auth = (() => {
  const SESSION_KEY = 'parkflow_session';

  const ACCOUNTS = {
    admin: {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      name: 'Alex Morgan',
      title: 'Administrator',
      initials: 'AM',
      home: 'admin-dashboard.html'
    },
    security: {
      username: 'security',
      password: 'security123',
      role: 'security',
      name: 'Sam Rivera',
      title: 'Security Personnel',
      initials: 'SR',
      home: 'security-dashboard.html'
    }
  };

  function login(username, password, role) {
    const acc = ACCOUNTS[(username || '').trim().toLowerCase()];
    if (!acc || acc.password !== password) {
      return { ok: false, reason: 'Incorrect username or password.' };
    }
    if (role && acc.role !== role) {
      return { ok: false, reason: `This is not a ${role === 'admin' ? 'Administrator' : 'Security'} account.` };
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      username: acc.username, role: acc.role, name: acc.name,
      title: acc.title, initials: acc.initials, home: acc.home
    }));
    return { ok: true, user: acc };
  }

  function current() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  /* Call at the top of every protected page.
     Auth.guard('admin')    -> admin pages
     Auth.guard('security') -> security pages */
  function guard(role) {
    const user = current();
    if (!user) { window.location.replace('index.html'); return null; }
    if (role && user.role !== role) { window.location.replace(user.home); return null; }
    return user;
  }

  return { ACCOUNTS, login, logout, current, guard };
})();