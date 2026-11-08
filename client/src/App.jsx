import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams
} from "react-router-dom";
import { api } from "./api";
import { load } from "@cashfreepayments/cashfree-js";

const services = ["Product A", "Product B", "Product C", "Other"];

const statuses = [
  "New",
  "Contacted",
  "Interested",
  "Converted",
  "Not Interested"
];

const leadColumns = [
  { id: "lead", label: "Lead" },
  { id: "contact", label: "Contact" },
  { id: "service", label: "Service" },
  { id: "date", label: "Date" },
  { id: "age", label: "Lead Age" },
  { id: "status", label: "Status" },
  { id: "action", label: "Action" }
];

const orderColumns = [
  { id: "orderId", label: "Order ID" },
  { id: "customer", label: "Customer Name" },
  { id: "phone", label: "Phone Number" },
  { id: "date", label: "Date" },
  { id: "service", label: "Service" },
  { id: "amount", label: "Amount" },
  { id: "paymentStatus", label: "Payment Status" },
  { id: "transaction", label: "Transaction ID" },
  { id: "invoice", label: "Invoice ID" },
  { id: "action", label: "Action" }
];

const blankForm = {
  customerName: "",
  mobile: "",
  email: "",
  service: "",
  message: ""
};

const navigation = [
  { id: "leads", label: "Lead management", icon: "▦" },
  { id: "orders", label: "Orders & Transactions", icon: "◫" },
  { id: "invoices", label: "Invoice management", icon: "▤" },
  { id: "emails", label: "Email history", icon: "✉" },
  { id: "gateway", label: "Payment gateway", icon: "▣" },
  { id: "customers", label: "Customers", icon: "♙" },
  { id: "reports", label: "Reports & Analytics", icon: "▥" },
  { id: "settings", label: "Settings", icon: "⚙" }
];

// Notify other open CRM tabs that data has changed.
// The browser storage event is received by other tabs on this origin.
function notifyCrmDataChanged() {
  try {
    localStorage.setItem("crm_data_updated", String(Date.now()));
  } catch {
    // Dashboard polling will still refresh the data.
  }
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-IN");
}

function formatDateTime(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-IN");
}

