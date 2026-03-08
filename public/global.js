/* =========================================
   GLOBAL.JS — HABI-LIN
   Runs on EVERY page via <script src="global.js">
   Handles:
     1. Theme (dark/light) — applied IMMEDIATELY, before DOM paint
     2. Language — applied on DOMContentLoaded
   ========================================= */

/* =========================================
   1. DARK MODE — INSTANT APPLICATION
   ========================================= */
(function applyThemeImmediately() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark-mode");
    } else {
        document.documentElement.classList.remove("dark-mode");
    }
})();

/* =========================================
   2. DARK MODE CSS
   Palette: Mono — pure dark grey, no accent color
   --bg:      #1c1c1e  (deep charcoal)
   --surface: #242426  (card surface)
   --brand:   #a0a0a8  (neutral grey accent)
   ========================================= */
(function injectDarkModeStyles() {
    const style = document.createElement("style");
    style.id = "global-dark-mode-styles";
    style.textContent = `

        /* ── DARK MODE VARIABLE OVERRIDES ── */
        html.dark-mode,
        html.dark-mode body {
            --bg:           #1c1c1e !important;
            --surface:      #242426 !important;
            --border-color: #313135 !important;
            --border:       #313135 !important;
            --text:         #e5e5e7 !important;
            --text-muted:   #98989f !important;
            --text-faint:   #545458 !important;
            --brand:        #a0a0a8 !important;
            --brand-mid:    #8a8a92 !important;
            --brand-light:  #2c2c2e !important;
            --danger:       #e05555 !important;
        }

        /* ── PAGE BACKGROUNDS ── */
        html.dark-mode body {
            background: #1c1c1e !important;
            color: #e5e5e7 !important;
        }

        /* ── NAVBAR / SIDEBAR ── */
        html.dark-mode .sidebar {
            background: #18181a !important;
            border-bottom-color: #313135 !important;
            box-shadow: 0 2px 16px rgba(0,0,0,0.4) !important;
        }

        /* ── LOGO ── */
        html.dark-mode .sidebar-header h2,
        html.dark-mode .logo-link h2 {
            color: #e5e5e7 !important;
        }

        /* ── MOBILE DRAWER ── */
        html.dark-mode .mobile-drawer {
            background: #18181a !important;
            border-bottom-color: #313135 !important;
        }

        /* ── NAV ITEMS ── */
        html.dark-mode .nav-item {
            color: #98989f !important;
        }

        html.dark-mode .nav-item:hover {
            color: #e5e5e7 !important;
            background: #2c2c2e !important;
        }

        html.dark-mode .nav-item.active {
            color: #e5e5e7 !important;
        }

        html.dark-mode .nav-item::after {
            background: #a0a0a8 !important;
        }

        html.dark-mode .logout {
            color: #e05555 !important;
        }

        /* ── USER INFO TEXT ── */
        html.dark-mode .greeting {
            color: #545458 !important;
        }

        html.dark-mode .user-info strong {
            color: #e5e5e7 !important;
        }

        /* ── PROFILE CIRCLE ── */
        html.dark-mode .profile-circle {
            background: #2c2c2e !important;
            border-color: #313135 !important;
            color: #98989f !important;
        }

        /* ── SEARCH BAR ── */
        html.dark-mode .search-container {
            background: #2c2c2e !important;
            border-color: transparent !important;
        }

        html.dark-mode .search-container:focus-within {
            background: #242426 !important;
            border-color: #545458 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        }

        html.dark-mode .search-input {
            color: #e5e5e7 !important;
        }

        html.dark-mode .search-icon-btn {
            color: #545458 !important;
        }

        html.dark-mode .mobile-search {
            background: #2c2c2e !important;
            border-color: transparent !important;
        }

        html.dark-mode .mobile-search:focus-within {
            background: #242426 !important;
            border-color: #545458 !important;
        }

        html.dark-mode .mobile-search input {
            color: #e5e5e7 !important;
        }

        /* ── CARDS & SURFACES ── */
        html.dark-mode .detail-card,
        html.dark-mode .action-card,
        html.dark-mode .stat-card,
        html.dark-mode .profile-card {
            background: #242426 !important;
            border-color: #313135 !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
        }

        html.dark-mode .detail-card:hover,
        html.dark-mode .action-card:hover {
            border-color: #545458 !important;
            box-shadow: 0 16px 40px rgba(0,0,0,0.4) !important;
        }

        html.dark-mode .detail-card h3 {
            color: #e5e5e7 !important;
        }

        html.dark-mode .detail-card p,
        html.dark-mode .action-card p,
        html.dark-mode .card-info p {
            color: #98989f !important;
        }

        html.dark-mode .card-info h4 {
            color: #e5e5e7 !important;
        }

        html.dark-mode .card-visual {
            background: #2c2c2e !important;
            color: #98989f !important;
        }

        /* ── WELCOME BANNER ── */
        html.dark-mode .welcome-banner {
            background: linear-gradient(45deg, #1c1c1e 0%, #2c2c2e 100%) !important;
            border: 1px solid #313135 !important;
        }

        /* ── SECTION TITLE ── */
        html.dark-mode .section-title {
            color: #545458 !important;
        }

        /* ── BUTTONS ── */
        html.dark-mode .card-btn {
            background: #3a3a3c !important;
            color: #e5e5e7 !important;
        }

        html.dark-mode .card-btn:hover {
            background: #48484a !important;
        }

        html.dark-mode .save-btn {
            background: #3a3a3c !important;
            color: #e5e5e7 !important;
        }

        html.dark-mode .save-btn:hover {
            background: #48484a !important;
            box-shadow: 0 10px 24px rgba(0,0,0,0.3) !important;
        }

        html.dark-mode .save-btn:disabled {
            opacity: 0.4 !important;
        }

        /* ── CARD BUTTON OUTLINE ── */
        html.dark-mode .card-btn-outline {
            border-color: #313135 !important;
            color: #98989f !important;
            background: transparent !important;
        }

        html.dark-mode .card-btn-outline:hover {
            border-color: #545458 !important;
            color: #e5e5e7 !important;
        }

        /* ── FOOTER ── */
        html.dark-mode .about-footer {
            border-top-color: #313135 !important;
            color: #545458 !important;
        }

        /* ── SETTINGS SIDEBAR ── */
        html.dark-mode .settings-sidebar {
            background: #18181a !important;
            border-right-color: #313135 !important;
        }

        html.dark-mode .settings-menu-btn {
            color: #98989f !important;
        }

        html.dark-mode .settings-menu-btn .icon {
            color: #545458 !important;
        }

        html.dark-mode .settings-menu-btn:hover {
            background: #2c2c2e !important;
            color: #e5e5e7 !important;
        }

        html.dark-mode .settings-menu-btn.active {
            background: #3a3a3c !important;
            color: #e5e5e7 !important;
        }

        html.dark-mode .settings-menu-btn.active .icon {
            color: #e5e5e7 !important;
        }

        /* ── SETTINGS BODY ── */
        html.dark-mode .settings-body {
            background: #242426 !important;
        }

        html.dark-mode .settings-body::-webkit-scrollbar-track {
            background: #18181a !important;
        }

        html.dark-mode .settings-body::-webkit-scrollbar-thumb {
            background: #3a3a3c !important;
        }

        html.dark-mode .pane-header h2 {
            color: #e5e5e7 !important;
        }

        html.dark-mode .pane-header p {
            color: #98989f !important;
        }

        /* ── FORM LABELS ── */
        html.dark-mode .form-group label {
            color: #98989f !important;
        }

        /* ── SETTINGS INPUTS ── */
        html.dark-mode .settings-input {
            background: #2c2c2e !important;
            border-color: #313135 !important;
            color: #e5e5e7 !important;
        }

        html.dark-mode .settings-input:focus {
            background: #313135 !important;
            border-color: #545458 !important;
            box-shadow: 0 0 0 4px rgba(255,255,255,0.05) !important;
        }

        /* ── TOGGLE ROWS ── */
        html.dark-mode .toggle-row {
            border-bottom-color: #313135 !important;
        }

        html.dark-mode .toggle-text h4 {
            color: #e5e5e7 !important;
        }

        html.dark-mode .toggle-text p {
            color: #98989f !important;
        }

        /* ── TOGGLE SWITCH ── */
        html.dark-mode input:checked + .slider {
            background: #a0a0a8 !important;
        }

        /* ── AVATAR SECTION ── */
        html.dark-mode .avatar-container {
            background: #2c2c2e !important;
            border-color: #313135 !important;
        }

        html.dark-mode .avatar-preview {
            background: #313135 !important;
            color: #98989f !important;
        }

        html.dark-mode .avatar-btn {
            background: #2c2c2e !important;
            border-color: #313135 !important;
            color: #e5e5e7 !important;
        }

        html.dark-mode .avatar-btn:hover {
            background: #3a3a3c !important;
            border-color: #545458 !important;
        }

        /* ── DANGER LINK ── */
        html.dark-mode .danger-link {
            color: #e05555 !important;
        }

        /* ── PROFILE PAGE (user-settings.html) ── */
        html.dark-mode .content-wrapper {
            background: transparent !important;
        }

        html.dark-mode .profile-info h1 {
            color: #e5e5e7 !important;
        }

        html.dark-mode .profile-title {
            color: #98989f !important;
        }

        html.dark-mode .profile-bio {
            color: #98989f !important;
        }

        html.dark-mode .stat-box {
            background: #2c2c2e !important;
            border-color: #313135 !important;
        }

        html.dark-mode .stat-number {
            color: #e5e5e7 !important;
        }

        html.dark-mode .stat-label {
            color: #98989f !important;
        }

        html.dark-mode .back-btn {
            color: #98989f !important;
        }

        /* ── HEADER BREADCRUMB ── */
        html.dark-mode .header-breadcrumb {
            color: #545458 !important;
        }

        html.dark-mode .active-crumb {
            color: #e5e5e7 !important;
        }

        /* ── TOP HEADER BORDER ── */
        html.dark-mode .top-header {
            border-bottom-color: #313135 !important;
        }

        /* ── COLLECTION CARDS ── */
        html.dark-mode .pattern-card {
            background: #242426 !important;
            border-color: #313135 !important;
        }

        html.dark-mode .pattern-card:hover {
            border-color: #545458 !important;
            box-shadow: 0 18px 36px rgba(0,0,0,0.4) !important;
        }

        html.dark-mode .pattern-title {
            color: #e5e5e7 !important;
        }

        html.dark-mode .pattern-meta,
        html.dark-mode .pattern-date {
            color: #98989f !important;
        }

        html.dark-mode .empty-state {
            color: #98989f !important;
        }

        /* ── COLLECTION TABS ── */
        html.dark-mode .tab-btn {
            color: #98989f !important;
        }

        html.dark-mode .tab-btn.active {
            color: #e5e5e7 !important;
        }

        html.dark-mode .tab-underline {
            background: #313135 !important;
        }

        /* ── COLLECTION HEADER ── */
        html.dark-mode .col-header h1 {
            color: #e5e5e7 !important;
        }

        html.dark-mode .col-header p {
            color: #98989f !important;
        }

        /* ── ABOUT PAGE ── */
        html.dark-mode .subtitle {
            color: #98989f !important;
        }

        html.dark-mode .about-hero h1 {
            color: #e5e5e7 !important;
        }

        html.dark-mode .about-hero p {
            color: #98989f !important;
        }

        /* ── SCROLLBARS ── */
        html.dark-mode ::-webkit-scrollbar-track {
            background: #18181a !important;
        }

        html.dark-mode ::-webkit-scrollbar-thumb {
            background: #3a3a3c !important;
        }

        html.dark-mode ::-webkit-scrollbar-thumb:hover {
            background: #48484a !important;
        }

    `;
    const head = document.querySelector("head");
    if (head) {
        head.insertBefore(style, head.firstChild);
    }
})();


