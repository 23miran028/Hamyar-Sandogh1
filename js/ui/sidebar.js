const GROUPS = [
  {
    title: 'اصلی',
    items: [
      { id: 'dashboard', label: 'داشبورد',       icon: '📊', roles: ['admin','treasurer','auditor','member'] },
      { id: 'forecast',  label: 'پیش‌بینی',       icon: '🔮', roles: ['admin','treasurer','auditor'] },
      { id: 'reminders', label: 'یادآورها',       icon: '🔔', roles: ['admin','treasurer','auditor'] }
    ]
  },
  {
    title: 'مدیریت مالی',
    items: [
      { id: 'members', label: 'اعضا',    icon: '👥', roles: ['admin','treasurer','auditor'] },
      { id: 'loans',   label: 'وام‌ها',  icon: '💳', roles: ['admin','treasurer','auditor'] }
    ]
  },
  {
    title: 'گزارش‌ها',
    items: [
      { id: 'monthly', label: 'گزارش ماهانه', icon: '📅', roles: ['admin','treasurer','auditor'] },
      { id: 'yearly',  label: 'گزارش سالانه', icon: '📈', roles: ['admin','treasurer','auditor'] },
      { id: 'reports', label: 'مرکز گزارش‌ها', icon: '📄', roles: ['admin','treasurer','auditor'] }
    ]
  },
  {
    title: 'سیستم',
    items: [
      { id: 'backup',           label: 'پشتیبان‌گیری',    icon: '💾', roles: ['admin'] },
      { id: 'settingsGlobal',   label: 'تنظیمات صندوق',  icon: '⚙️', roles: ['admin'] },
      { id: 'auditLog',         label: 'لاگ تغییرات',     icon: '📋', roles: ['admin'] },
      { id: 'data',             label: 'داده‌ها',          icon: '🗄️', roles: ['admin'] },
      { id: 'settings',         label: 'کاربران',         icon: '👤', roles: ['admin'] }
    ]
  }
];