function formatRelativeTime(value) {
  if (!value) return "Not available";

  const created = new Date(value).getTime();

  if (Number.isNaN(created)) return "Not available";

  const difference = Math.max(0, Date.now() - created);

  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);

  if (months < 12) {
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function formatMoney(amount, currency = "INR") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function Header({ admin = false }) {
  return (
    <header className="topbar">
      <Link className="brand" to="/">
        northstar<span>CRM</span>
      </Link>

      <nav>
        {admin ? (
          <Link to="/admin">Dashboard</Link>
        ) : (
          <a href="#contact">Contact</a>
        )}

        <Link
          className="nav-button"
          to={admin ? "/" : "/admin/login"}
        >
          {admin ? "Public website" : "Admin login"}
        </Link>
      </nav>
    </header>
  );
}

// ==========================================
// PUBLIC ENQUIRY FORM
// ==========================================

function PublicHome() {
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({
    type: "",
    text: ""
  });
  const [errors, setErrors] = useState({});

  function change(e) {
    const { name, value } = e.target;

    const updatedValue =
      name === "mobile"
        ? value.replace(/\D/g, "").slice(0, 10)
        : value;

    setForm((prev) => ({
      ...prev,
      [name]: updatedValue
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: ""
    }));
  }

  function validate() {
    const next = {};

    if (form.customerName.trim().length < 2) {
      next.customerName = "Please enter your name.";
    }

    if (!/^\d{10}$/.test(form.mobile)) {
      next.mobile = "Mobile number must contain exactly 10 digits.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }

    if (!services.includes(form.service)) {
      next.service = "Please select a service.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e) {
    e.preventDefault();

    setNotice({ type: "", text: "" });

    if (!validate() || busy) return;

    setBusy(true);

    try {
      const result = await api("/api/leads", {
        method: "POST",
        body: JSON.stringify(form)
      });

      // Notify any other open admin dashboard tabs.
      notifyCrmDataChanged();

      if (!result.paymentSessionId) {
        throw new Error("Payment session was not generated.");
      }

      const cashfree = await load({
        mode: "sandbox"
      });

      if (!cashfree) {
        throw new Error("Unable to load Cashfree checkout.");
      }

      await cashfree.checkout({
        paymentSessionId: result.paymentSessionId,
        redirectTarget: "_self"
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err.message || "Unable to initiate payment."
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              LET'S BUILD SOMETHING BETTER
            </p>

            <h1>
              Good things start with a <em>conversation.</em>
            </h1>

            <p className="hero-text">
              Tell us what you're looking for. Our team will get back
              to you to understand your needs and explore the right solution.
            </p>

            <div className="trust-row">
              <span>✓ Personal response</span>
              <span>✓ No obligation</span>
            </div>
          </div>

          <div className="hero-art">
            <div className="orb orb-one"></div>
            <div className="orb orb-two"></div>

            <div className="art-card">
              <span className="art-icon">✳</span>
              <strong>
                Your next idea<br />starts here.
              </strong>
              <small>We're ready when you are.</small>
            </div>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="section-intro">
            <p className="eyebrow">GET IN TOUCH</p>
            <h2>
              Tell us a little about<br />what you need.
            </h2>
            <p>Fill in the form and we'll be in touch.</p>
          </div>

          <form
            className="lead-form"
            onSubmit={submit}
            noValidate
          >
            {notice.text && (
              <div className={`notice ${notice.type}`}>
                {notice.text}
              </div>
            )}

            <div className="field">
              <label htmlFor="customerName">Your name *</label>

              <input
                id="customerName"
                name="customerName"
                value={form.customerName}
                onChange={change}
                placeholder="e.g. Aarav Patil"
              />

              {errors.customerName && (
                <small className="field-error">
                  {errors.customerName}
                </small>
              )}
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="mobile">Mobile number *</label>

                <input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={form.mobile}
                  onChange={change}
                  placeholder="9876543210"
                  required
                />

                <small className="optional">
                  Enter exactly 10 digits.
                </small>

                {errors.mobile && (
                  <small className="field-error">
                    {errors.mobile}
                  </small>
                )}
              </div>

              <div className="field">
                <label htmlFor="email">Email address *</label>

                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={change}
                  placeholder="you@example.com"
                />

                {errors.email && (
                  <small className="field-error">
                    {errors.email}
                  </small>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="service">Service interested in *</label>

              <select
                id="service"
                name="service"
                value={form.service}
                onChange={change}
              >
                <option value="">Choose a service</option>

                {services.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              {errors.service && (
                <small className="field-error">
                  {errors.service}
                </small>
              )}
            </div>

            <div className="field">
              <label htmlFor="message">
                Additional message{" "}
                <span className="optional">Optional</span>
              </label>

              <textarea
                id="message"
                name="message"
                rows="4"
                value={form.message}
                onChange={change}
                placeholder="Tell us a little more about your requirements..."
              />
            </div>

            <button
              className="primary-button full"
              disabled={busy}
            >
              {busy ? "Submitting..." : "Submit your enquiry"}
              <span>→</span>
            </button>

            <p className="form-footnote">
              Your information will only be used to respond to your enquiry.
            </p>
          </form>
        </section>
      </main>

      <footer>
        © {new Date().getFullYear()} Northstar. Built to make every enquiry count.
      </footer>
    </>
  );
}

// ==========================================
// ADMIN LOGIN
// ==========================================

function Login() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();

    setBusy(true);
    setError("");

    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem("crm_token", result.token);
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />

      <main className="login-wrap">
        <form className="login-card" onSubmit={submit}>
          <p className="eyebrow">NORTHSTAR CRM</p>

          <h1>Welcome back.</h1>

          <p className="muted">
            Sign in to manage your leads.
          </p>

          {error && (
            <div className="notice error">{error}</div>
          )}

          <div className="field">
            <label>Email address</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="primary-button full"
            disabled={busy}
          >
            {busy ? "Signing in..." : "Sign in"}
            <span>→</span>
          </button>

          <Link className="back-link" to="/">
            ← Back to website
          </Link>
        </form>
      </main>
    </>
  );
}

// ==========================================
// AUTHENTICATION PROTECTION
// ==========================================

function Protected({ children }) {
  const [valid, setValid] = useState(null);

  useEffect(() => {
    api("/api/auth/me")
      .then(() => setValid(true))
      .catch(() => {
        localStorage.removeItem("crm_token");
        setValid(false);
      });
  }, []);

  if (valid === null) {
    return (
      <div className="center-state">
        Checking your session...
      </div>
    );
  }

  return valid
    ? children
    : <Navigate to="/admin/login" replace />;
}

function ColumnPicker({ columns, visibleColumns, onChange }) {
  function toggleColumn(id) {
    onChange((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  return (
    <details className="column-picker">
      <summary className="outline-button column-picker-trigger">
        ☷ Columns
      </summary>

      <div className="column-picker-menu">
        <strong>Show / Hide Columns</strong>

        {columns.map((column) => (
          <label className="column-picker-option" key={column.id}>
            <input
              type="checkbox"
              checked={visibleColumns.includes(column.id)}
              onChange={() => toggleColumn(column.id)}
            />
            <span>{column.label}</span>
          </label>
        ))}

        <button
          type="button"
          className="outline-button column-picker-reset"
          onClick={() => onChange(columns.map((column) => column.id))}
        >
          Show all columns
        </button>
      </div>
    </details>
  );
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================

function AdminDashboard() {
  const [leads, setLeads] = useState([]);
  const [orders, setOrders] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    contacted: 0,
    converted: 0
  });

  const [activeView, setActiveView] = useState("leads");

  const [visibleLeadColumns, setVisibleLeadColumns] = useState(
    leadColumns.map((column) => column.id)
  );

  const [visibleOrderColumns, setVisibleOrderColumns] = useState(
    orderColumns.map((column) => column.id)
  );

  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [emailSearch, setEmailSearch] = useState("");

  const [selected, setSelected] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [remark, setRemark] = useState("");
  const [newStatus, setNewStatus] = useState("New");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Prevent multiple dashboard refreshes from running simultaneously.
  const refreshInProgress = useRef(false);

  const navigate = useNavigate();

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }

  function comingSoon(feature) {
    showToast(`${feature} will be available in the next development phase.`);
  }

  // ==========================================
  // LOAD ALL DASHBOARD DATA
  // ==========================================

  async function loadDashboardData({ silent = false } = {}) {
    if (refreshInProgress.current) return;

    refreshInProgress.current = true;

    if (!silent) {
      setLoading(true);
    }

    try {
      const [leadData, statData, orderData] = await Promise.all([
        api("/api/leads"),
        api("/api/leads/stats"),
        api("/api/orders")
      ]);

      setLeads(leadData.leads || []);
      setStats(statData);
      setOrders(orderData.orders || []);

      setError("");
    } catch (err) {
      setError(err.message || "Unable to load CRM data.");
    } finally {
      refreshInProgress.current = false;

      if (!silent) {
        setLoading(false);
      }
    }
  }

  // Initial load, background refresh, tab updates and tab visibility.
  useEffect(() => {
    loadDashboardData();

    const interval = window.setInterval(() => {
      loadDashboardData({ silent: true });
    }, 60000);

    function handleStorageChange(event) {
      if (event.key === "crm_data_updated") {
        loadDashboardData({ silent: true });
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadDashboardData({ silent: true });
      }
    }

    window.addEventListener("storage", handleStorageChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ==========================================
  // CLIENT-SIDE LEAD FILTERING
  // ==========================================

  const visibleLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      // Paid leads are displayed under Orders, not active Leads.
      if (lead.hasSuccessfulPayment) return false;

      const matchesSearch =
        !query ||
        [
          lead.customerName,
          lead.mobile,
          lead.email
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      const matchesService =
        !service || lead.service === service;

      const matchesStatus =
        !status || lead.status === status;

      return matchesSearch && matchesService && matchesStatus;
    });
  }, [leads, search, service, status]);

  // ==========================================
  // DERIVED ORDER DATA
  // ==========================================

  const orderedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      ),
    [orders]
  );

  const successfulOrders = useMemo(
    () =>
      orderedOrders.filter(
        (order) => order.payment?.status === "Successful"
      ),
    [orderedOrders]
  );

  const totalRevenue = successfulOrders.reduce(
    (total, order) => total + Number(order.amount || 0),
    0
  );

  function getOrderNumber(orderId) {
    const index = orderedOrders.findIndex(
      (order) => order.id === orderId
    );

    return index === -1
      ? "ORD-NEW"
      : `ORD-${String(index + 1).padStart(3, "0")}`;
  }

  const filteredOrders = orderedOrders.filter((order) => {
    const query = orderSearch.trim().toLowerCase();

    if (!query) return true;

    return [
      getOrderNumber(order.id),
      order.lead?.customerName,
      order.lead?.email,
      order.lead?.mobile,
      order.payment?.cashfreePaymentId,
      order.invoice?.invoiceNumber,
      order.service
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  // ==========================================
  // CUSTOMER DATA
  // ==========================================

  const customers = useMemo(() => {
    const map = new Map();

    [
      ...leads,
      ...orderedOrders.map((order) => order.lead).filter(Boolean)
    ].forEach((lead) => {
      if (lead?.id) {
        map.set(lead.id, lead);
      }
    });

    return [...map.values()];
  }, [leads, orderedOrders]);

  const filteredCustomers = customers.filter((customer) => {
    const query = customerSearch.trim().toLowerCase();

    if (!query) return true;

    return [
      customer.customerName,
      customer.mobile,
      customer.email
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  // ==========================================
  // INVOICE DATA
  // ==========================================

  const invoices = orderedOrders.filter((order) => order.invoice);

  const filteredInvoices = invoices.filter((order) => {
    const query = invoiceSearch.trim().toLowerCase();

    if (!query) return true;

    return [
      order.invoice?.invoiceNumber,
      order.lead?.customerName,
      order.lead?.email,
      order.lead?.mobile
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  // ==========================================
  // EMAIL HISTORY DATA
  // ==========================================

  const filteredEmailHistory = invoices.filter((order) => {
    const query = emailSearch.trim().toLowerCase();

    if (!query) return true;

    return [
      order.invoice?.invoiceNumber,
      order.lead?.customerName,
      order.lead?.email,
      order.lead?.mobile
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  // ==========================================
  // MANUAL REFRESH
  // ==========================================

  async function refreshCurrentView() {
    await loadDashboardData();
    showToast("CRM data refreshed.");
  }

  // ==========================================
  // OPEN LEAD DETAILS
  // ==========================================

  async function openLead(id) {
    try {
      const data = await api(`/api/leads/${id}`);

      setSelected(data.lead);
      setNewStatus(data.lead.status);
      setRemark(data.lead.internalRemarks || "");
    } catch (err) {
      setError(err.message);
    }
  }

  // ==========================================
  // OPEN ORDER DETAILS
  // ==========================================

  async function openOrder(id) {
    try {
      const data = await api(`/api/orders/${id}`);
      setSelectedOrder(data.order);
    } catch (err) {
      setError(err.message);
    }
  }

  // ==========================================
  // SAVE LEAD
  // ==========================================

  async function saveLead() {
    if (!selected) return;

    setSaving(true);
    setError("");

    try {
      const updates = {
        internalRemarks: remark
      };

      if (!selected.hasSuccessfulPayment) {
        updates.status = newStatus;
      }

      await api(`/api/leads/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
      });

      setSelected(null);

      showToast("Lead updated successfully.");

      // Update all dashboard sections after a lead change.
      await loadDashboardData();

      // Notify any other open CRM tabs.
      notifyCrmDataChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem("crm_token");
    navigate("/admin/login");
  }

  const pageTitles = {
    leads: "Lead management",
    orders: "Orders & Transactions",
    invoices: "Invoice management",
    emails: "Email history",
    gateway: "Payment gateway",
    customers: "Customers",
    reports: "Reports & Analytics",
    settings: "Settings"
  };

  const pageDescriptions = {
    leads: "Track enquiries and keep every opportunity moving.",
    orders: "View confirmed orders, payments and customer transactions.",
    invoices: "Manage generated invoices and their delivery status.",
    emails: "Review invoice email delivery history.",
    gateway: "View payment gateway information and integration status.",
    customers: "View customer information and purchase history.",
    reports: "Review CRM activity and business performance.",
    settings: "Manage your CRM preferences and administration."
  };

  return (
    <div className="admin-shell">
      <style>{`
        .table-tools-row {
          display: flex;
          justify-content: flex-end;
          margin: 0 0 12px;
        }

        .column-picker {
          position: relative;
        }

        .column-picker-trigger {
          cursor: pointer;
          list-style: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .column-picker-trigger::-webkit-details-marker {
          display: none;
        }

        .column-picker-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          z-index: 50;
          width: 230px;
          max-height: 360px;
          overflow-y: auto;
          padding: 14px;
          background: #fff;
          color: #172033;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(15,23,42,.16);
        }

        .column-picker-menu > strong {
          display: block;
          margin-bottom: 10px;
        }

        .column-picker-option {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 0;
          cursor: pointer;
          font-size: 13px;
        }

        .column-picker-option input {
          width: 15px;
          height: 15px;
          margin: 0;
          accent-color: #2563eb;
        }

        .column-picker-reset {
          width: 100%;
          margin-top: 10px;
        }
      `}</style>

      <aside className="sidebar">
        <Link to="/" className="brand">
          northstar<span>CRM</span>
        </Link>

        <div className="side-label">WORKSPACE</div>

        <nav className="dashboard-navigation">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={
                activeView === item.id
                  ? "side-active"
                  : "side-nav-button"
              }
              onClick={() => {
                setActiveView(item.id);
                setError("");
                setSelected(null);
                setSelectedOrder(null);
              }}
            >
              <span className="navigation-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="avatar">A</div>

          <div className="admin-label">
            <strong>Administrator</strong>
            <small>CRM Admin</small>
          </div>

          <button
            className="logout"
            onClick={logout}
            title="Log out"
          >
            ↗
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-top">
          <div>
            <p className="eyebrow">NORTHSTAR CRM / WORKSPACE</p>

            <h1>{pageTitles[activeView]}</h1>

            <p className="muted">
              {pageDescriptions[activeView]}
            </p>
          </div>

          <button
            className="outline-button"
            onClick={refreshCurrentView}
            disabled={loading}
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>

        {error && (
          <div className="notice error">
            {error}
          </div>
        )}

        {toast && (
          <div className="notice success">
            {toast}
          </div>
        )}

        {/* ======================================
            LEAD MANAGEMENT
        ====================================== */}

        {activeView === "leads" && (
          <>
            <div className="stats-grid">
              <Stat label="Total enquiries" value={stats.total} icon="◫" />
              <Stat label="New leads" value={stats.new} icon="✳" />
              <Stat label="Contacted" value={stats.contacted} icon="↗" />
              <Stat label="Converted" value={stats.converted} icon="✓" />
            </div>

            <section className="table-card">
              <div className="table-heading">
                <div>
                  <h2>Active leads</h2>
                  <p className="muted">
                    Manage enquiries that have not completed a successful payment.
                  </p>
                </div>

                <span className="count-pill">
                  {visibleLeads.length} records
                </span>
              </div>

              <div className="filters">
                <input
                  aria-label="Search leads"
                  placeholder="⌕ Search name or mobile..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  aria-label="Filter service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  <option value="">All services</option>
                  {services.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>

                <select
                  aria-label="Filter status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="table-tools-row">
                <ColumnPicker
                  columns={leadColumns}
                  visibleColumns={visibleLeadColumns}
                  onChange={setVisibleLeadColumns}
                />
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th hidden={!visibleLeadColumns.includes("lead")}>LEAD</th>
                      <th hidden={!visibleLeadColumns.includes("contact")}>CONTACT</th>
                      <th hidden={!visibleLeadColumns.includes("service")}>SERVICE</th>
                      <th hidden={!visibleLeadColumns.includes("date")}>DATE</th>
                      <th hidden={!visibleLeadColumns.includes("age")}>LEAD AGE</th>
                      <th hidden={!visibleLeadColumns.includes("status")}>STATUS</th>
                      <th hidden={!visibleLeadColumns.includes("action")}>ACTION</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={Math.max(visibleLeadColumns.length, 1)} className="empty">
                          Loading leads...
                        </td>
                      </tr>
                    ) : visibleLeads.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(visibleLeadColumns.length, 1)} className="empty">
                          No active leads found.
                        </td>
                      </tr>
                    ) : (
                      visibleLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td hidden={!visibleLeadColumns.includes("lead")}>
                            <strong>{lead.customerName}</strong>
                            <small className="sub-id">
                              #{lead.id.slice(-7)}
                            </small>
                          </td>

                          <td hidden={!visibleLeadColumns.includes("contact")}>
                            {lead.mobile}
                            <small className="sub-id">
                              {lead.email}
                            </small>
                          </td>

                          <td hidden={!visibleLeadColumns.includes("service")}>
                            {lead.service}
                          </td>

                          <td hidden={!visibleLeadColumns.includes("date")}>
                            {formatDate(lead.createdAt)}
                          </td>

                          <td hidden={!visibleLeadColumns.includes("age")}>
                            <span className="sub-id">
                              {formatRelativeTime(lead.createdAt)}
                            </span>
                          </td>

                          <td hidden={!visibleLeadColumns.includes("status")}>
                            <span
                              className={`status status-${lead.status
                                .toLowerCase()
                                .replaceAll(" ", "-")}`}
                            >
                              {lead.status}
                            </span>
                          </td>

                          <td hidden={!visibleLeadColumns.includes("action")}>
                            <button
                              className="view-button"
                              onClick={() => openLead(lead.id)}
                            >
                              View ↗
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ======================================
            ORDERS & TRANSACTIONS
        ====================================== */}

        {activeView === "orders" && (
          <>
            <div className="stats-grid">
              <Stat
                label="Total orders"
                value={successfulOrders.length}
                icon="◫"
              />

              <Stat
                label="Total revenue"
                value={formatMoney(totalRevenue)}
                icon="₹"
              />

              <Stat
                label="Successful payments"
                value={successfulOrders.length}
                icon="✓"
              />

              <Stat
                label="Invoices generated"
                value={invoices.length}
                icon="▤"
              />
            </div>

            <section className="table-card">
              <div className="table-heading">
                <div>
                  <h2>Confirmed orders</h2>
                  <p className="muted">
                    Successfully paid customers and their transactions.
                  </p>
                </div>

                <span className="count-pill">
                  {successfulOrders.length} orders
                </span>
              </div>

              <div className="filters">
                <input
                  placeholder="⌕ Search order, customer, transaction or invoice..."
                  aria-label="Search orders"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>

              <div className="table-tools-row">
                <ColumnPicker
                  columns={orderColumns}
                  visibleColumns={visibleOrderColumns}
                  onChange={setVisibleOrderColumns}
                />
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th hidden={!visibleOrderColumns.includes("orderId")}>ORDER ID</th>
                      <th hidden={!visibleOrderColumns.includes("customer")}>CUSTOMER NAME</th>
                      <th hidden={!visibleOrderColumns.includes("phone")}>PHONE NUMBER</th>
                      <th hidden={!visibleOrderColumns.includes("date")}>DATE</th>
                      <th hidden={!visibleOrderColumns.includes("service")}>SERVICE</th>
                      <th hidden={!visibleOrderColumns.includes("amount")}>AMOUNT</th>
                      <th hidden={!visibleOrderColumns.includes("paymentStatus")}>PAYMENT STATUS</th>
                      <th hidden={!visibleOrderColumns.includes("transaction")}>TRANSACTION ID</th>
                      <th hidden={!visibleOrderColumns.includes("invoice")}>INVOICE ID</th>
                      <th hidden={!visibleOrderColumns.includes("action")}>ACTION</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={Math.max(visibleOrderColumns.length, 1)} className="empty">
                          Loading orders...
                        </td>
                      </tr>
                    ) : filteredOrders.filter(
                      (order) => order.payment?.status === "Successful"
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(visibleOrderColumns.length, 1)} className="empty">
                          No confirmed orders found.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders
                        .filter((order) => order.payment?.status === "Successful")
                        .map((order) => (
                          <tr key={order.id}>
                            <td hidden={!visibleOrderColumns.includes("orderId")}>
                              <strong>{getOrderNumber(order.id)}</strong>
                            </td>

                            <td hidden={!visibleOrderColumns.includes("customer")}>
                              <strong>{order.lead?.customerName || "Unknown"}</strong>
                            </td>

                            <td hidden={!visibleOrderColumns.includes("phone")}>
                              {order.lead?.mobile || "Not available"}
                            </td>

                            <td hidden={!visibleOrderColumns.includes("date")}>
                              {formatDate(
                                order.payment?.paymentDate || order.createdAt
                              )}
                            </td>

                            <td hidden={!visibleOrderColumns.includes("service")}>
                              {order.service}
                            </td>

                            <td hidden={!visibleOrderColumns.includes("amount")}>
                              {formatMoney(order.amount, order.currency)}
                            </td>

                            <td hidden={!visibleOrderColumns.includes("paymentStatus")}>
                              <span className="status status-converted">
                                {order.payment.status}
                              </span>
                            </td>

                            <td hidden={!visibleOrderColumns.includes("transaction")}>
                              <small>
                                {order.payment?.cashfreePaymentId || "Not available"}
                              </small>
                            </td>

                            <td hidden={!visibleOrderColumns.includes("invoice")}>
                              {order.invoice?.invoiceNumber || "Not generated"}
                            </td>

                            <td hidden={!visibleOrderColumns.includes("action")}>
                              <button
                                className="view-button"
                                onClick={() => openOrder(order.id)}
                              >
                                View ↗
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ======================================
            INVOICE MANAGEMENT
        ====================================== */}

        {activeView === "invoices" && (
          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>Generated invoices</h2>
                <p className="muted">
                  View invoice numbers, customers and email delivery status.
                </p>
              </div>

              <span className="count-pill">
                {invoices.length} invoices
              </span>
            </div>

            <div className="filters">
              <input
                placeholder="⌕ Search invoice, customer, phone or email..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>INVOICE ID</th>
                    <th>ORDER ID</th>
                    <th>CUSTOMER</th>
                    <th>DATE</th>
                    <th>AMOUNT</th>
                    <th>EMAIL STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="empty">
                        Loading invoices...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty">
                        No invoices found.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.invoice.invoiceNumber}</strong>
                        </td>

                        <td>{getOrderNumber(order.id)}</td>

                        <td>{order.lead?.customerName}</td>

                        <td>{formatDate(order.invoice.invoiceDate)}</td>

                        <td>
                          {formatMoney(order.amount, order.currency)}
                        </td>

                        <td>
                          <span className="status">
                            {order.invoice.emailStatus || "Pending"}
                          </span>
                        </td>

                        <td>
                          <button
                            className="view-button"
                            onClick={() => comingSoon("Invoice PDF download")}
                          >
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ======================================
            EMAIL HISTORY
        ====================================== */}

        {activeView === "emails" && (
          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>Invoice email history</h2>
                <p className="muted">
                  Track invoice email delivery for each order.
                </p>
              </div>

              <span className="count-pill">
                {invoices.length} email records
              </span>
            </div>

            <div className="filters">
              <input
                type="text"
                placeholder="⌕ Search invoice, customer, phone or email..."
                aria-label="Search invoice email history"
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
              />
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>INVOICE</th>
                    <th>CUSTOMER</th>
                    <th>EMAIL ADDRESS</th>
                    <th>EMAIL STATUS</th>
                    <th>SENT DATE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="empty">
                        Loading email history...
                      </td>
                    </tr>
                  ) : filteredEmailHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty">
                        No matching email records found.
                      </td>
                    </tr>
                  ) : (
                    filteredEmailHistory.map((order) => (
                      <tr key={order.id}>
                        <td>
                          {order.invoice.invoiceNumber}
                        </td>

                        <td>{order.lead?.customerName}</td>

                        <td>{order.lead?.email}</td>

                        <td>
                          <span className="status">
                            {order.invoice.emailStatus || "Pending"}
                          </span>
                        </td>

                        <td>
                          {formatDateTime(order.invoice.emailSentAt)}
                        </td>

                        <td>
                          <button
                            className="view-button"
                            onClick={() => comingSoon("Resend invoice email")}
                          >
                            Resend email
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ======================================
            PAYMENT GATEWAY
        ====================================== */}

        {activeView === "gateway" && (
          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>Payment gateway configuration</h2>
                <p className="muted">
                  Gateway integration overview.
                </p>
              </div>
            </div>

            <div className="detail-grid">
              <Detail label="Gateway" value="Cashfree Payments" />
              <Detail label="Environment" value="Sandbox" />
              <Detail label="Integration" value="Cashfree PG SDK" />
              <Detail label="Currency" value="INR" />
              <Detail label="Payment verification" value="Server-side verification" />
              <Detail label="Webhook management" value="Not configured yet" />
            </div>

            <div className="filters">
              <button
                className="outline-button"
                onClick={() => comingSoon("Gateway connection test")}
              >
                Test connection
              </button>

              <button
                className="outline-button"
                onClick={() => comingSoon("Gateway configuration")}
              >
                Manage configuration
              </button>

              <button
                className="outline-button"
                onClick={() => comingSoon("Refund management")}
              >
                Manage refunds
              </button>
            </div>

            <p className="muted">
              Secret keys are intentionally not displayed in the dashboard.
            </p>
          </section>
        )}

        {/* ======================================
            CUSTOMERS
        ====================================== */}

        {activeView === "customers" && (
          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>Customer directory</h2>
                <p className="muted">
                  Customers collected from enquiries and orders.
                </p>
              </div>

              <span className="count-pill">
                {filteredCustomers.length} customers
              </span>
            </div>

            <div className="filters">
              <input
                type="text"
                placeholder="⌕ Search customer name, phone or email..."
                aria-label="Search customers"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>CUSTOMER NAME</th>
                    <th>MOBILE</th>
                    <th>EMAIL</th>
                    <th>SERVICE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="empty">
                        Loading customers...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty">
                        No matching customers found.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          <strong>{customer.customerName}</strong>
                        </td>

                        <td>{customer.mobile}</td>

                        <td>{customer.email}</td>

                        <td>{customer.service}</td>

                        <td>
                          <button
                            className="view-button"
                            onClick={() => openLead(customer.id)}
                          >
                            View ↗
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="filters">
              <button
                className="outline-button"
                onClick={() => comingSoon("Customer export")}
              >
                Export customers
              </button>

              <button
                className="outline-button"
                onClick={() => comingSoon("Customer profile management")}
              >
                Customer management
              </button>
            </div>
          </section>
        )}

        {/* ======================================
            REPORTS & ANALYTICS
        ====================================== */}

        {activeView === "reports" && (
          <>
            <div className="stats-grid">
              <Stat
                label="Total enquiries"
                value={stats.total}
                icon="◫"
              />

              <Stat
                label="Successful orders"
                value={successfulOrders.length}
                icon="✓"
              />

              <Stat
                label="Total revenue"
                value={formatMoney(totalRevenue)}
                icon="₹"
              />

              <Stat
                label="Invoices"
                value={invoices.length}
                icon="▤"
              />
            </div>

            <section className="table-card">
              <div className="table-heading">
                <div>
                  <h2>Service performance</h2>
                  <p className="muted">
                    Orders and revenue grouped by service.
                  </p>
                </div>

                <button
                  className="outline-button"
                  onClick={() => comingSoon("Report export")}
                >
                  Export report
                </button>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>SERVICE</th>
                      <th>ORDERS</th>
                      <th>REVENUE</th>
                    </tr>
                  </thead>

                  <tbody>
                    {services.map((serviceName) => {
                      const matching = successfulOrders.filter(
                        (order) => order.service === serviceName
                      );

                      const revenue = matching.reduce(
                        (sum, order) => sum + Number(order.amount || 0),
                        0
                      );

                      return (
                        <tr key={serviceName}>
                          <td>{serviceName}</td>
                          <td>{matching.length}</td>
                          <td>{formatMoney(revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ======================================
            SETTINGS
        ====================================== */}

        {activeView === "settings" && (
          <section className="table-card">
            <div className="table-heading">
              <div>
                <h2>CRM settings</h2>
                <p className="muted">
                  Administrative preferences and configuration.
                </p>
              </div>
            </div>

            <div className="detail-grid">
              <Detail label="Application" value="Northstar CRM" />
              <Detail label="Currency" value="INR" />
              <Detail label="Payment provider" value="Cashfree" />
              <Detail label="Invoice format" value="PDF" />
              <Detail label="Mobile validation" value="10 digits" />
              <Detail label="Admin authentication" value="JWT" />
            </div>

            <div className="filters">
              <button
                className="outline-button"
                onClick={() => comingSoon("Admin profile settings")}
              >
                Admin profile
              </button>

              <button
                className="outline-button"
                onClick={() => comingSoon("Password management")}
              >
                Change password
              </button>

              <button
                className="outline-button"
                onClick={() => comingSoon("CRM preferences")}
              >
                Save preferences
              </button>
            </div>
          </section>
        )}
      </main>

      {/* ======================================
          LEAD DETAILS MODAL
      ====================================== */}

      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <section className="detail-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">LEAD DETAILS</p>
                <h2>{selected.customerName}</h2>
              </div>

              <button
                className="close-button"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>

            <div className="detail-grid">
              <Detail label="Mobile" value={selected.mobile} />
              <Detail label="Email" value={selected.email} />
              <Detail label="Service" value={selected.service} />
              <Detail
                label="Submitted"
                value={formatDateTime(selected.createdAt)}
              />
              <Detail
                label="Lead age"
                value={formatRelativeTime(selected.createdAt)}
              />
            </div>

            <div className="detail-message">
              <label>Customer message</label>
              <p>
                {selected.message || "No additional message provided."}
              </p>
            </div>

            <div className="field">
              <label>Lead status</label>

              <select
                value={newStatus}
                disabled={selected.hasSuccessfulPayment}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              {selected.hasSuccessfulPayment && (
                <small className="field-error">
                  Payment successful. Lead status is locked.
                </small>
              )}
            </div>

            <div className="field">
              <label>
                Internal remarks{" "}
                <span className="optional">
                  Only visible to admins
                </span>
              </label>

              <textarea
                rows="4"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Add call notes or next steps..."
              />
            </div>

            <button
              className="primary-button full"
              disabled={saving}
              onClick={saveLead}
            >
              {saving ? "Saving..." : "Save changes"}
              <span>→</span>
            </button>
          </section>
        </div>
      )}

      {/* ======================================
          ORDER DETAILS MODAL
      ====================================== */}

      {selectedOrder && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedOrder(null);
            }
          }}
        >
          <section className="detail-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">ORDER DETAILS</p>
                <h2>{getOrderNumber(selectedOrder.id)}</h2>
              </div>

              <button
                className="close-button"
                onClick={() => setSelectedOrder(null)}
              >
                ×
              </button>
            </div>

            <div className="detail-grid">
              <Detail
                label="Customer"
                value={selectedOrder.lead?.customerName}
              />

              <Detail
                label="Mobile"
                value={selectedOrder.lead?.mobile}
              />

              <Detail
                label="Email"
                value={selectedOrder.lead?.email}
              />

              <Detail
                label="Service"
                value={selectedOrder.service}
              />

              <Detail
                label="Amount"
                value={formatMoney(
                  selectedOrder.amount,
                  selectedOrder.currency
                )}
              />

              <Detail
                label="Order status"
                value={selectedOrder.status}
              />

              <Detail
                label="Order date"
                value={formatDateTime(selectedOrder.createdAt)}
              />

              <Detail
                label="Payment status"
                value={selectedOrder.payment?.status}
              />

              <Detail
                label="Cashfree order ID"
                value={selectedOrder.payment?.cashfreeOrderId}
              />

              <Detail
                label="Cashfree transaction ID"
                value={
                  selectedOrder.payment?.cashfreePaymentId || "Not available"
                }
              />

              <Detail
                label="Payment date"
                value={formatDateTime(
                  selectedOrder.payment?.paymentDate
                )}
              />

              <Detail
                label="Invoice number"
                value={
                  selectedOrder.invoice?.invoiceNumber || "Not generated"
                }
              />

              <Detail
                label="Invoice email status"
                value={
                  selectedOrder.invoice?.emailStatus || "Not available"
                }
              />

              <Detail
                label="Email sent at"
                value={formatDateTime(
                  selectedOrder.invoice?.emailSentAt
                )}
              />
            </div>

            {selectedOrder.invoice?.emailError && (
              <div className="notice error">
                Invoice email error: {selectedOrder.invoice.emailError}
              </div>
            )}

            <div className="filters">
              <button
                className="outline-button"
                onClick={() => comingSoon("Invoice PDF download")}
              >
                Download invoice PDF
              </button>

              <button
                className="outline-button"
                onClick={() => comingSoon("Invoice email resend")}
              >
                Resend invoice email
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ==========================================
// DASHBOARD COMPONENTS
// ==========================================

function Stat({ label, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>

      <strong>{value}</strong>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <label>{label}</label>
      <p>{value || "Not available"}</p>
    </div>
  );
}

// ==========================================
// CASHFREE PAYMENT STATUS
// ==========================================

function PaymentStatus() {
  const [searchParams] = useSearchParams();

  const orderId = searchParams.get("order_id");

  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState(
    "Verifying your payment..."
  );
  const [details, setDetails] = useState(null);

  async function verifyPayment() {
    if (!orderId) {
      setStatus("error");
      setMessage("Order ID is missing.");
      return;
    }

    setStatus("checking");
    setMessage("Verifying your payment...");

    try {
      const result = await api(
        `/api/payments/verify/${encodeURIComponent(orderId)}`
      );

      if (
        result.status === "Successful" ||
        result.paymentStatus === "Successful"
      ) {
        setStatus("success");

        setMessage(
          "Your payment has been received and your order is confirmed."
        );

        setDetails(result);

        // Notify other open admin dashboard tabs immediately.
        notifyCrmDataChanged();
      } else {
        setStatus("pending");

        setMessage(
          "Your payment is not confirmed yet. Please try again."
        );
      }
    } catch (error) {
      setStatus("error");

      setMessage(
        error.message || "Unable to verify payment."
      );
    }
  }

  useEffect(() => {
    verifyPayment();
  }, [orderId]);

  return (
    <>
      <Header />

      <main className="login-wrap">
        <section
          className="login-card"
          style={{ textAlign: "center" }}
        >
          {status === "checking" && (
            <>
              <h1>Verifying payment...</h1>
              <p className="muted">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div
                style={{
                  fontSize: "64px",
                  color: "#16a34a"
                }}
              >
                ✓
              </div>

              <p className="eyebrow">PAYMENT CONFIRMED</p>

              <h1>Thank you!</h1>

              <p className="muted">{message}</p>

              <div
                style={{
                  background: "#f0fdf4",
                  padding: "20px",
                  borderRadius: "12px",
                  margin: "24px 0",
                  textAlign: "left"
                }}
              >
                <p><strong>Order ID:</strong></p>
                <p>{details?.orderId}</p>

                <p><strong>Order status:</strong></p>
                <p>Confirmed</p>

                <p><strong>Invoice ID:</strong></p>
                <p>{details?.invoiceId}</p>
              </div>

              <p className="muted">
                Your order has been received successfully.
                Thank you for choosing Northstar!
              </p>

              <Link className="primary-button full" to="/">
                Back to Home
              </Link>
            </>
          )}

          {status === "pending" && (
            <>
              <h1>Payment Pending</h1>

              <p className="muted">{message}</p>

              <button
                className="primary-button full"
                onClick={verifyPayment}
              >
                Check Payment Again
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <h1>Unable to Confirm Payment</h1>

              <p className="muted">{message}</p>

              <button
                className="primary-button full"
                onClick={verifyPayment}
              >
                Retry Verification
              </button>
            </>
          )}
        </section>
      </main>
    </>
  );
}

// ==========================================
// APPLICATION ROUTES
// ==========================================

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<PublicHome />}
      />

      <Route
        path="/admin/login"
        element={<Login />}
      />

      <Route
        path="/payment-status"
        element={<PaymentStatus />}
      />

      <Route
        path="/admin"
        element={
          <Protected>
            <AdminDashboard />
          </Protected>
        }
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}