/* =========================================
   3. TRANSLATIONS DICTIONARY
   Single source of truth for all pages.
   ========================================= */
var translations = {
    en: {
        // ── NAV (all pages) ──
        "home-link":        "Home",
        "collection-link":  "Collection",
        "about-link":       "About",
        "settings-link":    "Settings",
        "logout-link":      "Logout",
        "greeting-text":    "Hello,",

        // ── ABOUT PAGE ──
        "about-mission":    "Our Mission",
        "about-title":      "Digitalizing the Dying Art of Traditional Filipino Weaving",
        "about-desc":       "HABI-LIN is a bridge between ancestral wisdom and modern technology, designed to preserve the intricate patterns of the Philippines for the digital age.",
        "about-problem-h":  "The Problem",
        "about-problem-p":  "Traditional handloom weaving is a labor-intensive art form that is slowly disappearing as younger generations move toward digital careers. The complex patterns often exist only in the memory of master weavers.",
        "about-solution-h": "The Solution",
        "about-solution-p": "By using 3D modeling and data signal processing, HABI-LIN captures the movement of the loom, allowing weavers to create, store, and share digital pattern drafts globally.",

        // ── COLLECTION PAGE ──
        "section-title":        "Digital Patterns",
        "section-subtitle":     "Your saved weave drafts from the loom studio.",
        "section-title-all":    "Community Patterns",
        "section-subtitle-all": "Explore weave designs from the community.",
        "my-patterns-tab":  "My Patterns",
        "all-patterns-tab": "All Patterns",
        "col-new":          "New Design",

        // ── SETTINGS PAGE ──
        "stab-general":       "General",
        "stab-account":       "Account",
        "stab-security":      "Security",
        "s-general-title":    "General Settings",
        "s-general-desc":     "Manage your workspace preferences and localized experience.",
        "s-lang-label":       "Interface Language",
        "s-dark-title":       "Dark Appearance",
        "s-dark-desc":        "Switch between light and dark visual themes for the dashboard.",
        "s-hifi-title":       "High Fidelity Rendering",
        "s-hifi-desc":        "Enable high-precision 3D textures in the Weaving Studio.",
        "s-save-btn":         "Save Preferences",
        "s-account-title":    "Account Details",
        "s-account-desc":     "Update your personal information and contact details.",
        "s-change-avatar":    "Change Avatar",
        "s-fullname-label":   "Full Legal Name",
        "s-email-label":      "Email Address",
        "s-update-account":   "Update Account",
        "s-delete-account":   "Permanently delete my account",
        "s-security-title":   "Security & Access",
        "s-security-desc":    "Protect your designs and patterns with robust security protocols.",
        "s-curr-pass-label":  "Current Password",
        "s-new-pass-label":   "New Secure Password",
        "s-update-security":  "Update Security",
         "dash-welcome":     "Welcome,",
        "dash-banner-sub":  "Pick up where you left off or explore new traditional techniques.",
        "dash-quick":       "Quick Actions",
        "dash-create-h":    "Create New Weave",
        "dash-create-p":    "Start a blank pattern draft from scratch using our 3D loom.",
        "dash-create-btn":  "Get Started",
        "dash-lib-h":       "Pattern Library",
        "dash-lib-p":       "Browse through your saved collection and community favorites.",
        "dash-lib-btn":     "Open Library",
    },
    fil: {
        "home-link":        "Home",
        "collection-link":  "Koleksyon",
        "about-link":       "Tungkol sa Amin",
        "settings-link":    "Settings",
        "logout-link":      "Mag-logout",
        "greeting-text":    "Kamusta,",

        "about-mission":    "Ang Aming Misyon",
        "about-title":      "Pag-digitize sa Sining ng Tradisyunal na Paghahabi ng Pilipino",
        "about-desc":       "Ang HABI-LIN ay tulay sa pagitan ng karunungan ng ninuno at makabagong teknolohiya para mapanatili ang mga pattern ng Pilipinas.",
        "about-problem-h":  "Ang Problema",
        "about-problem-p":  "Ang tradisyunal na paghahabi sa handloom ay isang sining na unti-unting nawawala habang ang mga kabataan ay lumilipat sa digital na karera. Ang mga kumplikadong pattern ay kadalasang nasa isip lamang ng mga dalubhasang mananahi.",
        "about-solution-h": "Ang Solusyon",
        "about-solution-p": "Sa pamamagitan ng 3D modeling at data signal processing, kinukuha ng HABI-LIN ang galaw ng handloom, na nagbibigay-daan sa mga mananahi na lumikha, mag-imbak, at magbahagi ng mga digital na pattern draft sa buong mundo.",

        "section-title":        "Mga Digital na Pattern",
        "section-subtitle":     "Ang iyong mga naka-save na draft ng habi mula sa loom studio.",
        "section-title-all":    "Mga Pattern ng Komunidad",
        "section-subtitle-all": "Tuklasin ang mga disenyo ng habi mula sa komunidad.",
        "my-patterns-tab":  "Aking mga Pattern",
        "all-patterns-tab": "Lahat ng Pattern",
        "col-new":          "Bagong Disenyo",

        // ── SETTINGS PAGE ──
        "stab-general":       "General",
        "stab-account":       "Account",
        "stab-security":      "Seguridad",
        "s-general-title":    "Mga Setting ng General",
        "s-general-desc":     "Pamahalaan ang iyong mga kagustuhan at lokal na karanasan.",
        "s-lang-label":       "Wika ng Interface",
        "s-dark-title":       "Madilim na Hitsura",
        "s-dark-desc":        "Lumipat sa pagitan ng maliwanag at madilim na tema sa dashboard.",
        "s-hifi-title":       "High Fidelity Rendering",
        "s-hifi-desc":        "I-enable ang high-precision na 3D textures sa Weaving Studio.",
        "s-save-btn":         "I-save ang Mga Kagustuhan",
        "s-account-title":    "Mga Detalye ng Account",
        "s-account-desc":     "I-update ang iyong personal na impormasyon at mga detalye ng kontak.",
        "s-change-avatar":    "Palitan ang Avatar",
        "s-fullname-label":   "Buong Legal na Pangalan",
        "s-email-label":      "Email Address",
        "s-update-account":   "I-update ang Account",
        "s-delete-account":   "Permanenteng burahin ang aking account",
        "s-security-title":   "Seguridad at Access",
        "s-security-desc":    "Protektahan ang iyong mga disenyo at pattern sa matibay na seguridad.",
        "s-curr-pass-label":  "Kasalukuyang Password",
        "s-new-pass-label":   "Bagong Secure na Password",
        "s-update-security":  "I-update ang Seguridad",
        "dash-welcome":     "Maligayang pagbabalik,",
        "dash-banner-sub":  "Ituloy ang iyong nasimulan o galugarin ang mga bagong tradisyunal na teknik.",
        "dash-quick":       "Mabilisang Aksyon",
        "dash-create-h":    "Gumawa ng Bagong Habi",
        "dash-create-p":    "Magsimula ng isang blangkong draft ng pattern gamit ang aming 3D loom.",
        "dash-create-btn":  "Magsimula Na",
        "dash-lib-h":       "Library ng Pattern",
        "dash-lib-p":       "Tingnan ang iyong koleksyon at mga paborito ng komunidad.",
        "dash-lib-btn":     "Buksan ang Library",
    },
    ilo: {
        "home-link":        "Home",
        "collection-link":  "Koleksion",
        "about-link":       "Maipapan",
        "settings-link":    "Settings",
        "logout-link":      "Rummuar",
        "greeting-text":    "Kumusta,",

        "about-mission":    "Ti Misionmi",
        "about-title":      "Panang-digitize ti Sining ti Tradisyunal a Panagabel ti Filipino",
        "about-desc":       "Ti HABI-LIN ket rangtay iti nagbaetan ti sirib dagiti kaputotan ken baro a teknolohiya tapno mapangtalinaed dagiti pattern ti Pilipinas.",
        "about-problem-h":  "Ti Problema",
        "about-problem-p":  "Ti tradisyunal a panagabel iti handloom ket maysa a sining a nalainglaing a mapukaw ta dagiti agtubo ket lumipat iti digital a trabaho. Dagiti komplikado a pattern ket adda laeng iti isip dagiti mannaabel.",
        "about-solution-h": "Ti Solusion",
        "about-solution-p": "Babaen ti 3D modeling ken data signal processing, ti HABI-LIN ket mangikapet ti pannakigtot ti handloom, tapno dagiti mannaabel ket makaaramid, makaipan, ken makaibagi dagiti digital a pattern draft iti lubong.",

        "section-title":        "Dagiti Digital a Pattern",
        "section-subtitle":     "Dagiti naisave-mo a draft ti abel manipud iti loom studio.",
        "section-title-all":    "Dagiti Pattern ti Komunidad",
        "section-subtitle-all": "Suruten dagiti disenyo ti abel manipud iti komunidad.",
        "my-patterns-tab":  "Dagiti Pattern-ko",
        "all-patterns-tab": "Amin a Pattern",
        "col-new":          "Baro a Disenyo",

        // ── SETTINGS PAGE ──
        "stab-general":       "General",
        "stab-account":       "Account",
        "stab-security":      "Seguridad",
        "s-general-title":    "Dagiti Setting ti General",
        "s-general-desc":     "Payadayoen dagiti kagustuan ken lokal a kapadasan.",
        "s-lang-label":       "Lengguahe ti Interface",
        "s-dark-title":       "Nangisit a Pannakita",
        "s-dark-desc":        "Agpalit iti nagbaetan ti nalawag ken nangisit a tema iti dashboard.",
        "s-hifi-title":       "High Fidelity Rendering",
        "s-hifi-desc":        "I-enable dagiti high-precision a 3D textures iti Weaving Studio.",
        "s-save-btn":         "Isalakan dagiti Kagustuan",
        "s-account-title":    "Dagiti Detalye ti Account",
        "s-account-desc":     "I-update dagiti personal a impormasyon ken detalye ti kontak.",
        "s-change-avatar":    "Baliwan ti Avatar",
        "s-fullname-label":   "Kompleto a Legal a Nagan",
        "s-email-label":      "Email Address",
        "s-update-account":   "I-update ti Account",
        "s-delete-account":   "Permanente a buraen ti account-ko",
        "s-security-title":   "Seguridad ken Access",
        "s-security-desc":    "Protektaran dagiti disenyo ken pattern babaen ti natibtibker a seguridad.",
        "s-curr-pass-label":  "Agdama a Password",
        "s-new-pass-label":   "Baro a Secure a Password",
        "s-update-security":  "I-update ti Seguridad",
        "dash-welcome":     "Naragsak a panagsubli,",
        "dash-banner-sub":  "Ituloy ti inrugiam wenno ammuen dagiti baro a tradisyunal a teknik.",
        "dash-quick":       "Napaspas nga Aksyon",
        "dash-create-h":    "Agabel ti Baro",
        "dash-create-p":    "Mangrugi ti baro a draft ti pattern babaen ti panagusar ti 3D loom-mi.",
        "dash-create-btn":  "Rugian Mon",
        "dash-lib-h":       "Library ti Pattern",
        "dash-lib-p":       "Kitaem dagiti naisave-mo a koleksion ken dagiti paborito ti komunidad.",
        "dash-lib-btn":     "Lukatan ti Library",
    }
};


