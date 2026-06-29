// 1. ZMIANA TYTUŁU I IKONY KARTY PRZEGLĄDARKI
const pierwotnyTytul = document.title;
const ikonaStrony = document.querySelector("link[rel*='icon']");
const pierwotnaIkona = ikonaStrony ? ikonaStrony.href : "";
const ikonaPowrotu = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e74c3c'%3E%3Cpath d='M16 7v3h2V7h-2zm-5 0v3h2V7h-2zM6 12v2c0 2.21 1.79 4 4 4v3h4v-3c2.21 0 4-1.79 4-4v-2H6z'/%3E%3C/svg%3E";

window.addEventListener('blur', () => {
    document.title = 'Wróć do nas! 🔌';
    if (ikonaStrony) ikonaStrony.href = ikonaPowrotu;
});

window.addEventListener('focus', () => {
    document.title = pierwotnyTytul;
    if (ikonaStrony) ikonaStrony.href = pierwotnaIkona;
});


// 2. INICJALIZACJA MAPY (Centrum na Bielsko-Białą/Śląsk jako domyślny rejon działania)
const map = L.map('map').setView([49.8224, 19.0468], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

let marker = null;
const inputAdres = document.getElementById('address');
const inputMapLink = document.getElementById('map_link');

// Funkcja pomocnicza aktualizacji lub tworzenia pinezki + budowanie linku Google Maps
function aktualizujPinezke(lat, lng, adresTekst) {
    // Generujemy prawidłowy, czysty link do nawigacji Google Maps na podstawie współrzędnych
    inputMapLink.value = `https://www.google.com/maps?q=${lat},${lng}`;
    
    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng]).addTo(map);
    }
    
    marker.bindPopup(`<b>Miejsce zlecenia:</b><br>${adresTekst}`).openPopup();
}

// Opcja A: Kliknięcie na mapie uzupełnia pole tekstowe i tworzy link do Google Maps
map.on('click', function(e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);

    // Pobieranie czytelnego adresu z OpenStreetMap (Geokodowanie wsteczne)
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
            const a = data.address;
            const ulica = a.road || '';
            const nr = a.house_number || '';
            const miasto = a.city || a.town || a.village || '';
            
            const sformatowanyAdres = `${ulica} ${nr}${ulica && nr ? ', ' : ''}${miasto}`.trim() || data.display_name;
            
            inputAdres.value = sformatowanyAdres;
            aktualizujPinezke(lat, lng, sformatowanyAdres);
        })
        .catch(() => {
            inputAdres.value = `${lat}, ${lng}`;
            aktualizujPinezke(lat, lng, "Zaznaczono bezpośrednio na mapie");
        });
});

// Opcja B: Wpisywanie w pole tekstowe wyszukuje miejsce, centruje mapę i stawia pinezkę z linkiem
let timeoutWyszukiwania = null;

inputAdres.addEventListener('input', function() {
    clearTimeout(timeoutWyszukiwania);
    const wartosc = this.value.trim();

    if (wartosc.length < 5) return; 

    // Czekamy 1 sekundę po zakończeniu pisania, by dynamicznie postawić pinezkę
    timeoutWyszukiwania = setTimeout(() => {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(wartosc)}&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const punkt = data[0];
                    const lat = parseFloat(punkt.lat).toFixed(6);
                    const lon = parseFloat(punkt.lon).toFixed(6);
                    
                    map.setView([lat, lon], 15);
                    aktualizujPinezke(lat, lon, punkt.display_name);
                }
            }).catch(() => {});
    }, 1000);
});


// 3. OBSŁUGA FORMULARZA KONTAKTOWEGO + BLOKADA SPAMU
document.getElementById('contactForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const form = event.target;
    const feedback = document.getElementById('formFeedback');
    const button = document.querySelector('.btn-submit');
    
    const COOLDOWN_TIME = 30 * 60 * 1000; 
    const teraz = Date.now();
    const ostatniaWysylka = localStorage.getItem('ostatniaWysylka');

    if (ostatniaWysylka) {
        const czasKtoryMinal = teraz - parseInt(ostatniaWysylka, 10);
        if (czasKtoryMinal < COOLDOWN_TIME) {
            const pozostalyCzas = COOLDOWN_TIME - czasKtoryMinal;
            const pozostaleMinuty = Math.ceil(pozostalyCzas / (60 * 1000));
            feedback.textContent = `Możesz wysłać kolejną wiadomość za ${pozostaleMinuty} min.`;
            feedback.className = 'form-feedback error';
            return;
        }
    }

    button.textContent = 'Wysyłanie...';
    button.style.opacity = '0.7';
    button.disabled = true;

    const data = new FormData(form);

    fetch(form.action, {
        method: form.method,
        body: data,
        headers: { 'Accept': 'application/json' }
    }).then(response => {
        if (response.ok) {
            localStorage.setItem('ostatniaWysylka', Date.now());
            feedback.textContent = 'Dziękujemy! Wiadomość wraz z lokalizacją została pomyślnie wysłana.';
            feedback.className = 'form-feedback success';
            form.reset();
            
            if (marker) {
                map.removeLayer(marker);
                marker = null;
            }
            map.setView([49.8224, 19.0468], 11); // Powrót mapy do rejonu bazowego
        } else {
            feedback.textContent = 'Wystąpił błąd podczas wysyłania. Spróbuj ponownie.';
            feedback.className = 'form-feedback error';
        }
    }).catch(() => {
        feedback.textContent = 'Brak połączenia z internetem.';
        feedback.className = 'form-feedback error';
    }).finally(() => {
        button.textContent = 'Wyślij wiadomość';
        button.style.opacity = '1';
        button.disabled = false;
    });
});
