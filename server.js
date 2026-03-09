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
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "public/uploads"));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage });

app.set("trust proxy", 1);

/* ------------------ Middleware ------------------ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ------------------ MongoDB ------------------ */
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🍃 MongoDB Connected"))
    .catch(err => console.log("❌ MongoDB Error:", err));

/* ------------------ Pattern Schema ------------------ */
const patternSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, default: "Untitled Weave" },
        creator: { type: String, default: "Unknown Weaver" },
        isImported: { type: Boolean, default: false },
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

/* ------------------ Sessions ------------------ */
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static("public"));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try { done(null, await User.findById(id)); }
    catch (err) { done(err); }
});

/* ------------------ BASE URL ------------------ */
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

/* ------------------ Local Strategy ------------------ */
passport.use(new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
        try {
            const user = await User.findOne({ email });

            if (!user || !user.password)
                return done(null, false, { message: "Invalid credentials" });

            const ok = await bcrypt.compare(password, user.password);

            return ok
                ? done(null, user)
                : done(null, false, { message: "Invalid credentials" });

        } catch (err) {
            return done(err);
        }
    }
));

/* ------------------ Google Strategy ------------------ */
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/auth/google/callback`
},
    async (accessToken, refreshToken, profile, done) => {

        try {

            let user = await User.findOne({ providerId: profile.id });

            if (!user) {

                user = await User.findOne({ email: profile.emails[0].value });

                if (user) {
                    user.providerId = profile.id;
                    user.provider = "google";
                    user.photo = profile.photos[0].value;
                    await user.save();
                }

                else {

                    user = await User.create({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        provider: "google",
                        providerId: profile.id,
                        photo: profile.photos[0].value
                    });

                }

            }

            return done(null, user);

        } catch (err) {
            return done(err);
        }

    }));

/* ------------------ Facebook Strategy ------------------ */
passport.use(new FacebookStrategy({

    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${BASE_URL}/auth/facebook/callback`,
    profileFields: ["id", "displayName", "photos", "emails"]

},
    async (accessToken, refreshToken, profile, done) => {

        try {

            let user = await User.findOne({ providerId: profile.id });

            if (!user) {

                const email = profile.emails?.[0]?.value;

                if (email)
                    user = await User.findOne({ email });

                if (user) {

                    user.providerId = profile.id;
                    user.provider = "facebook";
                    user.photo = profile.photos?.[0]?.value;

                    await user.save();

                }

                else {

                    user = await User.create({
                        name: profile.displayName,
                        email,
                        provider: "facebook",
                        providerId: profile.id,
                        photo: profile.photos?.[0]?.value
                    });

                }

            }

            return done(null, user);

        } catch (err) {

            console.error("Facebook Auth Error:", err);
            return done(err);

        }

    }));

/* ------------------ AUTH ROUTES ------------------ */

app.post("/auth/signup", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        if (await User.findOne({ email }))
            return res.status(400).json({ message: "Email already exists" });

        const user = await User.create({
            name,
            email,
            password: await bcrypt.hash(password, 10)
        });

        req.login(user, err =>
            err
                ? res.status(500).json(err)
                : res.json({ message: "Success", user })
        );

    }

    catch (err) {
        res.status(500).json(err);
    }

});

app.post("/auth/login",
    passport.authenticate("local"),
    (req, res) => {
        res.json({ message: "Logged in", user: req.user });
    });

app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login.html" }),
    (req, res) => res.redirect("/dashboard.html")
);

app.get("/auth/facebook",
    passport.authenticate("facebook", { scope: ["public_profile"] }));

app.get("/auth/facebook/callback",
    passport.authenticate("facebook", { failureRedirect: "/login.html" }),
    (req, res) => res.redirect("/dashboard.html")
);

app.get("/auth/user", (req, res) => {

    if (!req.user)
        return res.json(null);

    res.json({
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        photo: req.user.photo,
        theme: req.user.theme || "light",
        provider: req.user.provider || "local"
    });

});

/* ------------------ LOGOUT ------------------ */

app.get("/auth/logout", (req, res, next) => {

    req.logout(err => {

        if (err)
            return next(err);

        req.session.destroy(err => {

            if (err)
                return next(err);

            res.clearCookie("connect.sid");
            res.redirect("/login.html");

        });

    });

});

/* ------------------ SERVER ------------------ */

app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));