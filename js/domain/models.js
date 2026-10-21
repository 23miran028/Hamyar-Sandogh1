/* =========================================================
   domain/models.js — مدل‌ها و کارخانه‌سازی
   ========================================================= */
window.App = window.App || {};

App.Models = (function () {
  const U = App.Utils;
  const Err = App.Err;
  const now = () => Date.now();
  const uid = (p) => (p || 'id') + '_' + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 8);

  /* ---------- Member ---------- */
  const Member = {
    create(props = {}) {
      return {
        code: String(props.code || '').trim(),
        name: U.norm(props.name || ''),
        joinedAt: props.joinedAt || null,       // periodKey
        status: props.status || 'active',       // active | inactive
        phone: props.phone || '',
        nationalId: props.nationalId || '',
        note: props.note || '',
        createdAt: props.createdAt || now(),
        updatedAt: props.updatedAt || now()
      };
    },
    validate(m) {
      if (!m.code) throw Err.Validation('کد عضو الزامی است');
      if (!m.name) throw Err.Validation('نام عضو الزامی است');
      if (!['active', 'inactive'].includes(m.status))
        throw Err.Validation('وضعیت عضو نامعتبر است');
      return true;
    }
  };

  /* ---------- Period ---------- */
  const Period = {
  create(props = {}) {
    return {
      key: props.key || '',
      name: props.name || '',
      year: Number(props.year) || 0,
      idx: Number(props.idx) || 0,
      depositRate: U.num(props.depositRate),   // ← نرخ واریز ثابت این دوره
      totals: props.totals || {
        remaining: 0, capInst: 0, installment: 0,
        deposit: 0, totalCap: 0
      },
      createdAt: props.createdAt || now(),
      updatedAt: props.updatedAt || now()
    };
  }
};

  /* ---------- Snapshot (یک ردیف عضو در یک دوره) ---------- */
  const Snapshot = {
  create(props = {}) {
    return {
      periodKey: props.periodKey || '',
      memberCode: props.memberCode || '',
      name: props.name || '',              // ← این خط را اضافه کن
      remaining: U.num(props.remaining),
      capInst: U.num(props.capInst),
      paidCount: (props.paidCount == null) ? null : U.num(props.paidCount),
      installment: U.num(props.installment),
      loan: U.num(props.loan),
      deposit: U.num(props.deposit),
      totalCap: U.num(props.totalCap),
      rowNo: props.rowNo == null ? null : U.num(props.rowNo),
      updatedAt: props.updatedAt || now()
    };
  }
};


  /* ---------- Loan ---------- */
const INSTALLMENT_COUNT = 20;   // ← ثابت در کل برنامه

const Loan = {
  create(props = {}) {
    const amount = U.num(props.amount);
    return {
      id: props.id || uid('loan'),
      memberCode: props.memberCode || '',
      amount,
      count: INSTALLMENT_COUNT,                        // همیشه ۲۰
      installment: U.num(props.installment)            // قسط ماهانه (خودکار محاسبه می‌شود)
        || Math.round(amount / INSTALLMENT_COUNT),
      startPeriodKey: props.startPeriodKey || '',
      startYear: Number(props.startYear) || 0,
      startIdx: Number(props.startIdx) || 0,
      paid: props.paid == null ? 0 : U.num(props.paid),
      remaining: U.num(props.remaining),
      status: props.status || 'active',                // active | settled
      createdAt: props.createdAt || now(),
      updatedAt: props.updatedAt || now()
    };
  },
  isActive(l) { return l && l.status === 'active'; },
  INSTALLMENT_COUNT
};

  /* ---------- Yearly ---------- */
  const Yearly = {
    create(props = {}) {
      return {
        year: String(props.year || ''),
        memberCols: Array.isArray(props.memberCols) ? props.memberCols.slice() : [],
        rows: Array.isArray(props.rows) ? props.rows : [],
        updatedAt: props.updatedAt || now()
      };
    }
  };

  /* ---------- Meta ---------- */
  const Meta = {
    create(props = {}) {
      return { key: props.key, value: props.value, updatedAt: props.updatedAt || now() };
    }
  };

  /* ---------- AuditLog ---------- */
  const AuditLog = {
    create(props = {}) {
      return {
        timestamp: props.timestamp || now(),
        actor: props.actor || 'system',
        action: props.action || 'unknown',
        entity: props.entity || '',
        entityId: props.entityId || '',
        before: props.before || null,
        after: props.after || null,
        meta: props.meta || null
      };
    }
  };

  return { Member, Period, Snapshot, Loan, Yearly, Meta, AuditLog, uid, INSTALLMENT_COUNT };
})();