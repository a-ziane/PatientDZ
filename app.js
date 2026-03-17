const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const NAVS = {
  patientMarketing: [
    { label: "Overview", href: "/patient" },
    { label: "Sign in", href: "/patient/login" },
    { label: "Pricing", href: "/patient#pricing" }
  ],
  patientApp: [
    { label: "Dashboard", href: "/patient/dashboard" },
    { label: "Search", href: "/patient/search" },
    { label: "Appointments", href: "/patient/appointments" },
    { label: "Records", href: "/patient/records" },
    { label: "Profile", href: "/patient/profile" }
  ],
  doctorMarketing: [
    { label: "Overview", href: "/doctor" },
    { label: "Sign in", href: "/doctor/login" },
    { label: "Pricing", href: "/doctor#pricing" }
  ],
  doctorApp: [
    { label: "Dashboard", href: "/doctor/dashboard" },
    { label: "Appointments", href: "/doctor/appointments" },
    { label: "Calendar", href: "/doctor/calendar" },
    { label: "Patients", href: "/doctor/patients" },
    { label: "Profile", href: "/doctor/profile" }
  ],
  adminApp: [
    { label: "Dashboard", href: "/admin" }
  ]
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "patientdz-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" }
  })
);

const render = (res, view, data = {}) => res.render(view, data);

const requireAuth = (role) => async (req, res, next) => {
  const sessionData = req.session?.auth;
  if (!sessionData?.user) return res.redirect("/" + role);
  if (role !== "any" && sessionData.role !== role) return res.redirect("/" + sessionData.role);
  res.locals.currentUser = sessionData;
  next();
};

// ---- Auth helpers ----
async function signUpWithPhone({ phone, password, name, role }) {
  const { data, error } = await supabase.auth.signUp({ phone, password });
  if (error) throw error;
  const userId = data.user.id;
  await supabaseAdmin.from("profiles").upsert({ id: userId, name, phone, role, verified: role === "doctor" ? false : true });
  return { userId, role, verified: role === "doctor" ? false : true };
}

