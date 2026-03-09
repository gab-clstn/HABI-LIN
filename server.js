import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as FacebookStrategy } from "passport-facebook";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import User from "./models/user.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------ PROFILE PHOTO STORAGE ------------------ */
// Note: Keeping multer config here so your code doesn't break, 
// but we'll use the Base64 route for Atlas/Railway compatibility.
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "public/uploads"));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage });

// ── Middleware ────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── MongoDB ───────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🍃 MongoDB Connected"))
    .catch(err => console.log("❌ MongoDB Error:", err));

/* ──────────────────────────────────────────────────────────────
   PATTERN SCHEMA
────────────────────────────────────────────────────────────── */
const patternSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, default: "Untitled Weave" },
        type: { type: String, default: "plain" },
        loom: { type: String, default: "standard" },
        steps: { type: mongoose.Schema.Types.Mixed, default: [] },
        patternRows: { type: mongoose.Schema.Types.Mixed, default: [] },
        weftColor: { type: String, default: "#f0eadf" },
        created: { type: Number, default: () => Date.now() }
    },
    { strict: false }
);
const Pattern = mongoose.model("Pattern", patternSchema);

// ── Session ───────────────────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000, sameSite: "lax" }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static("public"));

// ── Passport ──────────────────────────────────────────────────
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try { done(null, await User.findById(id)); }
    catch (err) { done(err); }
});

passport.use(new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        if (!user || !user.password) return done(null, false, { message: "Invalid credentials" });
        const ok = await bcrypt.compare(password, user.password);
        return ok ? done(null, user) : done(null, false, { message: "Invalid credentials" });
    } catch (err) { return done(err); }
}));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ providerId: profile.id });
        if (!user) {
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
                user.providerId = profile.id;
                user.provider = "google";
                user.photo = profile.photos[0].value;
                await user.save();
            } else {
                user = await User.create({
                    name: profile.displayName, email: profile.emails[0].value,
                    provider: "google", providerId: profile.id, photo: profile.photos[0].value
                });
            }
        }
        return done(null, user);
    } catch (err) { return done(err); }
}));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/callback",
    profileFields: ["id", "displayName", "photos", "emails"]
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ providerId: profile.id });
        if (!user) {
            const email = profile.emails?.[0]?.value;
            if (email) user = await User.findOne({ email });
            if (user) {
                user.providerId = profile.id;
                user.provider = "facebook";
                user.photo = profile.photos?.[0]?.value;
                await user.save();
            } else {
                user = await User.create({
                    name: profile.displayName, email,
                    provider: "facebook", providerId: profile.id,
                    photo: profile.photos?.[0]?.value
                });
            }
        }
        return done(null, user);
    } catch (err) { console.error("Facebook Auth Error:", err); return done(err); }
}));

/* ══════════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════════ */

app.post("/auth/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ message: "Email already exists" });
        const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
        req.login(user, err => err ? res.status(500).json(err) : res.json({ message: "Success", user }));
    } catch (err) { res.status(500).json(err); }
});

app.post("/auth/login", passport.authenticate("local"), (req, res) => {
    res.json({ message: "Logged in", user: req.user });
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login.html" }), (req, res) => res.redirect("/dashboard.html"));
app.get("/auth/facebook", passport.authenticate("facebook", { scope: ["public_profile"] }));
app.get("/auth/facebook/callback", passport.authenticate("facebook", { failureRedirect: "/login.html" }), (req, res) => res.redirect("/dashboard.html"));
app.get("/auth/user", (req, res) => {
    if (!req.user) return res.json(null);
    res.json({ _id: req.user._id, name: req.user.name, email: req.user.email, photo: req.user.photo, theme: req.user.theme || "light", provider: req.user.provider || "local" });
});

app.post("/auth/update-account", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Please log in again." });
    try {
        const updated = await User.findByIdAndUpdate(
            req.user._id, { name: req.body.name, email: req.body.email }, { returnDocument: 'after' }
        );
        if (!updated) return res.status(404).json({ error: "User not found" });
        req.user.name = updated.name;
        req.user.email = updated.email;
        res.json({ message: "Account updated successfully", user: { name: updated.name, email: updated.email } });
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to update account." }); }
});

app.post("/auth/update-password", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);
        if (!user.password) return res.status(400).json({ error: "Social accounts cannot change password here" });
        if (!await bcrypt.compare(currentPassword, user.password)) return res.status(400).json({ error: "Incorrect current password" });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: "Password updated successfully" });
    } catch (err) { res.status(500).json({ error: "Failed to update password" }); }
});

app.post("/auth/update-theme", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        await User.findByIdAndUpdate(req.user._id, { theme: req.body.theme });
        res.json({ message: "Theme saved" });
    } catch (err) { res.status(500).json({ error: "Failed to save theme" }); }
});

// FIXED: Atlas-compatible photo upload using Base64
app.post("/auth/upload-photo", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const { photo } = req.body;
        if (!photo) return res.status(400).json({ error: "No photo data provided" });

        await User.findByIdAndUpdate(
            req.user._id,
            { photo: photo },
            { returnDocument: "after" }
        );
        res.json({ photo: photo });
    } catch (err) {
        console.error("Photo upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

app.get("/auth/logout", (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.session.destroy(err => {
            if (err) return next(err);
            res.clearCookie("connect.sid");
            res.redirect("/login.html");
        });
    });
});

app.get("/loom", (req, res) => {
    if (!req.user) return res.status(401).json({ allowed: false });
    res.json({ allowed: true });
});

/* ══════════════════════════════════════════════════════════════
   PATTERN ROUTES
══════════════════════════════════════════════════════════════ */

app.post("/api/patterns/save", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const newPattern = await Pattern.create({
            ...req.body,
            userId: req.user._id,
            created: req.body.created || Date.now()
        });
        res.status(200).json({ message: "Pattern saved successfully!", pattern: newPattern });
    } catch (err) {
        console.error("Pattern Save Error:", err);
        res.status(500).json({ error: "Failed to save pattern" });
    }
});

app.get("/api/patterns/my-weaves", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const patterns = await Pattern.find({ userId: req.user._id }).sort({ created: -1 });
        res.json(patterns);
    } catch (err) { res.status(500).json({ error: "Failed to fetch patterns" }); }
});

// FIXED: Filtered to specifically count only the current user's patterns for Profile stats
app.get("/api/patterns", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const patterns = await Pattern.find({ userId: req.user._id }).sort({ created: -1 });
        res.json(patterns);
    } catch (err) {
        console.error("Pattern Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch patterns" });
    }
});

app.delete("/api/patterns/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const pattern = await Pattern.findOne({ _id: req.params.id, userId: req.user._id });
        if (!pattern) return res.status(404).json({ error: "Pattern not found" });
        await pattern.deleteOne();
        res.json({ message: "Pattern deleted successfully" });
    } catch (err) {
        console.error("Pattern Delete Error:", err);
        res.status(500).json({ error: "Failed to delete pattern" });
    }
});

app.put("/api/patterns/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const updatedPattern = await Pattern.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { ...req.body },
            { returnDocument: 'after' }
        );

        if (!updatedPattern) return res.status(404).json({ error: "Pattern not found" });
        res.status(200).json({ message: "Pattern updated successfully!", pattern: updatedPattern });
    } catch (err) {
        console.error("Pattern Update Error:", err);
        res.status(500).json({ error: "Failed to update pattern" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
