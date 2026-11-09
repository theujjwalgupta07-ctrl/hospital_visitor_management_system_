const $ = id => document.getElementById(id);
const state = { staff: sessionStorage.getItem("medivisit_staff") || "" };
const routeNames = {
  dashboard: { title: "Overview", eyebrow: "VISITOR OPERATIONS / DASHBOARD" },
  checkin: { title: "New check-in", eyebrow: "VISITOR OPERATIONS / REGISTRATION" },
  visitors: { title: "Visitor records", eyebrow: "VISITOR OPERATIONS / DATABASE" }
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to complete request.");
  return result;
}
function setStaff(name) {
  state.staff = name;
  sessionStorage.setItem("medivisit_staff", name);
  $("staffNameSide").textContent = name;
  $("staffAvatar").textContent = name.charAt(0).toUpperCase();
  $("staffAvatarTop").textContent = name.charAt(0).toUpperCase();
}
function showApplication() {
  $("loginPage").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  $("staffNameSide").textContent = state.staff;
  $("staffAvatar").textContent = state.staff.charAt(0).toUpperCase();
  $("staffAvatarTop").textContent = state.staff.charAt(0).toUpperCase();
}
function navigate() {
  if (!state.staff) {
    $("loginPage").classList.remove("hidden");
    $("appShell").classList.add("hidden");
    return;
  }
  showApplication();
  const route = location.hash.replace("#", "") || "dashboard";
  const page = routeNames[route] ? route : "dashboard";
  Object.keys(routeNames).forEach(name => {
    $(`${name}View`).classList.toggle("hidden", name !== page);
    document.querySelector(`[data-route="${name}"]`).classList.toggle("active", name === page);
  });
  $("pageTitle").textContent = routeNames[page].title;
  $("pageEyebrow").textContent = routeNames[page].eyebrow;
  if (page === "dashboard") loadDashboard();
  if (page === "visitors") loadVisitors();
  if (page === "checkin") {
    $("visit_date").value = new Date().toLocaleDateString("en-CA");
    $("visitor_name").focus();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("loginForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("staffName").value.trim();
  if (!name) return;
  setStaff(name);
  location.hash = "dashboard";
  navigate();
});
$("logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem("medivisit_staff");
  state.staff = "";
  location.hash = "";
  $("staffName").value = "";
  $("appShell").classList.add("hidden");
  $("loginPage").classList.remove("hidden");
});
window.addEventListener("hashchange", navigate);

function badge(status) {
  return `<span class="badge ${status === "Inside" ? "inside" : "done"}">${escapeHTML(status)}</span>`;
}
async function loadDashboard() {
  try {
    const [stats, visitors] = await Promise.all([api("/api/stats"), api("/api/visitors")]);
    $("totalStat").textContent = stats.total;
    $("todayStat").textContent = stats.today;
    $("insideStat").textContent = stats.inside;
    $("completedStat").textContent = stats.completed;
    $("recentRows").innerHTML = visitors.length ? visitors.slice(0, 6).map(visitor => `
      <tr>
        <td><strong>${escapeHTML(visitor.visitor_name)}</strong><span class="sub-cell">${escapeHTML(visitor.phone)}</span></td>
        <td>${escapeHTML(visitor.patient_name)}</td>
        <td>${escapeHTML(visitor.department)}</td>
        <td>${escapeHTML(visitor.check_in)}</td>
        <td>${badge(visitor.status)}</td>
      </tr>`).join("") : '<tr><td colspan="5" class="empty-cell">No visitors yet. Register your first visitor to get started.</td></tr>';
  } catch (error) {
    $("recentRows").innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHTML(error.message)}</td></tr>`;
  }
}

$("visitorForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("saveVisitorButton");
  button.disabled = true;
  button.textContent = "Saving…";
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const visitor = await api("/api/visitors", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    $("formMessage").textContent = `✓ ${visitor.visitor_name} has been checked in successfully.`;
    $("formMessage").className = "form-message success";
    event.currentTarget.reset();
    showToast("Visitor record saved successfully.");
    setTimeout(() => { location.hash = "visitors"; }, 650);
  } catch (error) {
    $("formMessage").textContent = error.message;
    $("formMessage").className = "form-message error";
  } finally {
    button.disabled = false;
    button.innerHTML = 'Save visitor record <span>→</span>';
  }
});

async function loadVisitors() {
  const query = $("searchInput").value.trim();
  const status = $("statusFilter").value;
  try {
    const visitors = await api(`/api/visitors?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`);
    $("recordCount").textContent = `${visitors.length} RECORD${visitors.length === 1 ? "" : "S"}`;
    $("visitorRows").innerHTML = visitors.length ? visitors.map(visitor => `
      <tr>
        <td><strong>${escapeHTML(visitor.visitor_name)}</strong><span class="sub-cell">${escapeHTML(visitor.phone)}</span></td>
        <td>${escapeHTML(visitor.patient_name)}</td>
        <td>${escapeHTML(visitor.department)}</td>
        <td>${escapeHTML(visitor.visit_date)}<span class="sub-cell">${escapeHTML(visitor.check_in)}${visitor.check_out ? " – " + escapeHTML(visitor.check_out) : ""}</span></td>
        <td>${badge(visitor.status)}</td>
        <td>${visitor.status === "Inside" ? `<button class="table-action" data-checkout="${visitor.id}">Check out</button>` : '<span class="muted">Completed</span>'}</td>
      </tr>`).join("") : '<tr><td colspan="6" class="empty-cell">No matching visitor records found.</td></tr>';
  } catch (error) {
    $("visitorRows").innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHTML(error.message)}</td></tr>`;
  }
}
$("searchInput").addEventListener("input", loadVisitors);
$("statusFilter").addEventListener("change", loadVisitors);
$("visitorRows").addEventListener("click", async event => {
  const button = event.target.closest("[data-checkout]");
  if (!button) return;
  if (!confirm("Mark this visitor as checked out?")) return;
  button.disabled = true;
  try {
    await api(`/api/visitors/${button.dataset.checkout}/checkout`, { method: "PATCH" });
    showToast("Visitor checked out.");
    loadVisitors();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
});

// Start with the login screen, or restore the current staff session.
if (state.staff) navigate();
else navigate();