/* =========================================
   4. LANGUAGE APPLICATION FUNCTION
   - Plain text elements: sets textContent directly
   - Elements with SVG icons (like col-new): only replaces text nodes, preserves icon
   - greeting-text: text only, no icon
   ========================================= */
function applyGlobalLanguage() {
    // sessionStorage resets when the browser/tab is closed — so the site
    // always opens in English. Language only persists within the same session
    // unless the user saves it in Settings (which writes to sessionStorage).
    const lang = sessionStorage.getItem("preferredLanguage") || "en";
    const texts = translations[lang];
    if (!texts) return;

    // Elements with SVG icons — only swap text nodes, preserve icon
    const iconElements = new Set(["home-link", "collection-link", "about-link", "settings-link", "logout-link", "col-new"]);

    // Elements with child spans/elements to preserve — only swap first text node
    const mixedElements = new Set(["dash-welcome"]);

    Object.keys(texts).forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (iconElements.has(id)) {
            el.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
                    node.textContent = " " + texts[id];
                }
            });
            const hasTextNode = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
            if (!hasTextNode) {
                el.appendChild(document.createTextNode(" " + texts[id]));
            }
        } else if (mixedElements.has(id)) {
            // Prepend translated text before the first child element (e.g. username span)
            // Remove any existing leading text nodes first to avoid duplicates
            Array.from(el.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) el.removeChild(node);
            });
            el.insertBefore(document.createTextNode(texts[id] + " "), el.firstChild);
        } else {
            el.textContent = texts[id];
        }
    });

    document.documentElement.lang = lang;
}

// Run language application on every page load
document.addEventListener("DOMContentLoaded", applyGlobalLanguage);


/* =========================================
   5. GLOBAL THEME TOGGLE FUNCTION
   Called from settings.html toggleTheme().
   Broadcasts the change to all open tabs via storage event.
   ========================================= */
function applyGlobalTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add("dark-mode");
        document.body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
    } else {
        document.documentElement.classList.remove("dark-mode");
        document.body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
    }
}

// Listen for theme changes made in OTHER tabs/windows
window.addEventListener("storage", function (e) {
    if (e.key === "theme") {
        applyGlobalTheme(e.newValue === "dark");
    }
});