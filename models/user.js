import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String
    },
    provider: {
        type: String,
        default: "local"
    },
    providerId: {
        type: String
    },
    photo: {
        type: String,
        default: "" // Keep it as a string for Base64 data
    },
    theme: {
        type: String,
        enum: ["light", "dark"],
        default: "light"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("User", userSchema);
