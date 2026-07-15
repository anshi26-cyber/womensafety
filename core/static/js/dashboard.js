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
    <div style="min-width:280px">

      ${a.profile_picture_url ?
      `<div style="text-align:center;margin-bottom:10px;">
          <img src="${escapeHtml(a.profile_picture_url)}"
               width="90"
               height="90"
               style="border-radius:50%;object-fit:cover;border:2px solid #ccc;">
       </div>` : ''}

      <h5>${escapeHtml(a.username || 'User')}</h5>

      <p><b>Email:</b> ${escapeHtml(a.email)}</p>

      <p><b>Contact:</b> ${escapeHtml(a.contact_number)}</p>

      <p><b>Aadhaar:</b> ${escapeHtml(a.aadhaar_number)}</p>

      <p><b>Time:</b> ${escapeHtml(a.timestamp)}</p>

      <p><b>Location:</b> ${lat}, ${lng}</p>

      <p><b>Description:</b> ${escapeHtml(a.description)}</p>

      <a target="_blank"
         href="https://www.google.com/maps?q=${lat},${lng}">
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
   Dashboard Buttons
------------------------- */

// Refresh
document.getElementById("refresh-btn")?.addEventListener("click", () => {
    fetchAlerts();
    showToast("Dashboard Refreshed");
});


// Apply Filters
document.getElementById("apply-filters")?.addEventListener("click", async () => {

    const start = document.getElementById("filter-start").value;
    const end = document.getElementById("filter-end").value;
    const verified = document.getElementById("filter-verified").checked;

    try{

        const res = await fetch("/api/panic-alerts/");
        const data = await res.json();

        let alerts = data.alerts || [];

        alerts = alerts.filter(a => {

            let ok = true;

            if(start)
                ok = ok && a.timestamp >= start;

            if(end)
                ok = ok && a.timestamp <= end + " 23:59:59";

            if(verified)
                ok = ok && a.is_verified;

            return ok;

        });

        document.getElementById("history-list").innerHTML = "";

        alerts.forEach(a=>{

            const div=document.createElement("div");

            div.className="history-item";

            div.innerHTML=`
                <strong>${escapeHtml(a.full_name || "User")}</strong>
                <br>
                <small>${escapeHtml(a.timestamp)}</small>
                <br>
                <button class="btn btn-sm btn-outline-primary mt-2">
                    View
                </button>
            `;

            div.querySelector("button").onclick=()=>{

                const marker=markersById.get(a.id);

                if(marker){

                    map.setView(marker.getLatLng(),13);

                    marker.openPopup();

                }

            };

            document.getElementById("history-list").appendChild(div);

        });

        showToast("Filters Applied");

    }

    catch(err){

        console.log(err);

    }

});


// Clear Filters
document.getElementById("clear-filters")?.addEventListener("click",()=>{

    document.getElementById("filter-start").value="";

    document.getElementById("filter-end").value="";

    document.getElementById("filter-verified").checked=false;

    fetchAlerts();

    showToast("Filters Cleared");

});


// Fit Map Bounds
document.getElementById("use-bounds")?.addEventListener("click",()=>{

    if(markersById.size===0) return;

    const group=[];

    markersById.forEach(marker=>{

        group.push(marker.getLatLng());

    });

    map.fitBounds(group);

    showToast("Map Adjusted");

});
// =======================
// Export CSV
// =======================

document.getElementById("export-btn")?.addEventListener("click", async () => {

    try {

        const res = await fetch("/api/panic-alerts/");
        const data = await res.json();

        if (!data.alerts || data.alerts.length === 0) {
            showToast("No data to export");
            return;
        }

        let csv = "Username,Email,Phone,Latitude,Longitude,Time\n";

        data.alerts.forEach(alert => {
            csv += `"${alert.username || ""}","${alert.email || ""}","${alert.contact_number || ""}","${alert.latitude || ""}","${alert.longitude || ""}","${alert.timestamp || ""}"\n`;
        });

        const blob = new Blob([csv], { type: "text/csv" });

        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);

        link.download = "panic_alerts.csv";

        link.click();

        URL.revokeObjectURL(link.href);

        showToast("Export Successful");

    } catch (err) {

        console.error(err);

    }

});
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