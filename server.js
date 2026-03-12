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
const isProduction = process.env.NODE_ENV === "production";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------ PROFILE PHOTO STORAGE ------------------ */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "public/uploads"));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage });

// ── Trust Railway's reverse proxy (REQUIRED for HTTPS cookies in production) ──
if (isProduction) {
    app.set("trust proxy", 1);
}

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
        userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name:        { type: String,  default: "Untitled Weave" },
        creator:     { type: String,  default: "Unknown Weaver" },
        isImported:  { type: Boolean, default: false },
        isPrivate:   { type: Boolean, default: true }, // ADDED PRIVACY DEFAULT
        type:        { type: String,  default: "plain" },
        loom:        { type: String,  default: "standard" },
        steps:       { type: mongoose.Schema.Types.Mixed, default: [] },
        patternRows: { type: mongoose.Schema.Types.Mixed, default: [] },
        weftColor:   { type: String,  default: "#f0eadf" },
        created:     { type: Number,  default: () => Date.now() }
    },
    { strict: false }
);
const Pattern = mongoose.model("Pattern", patternSchema);

// ── Session ───────────────────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || "local-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, 
        sameSite: isProduction ? "none" : "lax",
        sameSite: "lax",
        secure: isProduction
    }
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

// ── Google OAuth (only register if credentials are present) ──
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  `${process.env.BASE_URL}/auth/google/callback`
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Safely grab email and photo (preventing "undefined" crashes)
            const email = profile.emails?.[0]?.value;
            const photo = profile.photos?.[0]?.value || "";

            if (!email) {
                return done(null, false, { message: "No email provided from Google" });
            }

            let user = await User.findOne({ providerId: profile.id });
            if (!user) {
                user = await User.findOne({ email: email });
                if (user) {
                    user.providerId = profile.id;
                    user.provider   = "google";
                    user.photo      = photo;
                    await user.save();
                } else {
                    user = await User.create({
                        name: profile.displayName || "Weaver", 
                        email: email,
                        provider: "google", 
                        providerId: profile.id, 
                        photo: photo
                    });
                }
            }
            return done(null, user);
        } catch (err) { 
            console.error("Google Auth Error:", err); 
            return done(err); 
        }
    }));
}

// ── Facebook OAuth (only register if credentials are present) ──
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
        clientID:      process.env.FACEBOOK_APP_ID,
        clientSecret:  process.env.FACEBOOK_APP_SECRET,
        callbackURL:   `${process.env.BASE_URL}/auth/facebook/callback`,
        profileFields: ["id", "displayName", "photos", "emails"]
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ providerId: profile.id });
            if (!user) {
                const email = profile.emails?.[0]?.value;
                if (email) user = await User.findOne({ email });
                if (user) {
                    user.providerId = profile.id;
                    user.provider   = "facebook";
                    user.photo      = profile.photos?.[0]?.value;
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
}

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

// ── OAuth routes with graceful fallback if not configured ──
app.get("/auth/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.redirect("/login.html?error=google-not-configured");
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});
app.get("/auth/google/callback", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.redirect("/login.html");
    passport.authenticate("google", { failureRedirect: "/login.html" })(req, res, next);
}, (req, res) => res.redirect("/dashboard.html"));

app.get("/auth/facebook", (req, res, next) => {
    if (!process.env.FACEBOOK_APP_ID) return res.redirect("/login.html?error=facebook-not-configured");
    passport.authenticate("facebook", { scope: ["public_profile"] })(req, res, next);
});
app.get("/auth/facebook/callback", (req, res, next) => {
    if (!process.env.FACEBOOK_APP_ID) return res.redirect("/login.html");
    passport.authenticate("facebook", { failureRedirect: "/login.html" })(req, res, next);
}, (req, res) => res.redirect("/dashboard.html"));

