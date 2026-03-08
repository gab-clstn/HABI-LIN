const translations = {
    en: {
        "home-link": "Home",
        "collection-link": "Collection",
        "about-link": "About",
        "settings-link": "Settings",
        "logout-link": "Logout",
        "greeting-text": "Hello,",
        "brand-logo": "HABI-LIN",
        "col-title": "Digital Patterns",
        "col-sub": "Your saved weave drafts from the loom studio.",
        "col-my-tab": "My Patterns",
        "col-all-tab": "All Patterns",
        "col-new": "New Design",
        "about-mission": "Our Mission",
        "about-title": "Digitalizing the Dying Art of Traditional Filipino Weaving",
        "about-desc": "HABI-LIN is a bridge between ancestral wisdom and modern technology, designed to preserve the intricate patterns of the Philippines for the digital age.",
        "dash-welcome": "Welcome back,",
        "dash-banner-sub": "Pick up where you left off or explore new traditional techniques.",
        "dash-quick": "Quick Actions",
        "dash-create-h": "Create New Weave",
        "dash-create-p": "Start a blank pattern draft from scratch using our 3D loom.",
        "dash-create-btn": "Get Started",
        "dash-lib-h": "Pattern Library",
        "dash-lib-p": "Browse through your saved collection and community favorites.",
        "dash-lib-btn": "Open Library"
    },
    fil: {
        "home-link": "Home",
        "collection-link": "Koleksyon",
        "about-link": "Tungkol sa Amin",
        "settings-link": "Settings",
        "logout-link": "Mag-logout",
        "greeting-text": "Kamusta,",
        "brand-logo": "HABI-LIN",
        "col-title": "Mga Digital na Pattern",
        "col-sub": "Ang iyong mga naka-save na draft ng habi mula sa loom studio.",
        "col-my-tab": "Aking mga Pattern",
        "col-all-tab": "Lahat ng Pattern",
        "col-new": "Bagong Disenyo",
        "about-mission": "Ang Aming Misyon",
        "about-title": "Pag-digitize sa Sining ng Tradisyunal na Paghahabi ng Pilipino",
        "about-desc": "Ang HABI-LIN ay tulay sa pagitan ng karunungan ng ninuno at makabagong teknolohiya para mapanatili ang mga pattern ng Pilipinas.",
        "dash-welcome": "Maligayang pagbabalik,",
        "dash-banner-sub": "Ituloy ang iyong nasimulan o galugarin ang mga bagong tradisyunal na teknik.",
        "dash-quick": "Mabilisang Aksyon",
        "dash-create-h": "Gumawa ng Bagong Habi",
        "dash-create-p": "Magsimula ng isang blangkong draft ng pattern gamit ang aming 3D loom.",
        "dash-create-btn": "Magsimula Na",
        "dash-lib-h": "Library ng Pattern",
        "dash-lib-p": "Tingnan ang iyong koleksyon at mga paborito ng komunidad.",
        "dash-lib-btn": "Buksan ang Library"
    },
    ilo: {
        "home-link": "Home",
        "collection-link": "Koleksion",
        "about-link": "Maipapan",
        "settings-link": "Settings",
        "logout-link": "Rummuar",
        "greeting-text": "Kumusta,",
        "brand-logo": "HABI-LIN",
        "col-title": "Dagiti Digital a Pattern",
        "col-sub": "Dagiti naisave-mo a draft ti abel manipud iti loom studio.",
        "col-my-tab": "Dagiti Pattern-ko",
        "col-all-tab": "Amin a Pattern",
        "col-new": "Baro a Disenyo",
        "about-mission": "Ti Misionmi",
        "about-title": "Panang-digitize ti Sining ti Tradisyunal a Panagabel ti Filipino",
        "about-desc": "Ti HABI-LIN ket rangtay iti nagbaetan ti sirib dagiti kaputotan ken baro a teknolohiya.",
        "dash-welcome": "Naragsak a panagsubli,",
        "dash-banner-sub": "Ituloy ti inrugiam wenno ammuen dagiti baro a tradisyunal a teknik.",
        "dash-quick": "Napaspas nga Aksyon",
        "dash-create-h": "Agabel ti Baro",
        "dash-create-p": "Mangrugi ti baro a draft ti pattern babaen ti panagusar ti 3D loom-mi.",
        "dash-create-btn": "Rugian Mon",
        "dash-lib-h": "Library ti Pattern",
        "dash-lib-p": "Kitaem dagiti naisave-mo a koleksion ken dagiti paborito ti komunidad.",
        "dash-lib-btn": "Lukatan ti Library"
    }
};

function applyGlobalLanguage() {
    const lang = localStorage.getItem("preferredLanguage") || "en";
    const texts = translations[lang];

    Object.keys(texts).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Logic to preserve icons while changing text
            const hasIcon = el.querySelector('svg');
            if (hasIcon) {
                el.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.textContent = ' ' + texts[id];
                    }
                });
            } else {
                el.textContent = texts[id];
            }
        }
    });
    document.documentElement.lang = lang;
}

// Run on every page load
document.addEventListener("DOMContentLoaded", applyGlobalLanguage);