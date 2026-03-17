const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const SCHEMA = "patientdz_db";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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

const nav = [
  { label: "Home", href: "/" },
  { label: "Patient", href: "/patient" },
  { label: "Doctor", href: "/doctor" },
  { label: "Admin", href: "/admin" },
  { label: "Login", href: "/login" },
  { label: "Signup", href: "/signup" }
];

const renderPage = (res, page, data = {}) => {
  res.render(page, {
    nav,
    currentUser: res.locals.currentUser,
    ...data
  });
};

const requireAuth = (req, res, next) => {
  if (!req.session?.auth?.userId) return res.redirect("/login");
  return next();
};

const requireRole = (role) => (req, res, next) => {
  if (!req.session?.auth?.role) return res.redirect("/login");
  if (req.session.auth.role !== role) return res.redirect("/");
  if (role === "doctor" && req.session.auth.verified === false) {
    return res.redirect("/doctor/pending");
  }
  return next();
};

app.use((req, res, next) => {
  res.locals.currentUser = req.session?.auth || null;
  next();
});

app.get("/", (req, res) => {
  renderPage(res, "pages/home", { title: "PatientDZ" });
});

app.get("/login", (req, res) => {
  renderPage(res, "pages/login", { title: "Login · PatientDZ" });
});

app.post("/auth/login", async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.redirect("/login");
  try {
    const { rows } = await pool.query(
      `select id, role, password_hash, verified from ${SCHEMA}.profiles where phone = $1`,
      [phone]
    );
    const user = rows[0];
    if (!user) return res.redirect("/login");
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.redirect("/login");
    req.session.auth = { userId: user.id, role: user.role, verified: user.verified };
    if (user.role === "doctor") return res.redirect("/doctor");
    if (user.role === "admin") return res.redirect("/admin");
    return res.redirect("/patient");
  } catch (err) {
    console.error("Login error", err.message);
    return res.redirect("/login");
  }
});

app.get("/signup", (req, res) => {
  renderPage(res, "pages/signup", { title: "Signup · PatientDZ" });
});

app.post("/auth/signup", async (req, res) => {
  const { name, phone, password, role } = req.body;
  if (!name || !phone || !password || !role) return res.redirect("/signup");
  if (!["patient", "doctor"].includes(role)) return res.redirect("/signup");
  try {
    const hash = await bcrypt.hash(password, 10);
    const verified = role === "doctor" ? false : true;
    const { rows } = await pool.query(
      `insert into ${SCHEMA}.profiles (name, phone, password_hash, role, verified) values ($1,$2,$3,$4,$5) returning id, role, verified`,
      [name, phone, hash, role, verified]
    );
    const user = rows[0];
    req.session.auth = { userId: user.id, role: user.role, verified: user.verified };
    if (user.role === "doctor") return res.redirect("/doctor/pending");
    return res.redirect("/patient");
  } catch (err) {
    console.error("Signup error", err.message);
    return res.redirect("/signup");
  }
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/patient", requireAuth, requireRole("patient"), (req, res) => {
  renderPage(res, "pages/patient/dashboard", { title: "Patient Dashboard" });
});

app.get("/doctor", requireAuth, requireRole("doctor"), (req, res) => {
  renderPage(res, "pages/doctor/dashboard", { title: "Doctor Dashboard" });
});

app.get("/doctor/pending", requireAuth, (req, res) => {
  if (req.session?.auth?.role !== "doctor") return res.redirect("/");
  renderPage(res, "pages/doctor/pending", { title: "Verification Pending" });
});

app.get("/admin", requireAuth, requireRole("admin"), (req, res) => {
  renderPage(res, "pages/admin/dashboard", { title: "Admin Panel" });
});

app.use((req, res) => {
  res.status(404).render("pages/404", { title: "Not Found", nav });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`PatientDZ running on http://localhost:${PORT}`));
}

module.exports = app;
