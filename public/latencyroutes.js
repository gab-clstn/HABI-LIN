// ─────────────────────────────────────────────────────────────────────────────
// latencyRoutes.js  —  Drop this file next to your other route files
//
// SETUP IN server.js / app.js:
//   const latencyRoutes = require('./routes/latencyRoutes');
//   app.use('/api/latency', latencyRoutes);
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// MONGOOSE SCHEMA
//
// Each document = one weaving session's worth of latency events.
// Individual events are stored as a sub-array so we can query:
//   • "all events for pattern X"
//   • "average latency over last 7 days"
//   • "worst-latency events per session"
// ─────────────────────────────────────────────────────────────────────────────

const LatencyEventSchema = new mongoose.Schema({
    ts:             { type: Number,  required: true },  // Date.now() wall-clock
    label:          { type: String,  default: "unknown" }, // raw hardware signal
    bleToHandler:   { type: Number,  default: 0 },      // ms
    handlerToFrame: { type: Number,  default: 0 },      // ms
    totalLatency:   { type: Number,  default: 0 },      // ms
}, { _id: false });

const LatencySessionSchema = new mongoose.Schema({
    patternId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Pattern', default: null },
    patternName: { type: String, default: "Unknown Pattern" },
    sessionStart:{ type: Date, default: Date.now },
    events:      { type: [LatencyEventSchema], default: [] },

    // Computed summary fields — updated on every write so dashboard queries are fast
    summary: {
        totalEvents:       { type: Number, default: 0 },
        avgBleToHandler:   { type: Number, default: 0 },  // ms
        avgHandlerToFrame: { type: Number, default: 0 },  // ms
        avgTotalLatency:   { type: Number, default: 0 },  // ms
        minTotalLatency:   { type: Number, default: 0 },  // ms
        maxTotalLatency:   { type: Number, default: 0 },  // ms
        p95TotalLatency:   { type: Number, default: 0 },  // ms — 95th percentile
    },
}, { timestamps: true });

// Helper: recompute summary from the events array
function computeSummary(events) {
    if (!events || events.length === 0) {
        return { totalEvents: 0, avgBleToHandler: 0, avgHandlerToFrame: 0, avgTotalLatency: 0, minTotalLatency: 0, maxTotalLatency: 0, p95TotalLatency: 0 };
    }
    const totals = events.map(e => e.totalLatency).sort((a, b) => a - b);
    const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
    const p95idx = Math.floor(totals.length * 0.95);
    return {
        totalEvents:       events.length,
        avgBleToHandler:   Math.round(avg(events.map(e => e.bleToHandler))   * 100) / 100,
        avgHandlerToFrame: Math.round(avg(events.map(e => e.handlerToFrame)) * 100) / 100,
        avgTotalLatency:   Math.round(avg(totals) * 100) / 100,
        minTotalLatency:   totals[0],
        maxTotalLatency:   totals[totals.length - 1],
        p95TotalLatency:   totals[Math.min(p95idx, totals.length - 1)],
    };
}

// Avoid re-registering model if hot-reloaded (common in dev with nodemon)
const LatencySession = mongoose.models.LatencySession
    || mongoose.model('LatencySession', LatencySessionSchema);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/latency
// Body: { patternId, patternName, events: [ { ts, label, bleToHandler, handlerToFrame, totalLatency } ] }
// Called once at pattern save — bulk-writes the whole session history.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { patternId, patternName, events } = req.body;
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ error: 'events array required' });
        }

        const summary = computeSummary(events);

        const doc = await LatencySession.create({
            patternId:   patternId || null,
            patternName: patternName || "Unknown",
            events,
            summary,
        });

        res.status(201).json({ ok: true, sessionId: doc._id, summary });
    } catch (err) {
        console.error('[Latency] POST / error:', err);
        res.status(500).json({ error: 'Failed to save latency session' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/latency/event
// Body: { patternId, patternName, event: { ts, label, bleToHandler, handlerToFrame, totalLatency } }
// Called on every beat — streams individual events in real-time.
// Upserts into an "open" session for this patternId (or creates one).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/event', async (req, res) => {
    try {
        const { patternId, patternName, event } = req.body;
        if (!event || typeof event.totalLatency !== 'number') {
            return res.status(400).json({ error: 'valid event object required' });
        }

        // Find today's open session for this pattern, or create a new one
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let session = await LatencySession.findOne({
            patternId: patternId || null,
            sessionStart: { $gte: todayStart },
        }).sort({ sessionStart: -1 });

        if (!session) {
            session = new LatencySession({
                patternId:   patternId || null,
                patternName: patternName || "Unknown",
                events:      [],
            });
        }

        session.events.push(event);
        session.summary = computeSummary(session.events);
        await session.save();

        res.status(200).json({ ok: true, eventCount: session.events.length });
    } catch (err) {
        console.error('[Latency] POST /event error:', err);
        res.status(500).json({ error: 'Failed to save latency event' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/latency
// Returns all sessions, newest first, summary only (no full event arrays).
// Optional query params:
//   ?patternId=<id>    — filter by pattern
//   ?limit=<n>         — max results (default 50)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { patternId, limit = 50 } = req.query;
        const filter = {};
        if (patternId) filter.patternId = patternId;

        const sessions = await LatencySession
            .find(filter, { events: 0 })    // exclude raw events for list view
            .sort({ sessionStart: -1 })
            .limit(parseInt(limit));

        res.json(sessions);
    } catch (err) {
        console.error('[Latency] GET / error:', err);
        res.status(500).json({ error: 'Failed to fetch latency sessions' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/latency/:sessionId
// Returns full session including all events (for drill-down views).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:sessionId', async (req, res) => {
    try {
        const session = await LatencySession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (err) {
        console.error('[Latency] GET /:id error:', err);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/latency/stats/overview
// Returns aggregate stats across all sessions — useful for the dashboard.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats/overview', async (req, res) => {
    try {
        const result = await LatencySession.aggregate([
            { $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                totalEvents:   { $sum: "$summary.totalEvents" },
                overallAvgBle:   { $avg: "$summary.avgBleToHandler" },
                overallAvgFrame: { $avg: "$summary.avgHandlerToFrame" },
                overallAvgTotal: { $avg: "$summary.avgTotalLatency" },
                overallP95:      { $avg: "$summary.p95TotalLatency" },
                bestSession:     { $min: "$summary.avgTotalLatency" },
                worstSession:    { $max: "$summary.avgTotalLatency" },
            }},
            { $project: {
                _id: 0,
                totalSessions: 1,
                totalEvents: 1,
                overallAvgBle:   { $round: ["$overallAvgBle",   2] },
                overallAvgFrame: { $round: ["$overallAvgFrame", 2] },
                overallAvgTotal: { $round: ["$overallAvgTotal", 2] },
                overallP95:      { $round: ["$overallP95",      2] },
                bestSession:     { $round: ["$bestSession",     2] },
                worstSession:    { $round: ["$worstSession",    2] },
            }}
        ]);
        res.json(result[0] || {});
    } catch (err) {
        console.error('[Latency] GET /stats/overview error:', err);
        res.status(500).json({ error: 'Failed to compute overview stats' });
    }
});

module.exports = router;