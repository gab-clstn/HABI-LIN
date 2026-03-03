// dashboard.js
fetch("/auth/user")
    .then(res => res.json())
    .then(user => {
        if (!user) {
            // Securely kick out unauthenticated weavers
            window.location.href = "/login.html";
        } else {
            // This handles the bottom welcome h2 you have in your HTML
            const welcomeElement = document.getElementById("welcome");
            if (welcomeElement) {
                welcomeElement.innerText = "Logged in as: " + user.name;
            }
            
            // Log for your debugging in the browser console
            console.log("Weaver Authenticated:", user.name);
        }
    })
    .catch(err => {
        console.error("Session fetch error:", err);
        window.location.href = "/login.html";
    });

    