app.get("/auth/user", (req, res) => {
    if (!req.user) return res.json(null);
    res.json({ 
        _id: req.user._id, 
        name: req.user.name, 
        email: req.user.email, 
        photo: req.user.photo, 
        theme: req.user.theme || "light",
        provider: req.user.provider || "local"
    });
});

app.post("/auth/update-account", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Please log in again." });
    try {
        const updated = await User.findByIdAndUpdate(
            req.user._id, { name: req.body.name, email: req.body.email }, { returnDocument: 'after' }
        );
        if (!updated) return res.status(404).json({ error: "User not found" });
        req.user.name  = updated.name;
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
   PATTERN ROUTES (CONSOLIDATED)
══════════════════════════════════════════════════════════════ */

// 1. GET ALL VISIBLE PATTERNS (Community + My Private Imports)
app.get("/api/patterns", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const patterns = await Pattern.find({
            $or: [
                // If it's not imported, only show it if it's public OR if the logged-in user owns it
                { isImported: { $ne: true }, $or: [{ isPrivate: false }, { userId: req.user._id }] }, 
                // Imported patterns are visible to the owner
                { userId: req.user._id, isImported: true } 
            ]
        })
        .populate("userId", "name") 
        .sort({ created: -1 })
        .lean();

        const fixedPatterns = patterns.map(p => ({
            ...p,
            creator: p.userId ? p.userId.name : "Unknown Weaver"
        }));

        res.json(fixedPatterns);
    } catch (err) {
        console.error("Pattern Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch patterns" });
    }
});

// 2. GET ONLY MY NATIVE PATTERNS (For Dashboard/Profile stats count)
app.get("/api/patterns/my-weaves", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const patterns = await Pattern.find({ 
            userId: req.user._id,
            isImported: { $ne: true } 
        }).sort({ created: -1 });
        res.json(patterns);
    } catch (err) { 
        res.status(500).json({ error: "Failed to fetch my patterns" }); 
    }
});

// 3. SAVE PATTERN (Automatically links userId and creator)
app.post("/api/patterns/save", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const newPattern = await Pattern.create({
            ...req.body,
            userId: req.user._id,
            creator: req.body.creator || req.user.name, 
            created: req.body.created || Date.now()
        });
        res.status(200).json({ message: "Pattern saved successfully!", pattern: newPattern });
    } catch (err) {
        console.error("Pattern Save Error:", err);
        res.status(500).json({ error: "Failed to save pattern" });
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

// --- UPDATE PATTERN PRIVACY ---
app.patch('/api/patterns/:id/privacy', async (req, res) => {
    try {
        // FIXED: Use req.user instead of req.session for Passport auth
        if (!req.user) {
             return res.status(401).json({ error: "Unauthorized" });
        }

        const patternId = req.params.id;
        const newPrivacyState = req.body.isPrivate;

        // Ensure the pattern belongs to the logged-in user before updating
        const updatedPattern = await Pattern.findOneAndUpdate(
            { _id: patternId, userId: req.user._id },
            { isPrivate: newPrivacyState },
            { new: true }
        );

        if (!updatedPattern) {
            return res.status(404).json({ error: "Pattern not found or unauthorized" });
        }

        res.status(200).json({ message: "Privacy updated successfully" });
    } catch (error) {
        console.error("Error updating privacy:", error);
        res.status(500).json({ error: "Failed to update privacy" });
    }
});

const PORT = process.env.PORT || 3000;

// ── Global Error Handler ──
app.use((err, req, res, next) => {
    console.error("Server Error Caught:", err.message);
    
    // If the error happened during the Google callback, redirect them safely
    if (req.path.includes('/auth/google/callback')) {
        return res.redirect('/login.html?error=oauth-failed');
    }
    
    res.status(500).json({ error: "Something went wrong on our end." });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📦 Environment: ${isProduction ? "production" : "development"}`);
    console.log(`🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? "enabled" : "disabled (no credentials)"}`);
    console.log(`🔐 Facebook OAuth: ${process.env.FACEBOOK_APP_ID ? "enabled" : "disabled (no credentials)"}`);
});
