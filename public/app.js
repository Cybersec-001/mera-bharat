// Mera Bharat — frontend form wiring (booking + contact)
// Submits the forms to the backend as JSON and shows an inline status message.
// The page layout and styling are unchanged.

function wireForm(formId, endpoint, collect) {
  const form = document.getElementById(formId);
  if (!form) return;

  const status = document.createElement('p');
  status.className = 'form-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  form.appendChild(status);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    status.hidden = false;
    status.className = 'form-status pending';
    status.textContent = 'Sending...';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collect(form)),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        status.className = 'form-status success';
        status.textContent = data.message || 'Submitted successfully!';
        form.reset();
      } else {
        status.className = 'form-status error';
        status.textContent = data.error || 'Something went wrong. Please try again.';
      }
    } catch (err) {
      status.className = 'form-status error';
      status.textContent = 'Could not reach the server. Please try again later.';
    }
  });
}

wireForm('booking-form', '/api/bookings', (form) => ({
  where_to: form.elements.where_to.value,
  how_many: form.elements.how_many.value,
  arrivals: form.elements.arrivals.value,
  leaving: form.elements.leaving.value,
  details: form.elements.details.value,
}));

wireForm('contact-form', '/api/contacts', (form) => ({
  name: form.elements.name.value,
  email: form.elements.email.value,
  message: form.elements.message.value,
}));

wireForm('signup-form', '/api/signups', (form) => ({
  name: form.elements.name.value,
  email: form.elements.email.value,
  password: form.elements.password.value,
}));

// --- Navbar search: live-filters the package cards -----------------------
(function wireSearch() {
  const input = document.getElementById('navbar-search');
  const button = document.getElementById('search-btn');
  if (!input || !button) return;

  const cards = Array.from(document.querySelectorAll('.packages .card')).map((card) => ({
    wrapper: card.closest('.col-md-4'),
    text: card.textContent.toLowerCase(),
  }));

  function applyFilter(scroll) {
    const query = input.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(({ wrapper, text }) => {
      const show = !query || text.includes(query);
      wrapper.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    if (scroll) {
      document.querySelector('#packages').scrollIntoView({ behavior: 'smooth' });
    }
    return visible;
  }

  input.addEventListener('input', () => applyFilter(false));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFilter(true); });
  button.addEventListener('click', () => applyFilter(true));
})();

// --- Package "Book Now" buttons: prefill the booking form ---------------
document.querySelectorAll('.book-now-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const destination = btn.getAttribute('data-destination');
    const form = document.getElementById('booking-form');
    if (destination && form) {
      form.elements.where_to.value = destination;
      setTimeout(() => form.elements.how_many.focus(), 400);
    }
  });
});
