// -------------------------
// Load Leaflet JS dynamically
// -------------------------
const leafletScript = document.createElement("script");
leafletScript.src = "https://unpkg.com/leaflet/dist/leaflet.js";
document.head.appendChild(leafletScript);

leafletScript.onload = () => {

/* -------------------------
   Get Data from Wrapper ✅
------------------------- */
const root = document.getElementById("dashboard-root");

let initialAlerts = [];
try {
  initialAlerts = JSON.parse(root.dataset.alerts || "[]");
} catch (e) {
  initialAlerts = [];
}

const seenAlertIds = new Set();
const markersById = new Map();

/* -------------------------
   Map Init
------------------------- */
const map = L.map('map', { zoomControl: true, attributionControl: false })
  .setView([20.5937,78.9629], 5);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

map.whenReady(() => setTimeout(()=>map.invalidateSize(), 120));

/* -------------------------
   Helpers
------------------------- */
function escapeHtml(s){
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

/* -------------------------
   Popup
------------------------- */
function buildPopup(a){
  const lat = escapeHtml(a.latitude);
  const lng = escapeHtml(a.longitude);

  return `
    <div style="min-width:250px">
      <h5>${escapeHtml(a.full_name || a.username || 'User')}</h5>
      <p><b>Time:</b> ${escapeHtml(a.timestamp)}</p>
      <p><b>Location:</b> ${lat}, ${lng}</p>
      <a target="_blank" href="https://www.google.com/maps?q=${lat},${lng}">
        Open in Maps
      </a>
    </div>
  `;
}

/* -------------------------
   Marker Add
------------------------- */
function addMarker(a, focus=false){
  if (!a || !a.id || seenAlertIds.has(a.id)) return;

  const lat = parseFloat(a.latitude);
  const lng = parseFloat(a.longitude);
  if (isNaN(lat) || isNaN(lng)) return;

  const marker = L.circleMarker([lat,lng], {
    radius: 7,
    color: '#d9534f',
    fillColor: '#d9534f',
    fillOpacity: 0.9
  }).addTo(map);

  marker.bindPopup(buildPopup(a));

  markersById.set(a.id, marker);
  seenAlertIds.add(a.id);

  if (focus){
    map.setView([lat,lng], 13);
    marker.openPopup();
  }
}

/* -------------------------
   History UI
------------------------- */
function renderHistory(alerts){
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  if (!alerts.length){
    list.innerHTML = '<p class="text-muted text-center">No alerts</p>';
    return;
  }

  alerts.forEach(a => {
    const div = document.createElement('div');
    div.className = 'history-item';

    div.innerHTML = `
      <strong>${escapeHtml(a.full_name || 'User')}</strong>
      <br>
      <small>${escapeHtml(a.timestamp)}</small>
      <br>
      <button class="btn btn-sm btn-outline-primary mt-1">View</button>
    `;

    div.querySelector('button').onclick = () => {
      addMarker(a, true);
    };

    list.appendChild(div);
  });
}

/* -------------------------
   Fetch Alerts
------------------------- */
async function fetchAlerts(){
  try{
    const res = await fetch('/api/panic-alerts/');
    const data = await res.json();

    if (data.alerts){
      renderHistory(data.alerts);
      data.alerts.forEach(a => addMarker(a));
    }
  }catch(e){
    console.error(e);
  }
}

/* -------------------------
   Toast
------------------------- */
function showToast(msg){
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.className = 'toast-show';

  setTimeout(() => t.className = 'toast-hide', 3000);
}

/* -------------------------
   Polling (Live alerts)
------------------------- */
setInterval(async () => {
  try{
    const res = await fetch('/api/panic-alerts/');
    const data = await res.json();

    if (data.alerts){
      data.alerts.forEach(a => {
        if (!seenAlertIds.has(a.id)){
          addMarker(a);
          showToast("🚨 New Alert!");
        }
      });
    }
  }catch(e){
    console.error(e);
  }
}, 3000);

/* -------------------------
   Initial Load
------------------------- */
fetchAlerts();

/* -------------------------
   Render Initial Alerts (from Django)
------------------------- */
if (initialAlerts.length){
  initialAlerts.forEach(a => addMarker(a));
}

};