async function signInWithPhone({ phone, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
  if (error) throw error;
  const userId = data.user.id;
  const { data: profile } = await supabaseAdmin.from("profiles").select("role, verified").eq("id", userId).single();
  return { userId, role: profile?.role || "patient", verified: profile?.verified ?? false };
}

function setSession(req, payload) {
  req.session.auth = { user: payload.userId, role: payload.role, verified: payload.verified };
}

// ---- Patient marketing ----
app.get("/patient", (req, res) => {
  render(res, "pages/patient/landing", { nav: NAVS.patientMarketing, title: "PatientDZ · Patients", pricing: "100 DA (free for first 50 users)" });
});

app.get("/patient/login", (req, res) => {
  render(res, "pages/login", { nav: NAVS.patientMarketing, title: "Patient Login", action: "/patient/login", role: "patient" });
});

app.post("/patient/login", async (req, res) => {
  const { phone, password } = req.body;
  try {
    const sessionData = await signInWithPhone({ phone, password });
    setSession(req, sessionData);
    return res.redirect("/patient/dashboard");
  } catch (err) {
    console.error("Patient login error", err.message);
    return res.redirect("/patient/login");
  }
});

app.post("/patient/signup", async (req, res) => {
  const { name, phone, password } = req.body;
  try {
    const sessionData = await signUpWithPhone({ phone, password, name, role: "patient" });
    setSession(req, sessionData);
    return res.redirect("/patient/dashboard");
  } catch (err) {
    console.error("Patient signup error", err.message);
    return res.redirect("/patient");
  }
});

// ---- Patient app ----
app.get("/patient/dashboard", requireAuth("patient"), (req, res) => {
  render(res, "pages/patient/dashboard", { nav: NAVS.patientApp, title: "Patient Dashboard" });
});

app.get("/patient/search", requireAuth("patient"), (req, res) => {
  render(res, "pages/patient/search", { nav: NAVS.patientApp, title: "Search Doctors" });
});

app.get("/patient/search/doctor", requireAuth("patient"), (req, res) => {
  render(res, "pages/patient/doctor", { nav: NAVS.patientApp, title: "Doctor Profile" });
});

app.get("/patient/search/doctor/book", requireAuth("patient"), (req, res) => {
  render(res, "pages/patient/book", { nav: NAVS.patientApp, title: "Book Appointment" });
});

app.get("/patient/appointments", requireAuth("patient"), (req, res) => {
  render(res, "pages/patient/appointments", { nav: NAVS.patientApp, title: "Appointments" });
});

app.get("/patient/records", requireAuth("patient"), (req, res) => {
  render(res, "pages/patient/records", { nav: NAVS.patientApp, title: "Records" });
});

app.get("/patient/profile", requireAuth("patient"), (req, res) => {
  render(res, "pages/patient/profile", { nav: NAVS.patientApp, title: "Profile" });
});

// ---- Doctor marketing ----
app.get("/doctor", (req, res) => {
  render(res, "pages/doctor/landing", { nav: NAVS.doctorMarketing, title: "PatientDZ · Doctors", pricing: "5000 DA (free for first 50)" });
});

app.get("/doctor/login", (req, res) => {
  render(res, "pages/login", { nav: NAVS.doctorMarketing, title: "Doctor Login", action: "/doctor/login", role: "doctor" });
});

app.post("/doctor/login", async (req, res) => {
  const { phone, password } = req.body;
  try {
    const sessionData = await signInWithPhone({ phone, password });
    setSession(req, sessionData);
    if (!sessionData.verified) return res.redirect("/doctor/pending");
    return res.redirect("/doctor/dashboard");
  } catch (err) {
    console.error("Doctor login error", err.message);
    return res.redirect("/doctor/login");
  }
});

app.post("/doctor/signup", async (req, res) => {
  const { name, phone, password } = req.body;
  try {
    const sessionData = await signUpWithPhone({ phone, password, name, role: "doctor" });
    setSession(req, sessionData);
    return res.redirect("/doctor/pending");
  } catch (err) {
    console.error("Doctor signup error", err.message);
    return res.redirect("/doctor");
  }
});

// ---- Doctor app ----
app.get("/doctor/dashboard", requireAuth("doctor"), (req, res) => {
  if (!req.session.auth.verified) return res.redirect("/doctor/pending");
  render(res, "pages/doctor/dashboard", { nav: NAVS.doctorApp, title: "Doctor Dashboard" });
});

app.get("/doctor/appointments", requireAuth("doctor"), (req, res) => {
  render(res, "pages/doctor/appointments", { nav: NAVS.doctorApp, title: "Appointments" });
});

app.get("/doctor/calendar", requireAuth("doctor"), (req, res) => {
  render(res, "pages/doctor/calendar", { nav: NAVS.doctorApp, title: "Calendar" });
});

app.get("/doctor/patients", requireAuth("doctor"), (req, res) => {
  render(res, "pages/doctor/patients", { nav: NAVS.doctorApp, title: "Patients" });
});

app.get("/doctor/profile", requireAuth("doctor"), (req, res) => {
  render(res, "pages/doctor/profile", { nav: NAVS.doctorApp, title: "Profile" });
});

app.get("/doctor/pending", requireAuth("doctor"), (req, res) => {
  render(res, "pages/doctor/pending", { nav: NAVS.doctorMarketing, title: "Verification Pending" });
});

// ---- Admin ----
app.get("/admin", requireAuth("admin"), (req, res) => {
  render(res, "pages/admin/dashboard", { nav: NAVS.adminApp, title: "Admin" });
});

// ---- Logout ----
app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ---- 404 ----
app.use((req, res) => {
  res.status(404).render("pages/404", { title: "Not Found", nav: [] });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`PatientDZ running on http://localhost:${PORT}`));
}

module.exports = app;
