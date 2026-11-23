
const $ = (selector) => document.querySelector(selector);

let mode = "register";
let isSubmitting = false;

// Open signup/login popup
function authOpen() {
    const modal = $("#authModal");

    if (!modal) return;

    modal.classList.remove("hidden");
    setMode("register");
}

// Close popup
const closeButton = $("#closeAuth");

if (closeButton) {
    closeButton.onclick = () => {
        $("#authModal").classList.add("hidden");
    };
}

// Open popup from website buttons
["#heroCreate", "#navCreate", "#bottomCreate"].forEach(selector => {
    const button = $(selector);

    if (button) {
        button.onclick = authOpen;
    }
});

// Switch between signup and login
function setMode(newMode) {
    mode = newMode;

    const form = $("#authForm");
    const nameWrap = $("#nameWrap");
    const nameInput = form?.querySelector('[name="name"]');
    const title = $("#authTitle");
    const submitButton = $("#authSubmit");
    const switchArea = $("#authSwitch");
    const errorArea = $("#authError");

    if (!form || !title || !submitButton || !switchArea) {
        console.error("Auth form HTML elements are missing.");
        return;
    }

    // Name field validation
    if (nameInput) {
        nameInput.required = mode === "register";
        nameInput.disabled = mode === "login";
    }

    // Show/hide name field
    if (nameWrap) {
        nameWrap.classList.toggle("hidden", mode === "login");
    }

    // Update title
    title.textContent =
        mode === "register"
            ? "Create your account"
            : "Welcome back";

    // Update submit button
    submitButton.textContent =
        mode === "register"
            ? "Create account"
            : "Sign in";

    submitButton.disabled = false;

    // Clear previous errors
    if (errorArea) {
        errorArea.textContent = "";
    }

    // Update switch link
    switchArea.innerHTML =
        mode === "register"
            ? 'Already have an account? <button type="button" class="textbtn" id="switchAuth">Sign in</button>'
            : 'New to NJ Wedding Studio? <button type="button" class="textbtn" id="switchAuth">Create account</button>';

    // Attach click event after creating button
    const switchButton = $("#switchAuth");

    if (switchButton) {
        switchButton.onclick = () => {
            setMode(mode === "register" ? "login" : "register");
        };
    }
}

// Signup and Login form submission
const authForm = $("#authForm");

if (authForm) {
    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (isSubmitting) return;

        const errorArea = $("#authError");
        const submitButton = $("#authSubmit");

        if (errorArea) {
            errorArea.textContent = "";
        }

        // Collect form data
        const formData = new FormData(authForm);
        const body = Object.fromEntries(formData.entries());

        // Remove name from login request
        if (mode === "login") {
            delete body.name;
        }

        // Check required fields
        if (!body.email || !body.password) {
            if (errorArea) {
                errorArea.textContent = "Please enter your email and password.";
            }
            return;
        }

        // Signup requires name
        if (mode === "register" && !body.name?.trim()) {
            if (errorArea) {
                errorArea.textContent = "Please enter your name.";
            }
            return;
        }

        isSubmitting = true;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent =
                mode === "register" ? "Creating account..." : "Signing in...";
        }

        try {
            const endpoint =
                mode === "register"
                    ? "/api/register"
                    : "/api/login";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(body)
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.error || "Unable to continue. Please try again."
                );
            }

            // Successful signup/login
            window.location.href = "/dashboard.html";

        } catch (error) {
            console.error("Authentication error:", error);

            if (errorArea) {
                errorArea.textContent =
                    error.message || "Something went wrong. Please try again.";
            }

        } finally {
            isSubmitting = false;

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent =
                    mode === "register" ? "Create account" : "Sign in";
            }
        }
    });
}

// Initial setup
setMode("register");
