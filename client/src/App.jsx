import { useEffect, useState } from "react";
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
const statuses = ["New", "Contacted", "Interested", "Converted", "Not Interested"];
const blankForm = { customerName: "", mobile: "", email: "", service: "", message: "" };

function Header({ admin = false }) {
  return <header className="topbar"><Link className="brand" to="/">northstar<span>CRM</span></Link>
    <nav>{admin ? <Link to="/admin">Dashboard</Link> : <a href="#contact">Contact</a>}
      <Link className="nav-button" to={admin ? "/" : "/admin/login"}>{admin ? "Public website" : "Admin login"}</Link>
    </nav>
  </header>;
}

function PublicHome() {
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [errors, setErrors] = useState({});
  function change(e) { setForm({ ...form, [e.target.name]: e.target.value }); setErrors({ ...errors, [e.target.name]: "" }); }
  function validate() {
    const next = {};
    if (form.customerName.trim().length < 2) next.customerName = "Please enter your name.";
    if (!/^[+]?[\d\s()-]{10,18}$/.test(form.mobile.trim())) next.mobile = "Enter a valid mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!services.includes(form.service)) next.service = "Please select a service.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function submit(e) {
  e.preventDefault();
  setNotice({ type: "", text: "" });

  if (!validate() || busy) return;

  setBusy(true);

  try {
    // Submit enquiry and create Cashfree order.
    const result = await api("/api/leads", {
      method: "POST",
      body: JSON.stringify(form)
    });

    if (!result.paymentSessionId) {
      throw new Error("Payment session was not generated.");
    }

    // Initialize Cashfree Sandbox checkout.
    const cashfree = await load({
      mode: "sandbox"
    });

    if (!cashfree) {
      throw new Error("Unable to load Cashfree checkout.");
    }

    // Open payment checkout.
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
  return <><Header /><main>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">LET'S BUILD SOMETHING BETTER</p>
      <h1>Good things start with a <em>conversation.</em></h1>
      <p className="hero-text">Tell us what you're looking for. Our team will get back to you to understand your needs and explore the right solution.</p>
      <div className="trust-row"><span>✓ Personal response</span><span>✓ No obligation</span></div></div>
      <div className="hero-art"><div className="orb orb-one"></div><div className="orb orb-two"></div><div className="art-card"><span className="art-icon">✳</span><strong>Your next idea<br/>starts here.</strong><small>We're ready when you are.</small></div></div>
    </section>
    <section className="contact-section" id="contact"><div className="section-intro"><p className="eyebrow">GET IN TOUCH</p><h2>Tell us a little about<br/>what you need.</h2><p>Fill in the form and we'll be in touch.</p></div>
      <form className="lead-form" onSubmit={submit} noValidate>
        {notice.text && <div className={`notice ${notice.type}`}>{notice.text}</div>}
        <div className="field"><label htmlFor="customerName">Your name *</label><input id="customerName" name="customerName" value={form.customerName} onChange={change} placeholder="e.g. Aarav Patil"/>{errors.customerName && <small className="field-error">{errors.customerName}</small>}</div>
        <div className="field-row"><div className="field"><label htmlFor="mobile">Mobile number *</label><input id="mobile" name="mobile" value={form.mobile} onChange={change} placeholder="+91 98765 43210"/>{errors.mobile && <small className="field-error">{errors.mobile}</small>}</div>
          <div className="field"><label htmlFor="email">Email address *</label><input id="email" type="email" name="email" value={form.email} onChange={change} placeholder="you@example.com"/>{errors.email && <small className="field-error">{errors.email}</small>}</div></div>
        <div className="field"><label htmlFor="service">Service interested in *</label><select id="service" name="service" value={form.service} onChange={change}><option value="">Choose a service</option>{services.map(s => <option key={s}>{s}</option>)}</select>{errors.service && <small className="field-error">{errors.service}</small>}</div>
        <div className="field"><label htmlFor="message">Additional message <span className="optional">Optional</span></label><textarea id="message" name="message" rows="4" value={form.message} onChange={change} placeholder="Tell us a little more about your requirements..."/></div>
        <button className="primary-button full" disabled={busy}>{busy ? "Submitting..." : "Submit your enquiry"} <span>→</span></button>
        <p className="form-footnote">Your information will only be used to respond to your enquiry.</p>
      </form>
    </section>
  </main><footer>© {new Date().getFullYear()} Northstar. Built to make every enquiry count.</footer></>;
}

function Login() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("crm_token", result.token); navigate("/admin");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <><Header /><main className="login-wrap"><form className="login-card" onSubmit={submit}><p className="eyebrow">NORTHSTAR CRM</p><h1>Welcome back.</h1><p className="muted">Sign in to manage your leads.</p>
    {error && <div className="notice error">{error}</div>}
    <div className="field"><label>Email address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></div>
    <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required/></div>
    <button className="primary-button full" disabled={busy}>{busy ? "Signing in..." : "Sign in"} <span>→</span></button>
    <Link className="back-link" to="/">← Back to website</Link></form></main></>;
}

function Protected({ children }) {
  const [valid, setValid] = useState(null);
  useEffect(() => { api("/api/auth/me").then(() => setValid(true)).catch(() => { localStorage.removeItem("crm_token"); setValid(false); }); }, []);
  if (valid === null) return <div className="center-state">Checking your session...</div>;
  return valid ? children : <Navigate to="/admin/login" replace/>;
}

function AdminDashboard() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({ total: 0, new: 0, contacted: 0, converted: 0 });
  const [search, setSearch] = useState("");
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [remark, setRemark] = useState("");
  const [newStatus, setNewStatus] = useState("New");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const navigate = useNavigate();

  async function load() {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (service) params.set("service", service);
      if (status) params.set("status", status);
      const [leadData, statData] = await Promise.all([api(`/api/leads?${params}`), api("/api/leads/stats")]);
      setLeads(leadData.leads); setStats(statData);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [search, service, status]);
  async function openLead(id) {
    try { const data = await api(`/api/leads/${id}`); setSelected(data.lead); setNewStatus(data.lead.status); setRemark(data.lead.internalRemarks || ""); }
    catch (err) { setError(err.message); }
  }
  async function saveLead() {
    setSaving(true);
    try {
      await api(`/api/leads/${selected.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus, internalRemarks: remark }) });
      setSelected(null); setToast("Lead updated successfully."); await load();
      setTimeout(() => setToast(""), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  function logout() { localStorage.removeItem("crm_token"); navigate("/admin/login"); }

  return <div className="admin-shell"><aside className="sidebar"><Link to="/" className="brand">northstar<span>CRM</span></Link><div className="side-label">WORKSPACE</div><div className="side-active">▦ &nbsp; Lead management</div><div className="sidebar-bottom"><div className="avatar">A</div><div className="admin-label"><strong>Administrator</strong><small>CRM Admin</small></div><button className="logout" onClick={logout} title="Log out">↗</button></div></aside>
    <main className="admin-main"><div className="admin-top"><div><p className="eyebrow">OVERVIEW</p><h1>Lead management</h1><p className="muted">Track enquiries and keep every opportunity moving.</p></div><button className="outline-button" onClick={load}>↻ Refresh</button></div>
      <div className="stats-grid"><Stat label="Total leads" value={stats.total} icon="◫"/><Stat label="New leads" value={stats.new} icon="✳"/><Stat label="Contacted" value={stats.contacted} icon="↗"/><Stat label="Converted" value={stats.converted} icon="✓"/></div>
      <section className="table-card"><div className="table-heading"><div><h2>All leads</h2><p className="muted">Review and manage customer enquiries.</p></div><span className="count-pill">{leads.length} records</span></div>
        <div className="filters"><input aria-label="Search leads" placeholder="⌕  Search name or mobile..." value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Filter service" value={service} onChange={e => setService(e.target.value)}><option value="">All services</option>{services.map(s=><option key={s}>{s}</option>)}</select><select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></div>
        {error && <div className="notice error">{error}</div>}{toast && <div className="notice success">{toast}</div>}
        <div className="table-scroll"><table><thead><tr><th>LEAD</th><th>CONTACT</th><th>SERVICE</th><th>DATE</th><th>STATUS</th><th></th></tr></thead><tbody>
          {loading ? <tr><td colSpan="6" className="empty">Loading leads...</td></tr> : leads.length === 0 ? <tr><td colSpan="6" className="empty">No leads found. Try changing your search or filters.</td></tr> : leads.map(lead=><tr key={lead.id}><td><strong>{lead.customerName}</strong><small className="sub-id">#{lead.id.slice(-7)}</small></td><td>{lead.mobile}<small className="sub-id">{lead.email}</small></td><td>{lead.service}</td><td>{new Date(lead.createdAt).toLocaleDateString()}</td><td><span className={`status status-${lead.status.toLowerCase().replaceAll(" ","-")}`}>{lead.status}</span></td><td><button className="view-button" onClick={()=>openLead(lead.id)}>View ↗</button></td></tr>)}
        </tbody></table></div>
      </section>
    </main>
    {selected && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><section className="detail-modal"><div className="modal-head"><div><p className="eyebrow">LEAD DETAILS</p><h2>{selected.customerName}</h2></div><button className="close-button" onClick={()=>setSelected(null)}>×</button></div>
      <div className="detail-grid"><Detail label="Mobile" value={selected.mobile}/><Detail label="Email" value={selected.email}/><Detail label="Service" value={selected.service}/><Detail label="Submitted" value={new Date(selected.createdAt).toLocaleString()}/></div>
      <div className="detail-message"><label>Customer message</label><p>{selected.message || "No additional message provided."}</p></div>
      <div className="field"><label>Lead status</label><select value={newStatus} onChange={e=>setNewStatus(e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="field"><label>Internal remarks <span className="optional">Only visible to admins</span></label><textarea rows="4" value={remark} onChange={e=>setRemark(e.target.value)} placeholder="Add call notes or next steps..."/></div>
      <button className="primary-button full" disabled={saving} onClick={saveLead}>{saving ? "Saving..." : "Save changes"} <span>→</span></button>
    </section></div>}
  </div>;
}
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
      <p>{value}</p>
    </div>
  );
}
function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");

  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Verifying your payment...");
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
        setMessage("Your payment has been received and your order is confirmed.");
        setDetails(result);
      } else {
        setStatus("pending");
        setMessage("Your payment is not confirmed yet. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Unable to verify payment.");
    }
  }

  useEffect(() => {
    verifyPayment();
  }, [orderId]);

  return (
    <>
      <Header />

      <main className="login-wrap">
        <section className="login-card" style={{ textAlign: "center" }}>

          {status === "checking" && (
            <>
              <h1>Verifying payment...</h1>
              <p className="muted">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div style={{ fontSize: "64px", color: "#16a34a" }}>
                ✓
              </div>

              <p className="eyebrow">PAYMENT CONFIRMED</p>
              <h1>Thank you!</h1>

              <p className="muted">{message}</p>

              <div style={{
                background: "#f0fdf4",
                padding: "20px",
                borderRadius: "12px",
                margin: "24px 0",
                textAlign: "left"
              }}>
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
              <button className="primary-button full" onClick={verifyPayment}>
                Check Payment Again
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <h1>Unable to Confirm Payment</h1>
              <p className="muted">{message}</p>

              <button className="primary-button full" onClick={verifyPayment}>
                Retry Verification
              </button>
            </>
          )}

        </section>
      </main>
    </>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/payment-status" element={<PaymentStatus />} />
      <Route
        path="/admin"
        element={
          <Protected>
            <AdminDashboard />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
