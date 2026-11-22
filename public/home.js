
const $ = s => document.querySelector(s);

let mode = 'register';

function authOpen() {
    $('#authModal').classList.remove('hidden');
    setMode(mode);
}

['#heroCreate', '#navCreate', '#bottomCreate'].forEach(s => {
    const el = $(s);
    if (el) el.onclick = authOpen;
});

$('#closeAuth').onclick = () => {
    $('#authModal').classList.add('hidden');
};

function setMode(m) {
    mode = m;

    const nameInput = $('#authForm').querySelector('[name="name"]');

    // IMPORTANT: Login ke time hidden name field validation band
    if (nameInput) {
        nameInput.required = (m === 'register');
        nameInput.disabled = (m === 'login');
    }

    $('#authTitle').textContent =
        m === 'register' ? 'Create your account' : 'Welcome back';

    $('#nameWrap').classList.toggle('hidden', m === 'login');

    $('#authSubmit').textContent =
        m === 'register' ? 'Create account' : 'Sign in';

    $('#authError').textContent = '';

    $('#authSwitch').innerHTML =
        m === 'register'
            ? 'Already have an account? <button type="button" class="textbtn" id="switchAuth">Sign in</button>'
            : 'New to NJ Wedding Studio? <button type="button" class="textbtn" id="switchAuth">Create account</button>';

    $('#switchAuth').onclick = () => {
        setMode(mode === 'register' ? 'login' : 'register');
    };
}

$('#authForm').onsubmit = async e => {
    e.preventDefault();

    const body = Object.fromEntries(new FormData(e.target));

    $('#authSubmit').disabled = true;
    $('#authError').textContent = '';

    try {
        const r = await fetch('/api/' + mode, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const j = await r.json();

        if (!r.ok) {
            throw new Error(j.error || 'Something went wrong.');
        }

        location.href = '/dashboard.html';

    } catch (err) {
        $('#authError').textContent = err.message;
    } finally {
        $('#authSubmit').disabled = false;
    }
};

// Initial form setup
setMode('register');
