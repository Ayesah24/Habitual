/* ===== Habitual authentication layer ===== */
(function () {
  const USERS_KEY = "habitual_users";
  const SESSION_KEY = "habitual_session";
  const $a = (id) => document.getElementById(id);

  function emailKey(v) { return String(v ?? "").trim().toLowerCase(); }

  function readUsers() {
    const keys = [USERS_KEY, "habitualUsers", "habitual_accounts", "accounts", "users"];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const out = {};
          data.forEach(u => {
            const e = emailKey(u?.email || u?.Email || u?.mail);
            if (e) out[e] = u;
          });
          if (Object.keys(out).length) return out;
        } else if (data && typeof data === "object") {
          // Supports both {email: user} and a wrapper such as {users: {...}}.
          const candidate = data.users && typeof data.users === "object" ? data.users : data;
          const out = {};
          Object.entries(candidate).forEach(([k, u]) => {
            if (u && typeof u === "object") {
              const e = emailKey(u.email || u.Email || k);
              if (e) out[e] = u;
            }
          });
          if (Object.keys(out).length) return out;
        }
      } catch (_) {}
    }
    return {};
  }

  function writeUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return true;
    } catch (_) {
      return false;
    }
  }

  function findUser(email) {
    const wanted = emailKey(email);
    const users = readUsers();
    const key = Object.keys(users).find(k => emailKey(k) === wanted);
    return key ? { users, key, user: users[key] || {} } : null;
  }

  function getPassword(user) {
    if (!user || typeof user !== "object") return "";
    const value = user.password ?? user.pass ?? user.userPassword ?? user.pwd ?? "";
    return String(value);
  }

  function setMessage(text, success) {
    const el = $a("authError");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("success-message", !!success);
  }

  function showAuth(show) {
    $a("authScreen")?.classList.toggle("hidden", !show);
    document.body.classList.toggle("auth-active", !!show);
  }

  function setUserUI(email) {
    const box = $a("accountBox");
    if (!box) return;
    if (!email) { box.style.display = "none"; return; }
    const found = findUser(email);
    const user = found?.user || {};
    const username = String(user.username || user.name || email.split("@")[0]);
    box.style.display = "flex";
    if ($a("accountName")) $a("accountName").textContent = username;
    if ($a("accountEmail")) $a("accountEmail").textContent = email;
    if ($a("accountAvatar")) $a("accountAvatar").textContent = username.charAt(0).toUpperCase();
  }

  function updateFields(signup) {
    const ug = $a("signupUsernameGroup"), cg = $a("signupConfirmGroup");
    if (ug) ug.style.display = signup ? "" : "none";
    if (cg) cg.style.display = signup ? "" : "none";
    if ($a("authUsername")) $a("authUsername").required = signup;
    if ($a("authConfirmPassword")) $a("authConfirmPassword").required = signup;
    if ($a("authPassword")) $a("authPassword").autocomplete = signup ? "new-password" : "current-password";
  }

  function switchMode(signup) {
    const form = $a("authForm"); if (!form) return;
    form.dataset.mode = signup ? "signup" : "login";
    if ($a("authTitle")) $a("authTitle").textContent = signup ? "Create your account" : "Welcome back";
    if ($a("authSubtitle")) $a("authSubtitle").textContent = signup ? "Create an account to start tracking your habits." : "Log in to continue to your dashboard.";
    if ($a("authSubmit")) $a("authSubmit").textContent = signup ? "Sign Up" : "Log In";
    if ($a("authSwitch")) $a("authSwitch").textContent = signup ? "Already have an account? Log In" : "Don't have an account? Sign Up";
    updateFields(signup); setMessage("");
  }

  function startSession(email) {
    localStorage.setItem(SESSION_KEY, emailKey(email));
    setUserUI(emailKey(email));
    showAuth(false);
    if (typeof load === "function") habits = load();
    if (typeof render === "function") render();
  }

  function doLogin() {
    const email = emailKey($a("authEmail")?.value);
    const password = String($a("authPassword")?.value ?? "");
    if (!email || !password) return setMessage("Please enter your email and password.");
    const found = findUser(email);
    if (!found) return setMessage("Account not found. Please check your email or sign up first.");
    const saved = getPassword(found.user);
    if (saved !== password) return setMessage("Incorrect password. Please enter the same password you used during sign up.");

    // Normalize/migrate the account into the one official storage key.
    const users = found.users;
    users[email] = { ...found.user, email };
    if (!writeUsers(users)) return setMessage("Login could not be saved. Please enable browser site storage.");
    startSession(email);
  }

  function doSignup() {
    const email = emailKey($a("authEmail")?.value);
    const username = String($a("authUsername")?.value ?? "").trim();
    const password = String($a("authPassword")?.value ?? "");
    const confirm = String($a("authConfirmPassword")?.value ?? "");
    const users = readUsers();
    if (!username) return setMessage("Please enter a username.");
    if (!email) return setMessage("Please enter your email.");
    if (password.length < 4) return setMessage("Password must be at least 4 characters.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    if (findUser(email)) return setMessage("An account with this email already exists. Use Log In instead.");
    if (Object.values(users).some(u => String(u?.username || u?.name || "").trim().toLowerCase() === username.toLowerCase())) return setMessage("That username is already taken.");

    users[email] = { email, username, name: username, password };
    if (!writeUsers(users)) return setMessage("Could not save your account. Please enable browser site storage.");

    // IMPORTANT: verify the password was actually written before continuing.
    const saved = findUser(email);
    if (!saved || getPassword(saved.user) !== password) return setMessage("Account could not be verified after sign up. Please try again.");

    // Automatically log in after signup. Logging out and logging back in will also work.
    startSession(email);
    setMessage("");
  }

  function doForgotPassword() {
    const email = emailKey(window.prompt("Enter the email address you used when you signed up:"));
    if (!email) return;
    const found = findUser(email);
    if (!found) return setMessage("No account was found with that email address.");
    const newPassword = window.prompt("Enter your new password (at least 4 characters):");
    if (newPassword === null) return;
    if (newPassword.length < 4) return setMessage("Password must be at least 4 characters.");
    const confirm = window.prompt("Re-enter your new password:");
    if (confirm === null) return;
    if (newPassword !== confirm) return setMessage("Passwords do not match.");

    const users = readUsers();
    const key = Object.keys(users).find(k => emailKey(k) === email);
    if (!key) return setMessage("Account could not be found. Please try again.");
    users[key] = { ...users[key], email, password: newPassword };
    if (key !== email) { users[email] = users[key]; delete users[key]; }
    if (!writeUsers(users)) return setMessage("Could not save the new password. Please enable browser site storage.");
    const verify = findUser(email);
    if (!verify || getPassword(verify.user) !== newPassword) return setMessage("Password reset could not be verified. Please try again.");
    localStorage.removeItem(SESSION_KEY);
    showAuth(true); switchMode(false);
    if ($a("authEmail")) $a("authEmail").value = email;
    if ($a("authPassword")) { $a("authPassword").value = ""; $a("authPassword").focus(); }
    setMessage("Password reset successfully. You can now log in with your new password.", true);
  }

  function doLogout() {
    localStorage.removeItem(SESSION_KEY); habits = [];
    setUserUI(null); showAuth(true); switchMode(false);
    ["authEmail","authPassword","authUsername","authConfirmPassword"].forEach(id => { if ($a(id)) $a(id).value = ""; });
    $a("authEmail")?.focus();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const session = emailKey(localStorage.getItem(SESSION_KEY));
    if (session && findUser(session)) { startSession(session); }
    else { localStorage.removeItem(SESSION_KEY); habits = []; setUserUI(null); showAuth(true); }
    switchMode(false);

    const form = $a("authForm");
    form?.addEventListener("submit", e => { e.preventDefault(); form.dataset.mode === "signup" ? doSignup() : doLogin(); });
    $a("authSwitch")?.addEventListener("click", e => { e.preventDefault(); switchMode(form?.dataset.mode !== "signup"); });
    $a("forgotPassword")?.addEventListener("click", doForgotPassword);
    $a("sidebarLogout")?.addEventListener("click", doLogout);
  });
})();

const LEGACY_KEY="habitual_habits";const THEME="habitual_theme";
function habitStorageKey(){
  const email=(localStorage.getItem("habitual_session")||"").trim().toLowerCase();
  return email ? "habitual_habits_"+encodeURIComponent(email) : "habitual_habits_guest";
}
let habits=load();let filter="all";const $=id=>document.getElementById(id);function id(){return Date.now()+Math.random().toString(16).slice(2)}function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}function load(){
  try{
    const key=habitStorageKey();
    let x=localStorage.getItem(key);
    if(x)return JSON.parse(x);

    // One-time migration of old demo data to the currently logged-in account.
    const email=(localStorage.getItem("habitual_session")||"").trim();
    if(email){
      const legacy=localStorage.getItem(LEGACY_KEY);
      if(legacy){
        localStorage.setItem(key,legacy);
        return JSON.parse(legacy);
      }
    }
  }catch(e){}
  return [];
}
function save(){localStorage.setItem(habitStorageKey(),JSON.stringify(habits))}function today(){return dateKey()}function scheduled(h){return h.days.includes(new Date().getDay())}function done(h,d=today()){return !!h.completions?.[d]}function toggle(h,d=today()){if(!h.completions)h.completions={};h.completions[d]=!h.completions[d];save();render();toast(h.completions[d]?"Habit completed!":"Habit unchecked.")}function streak(h){let n=0,d=new Date();while(done(h,dateKey(d))){n++;d.setDate(d.getDate()-1)}return n}function best(h){let ds=Object.keys(h.completions||{}).filter(x=>h.completions[x]).sort();let b=0,c=0,p=null;for(const x of ds){if(p){let a=new Date(p+"T00:00:00"),z=new Date(x+"T00:00:00");if((z-a)/864e5===1)c++;else c=1}else c=1;b=Math.max(b,c);p=x}return b}function esc(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}function pct(a,b){return b?Math.round(a/b*100):0}function render(){let t=habits.filter(scheduled),c=t.filter(h=>done(h)).length;$("currentDate").textContent=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});$("todayProgress").textContent=pct(c,t.length)+"%";$("completedToday").textContent=`${c} / ${t.length}`;$("totalHabits").textContent=habits.length;let bs=habits.reduce((m,h)=>Math.max(m,best(h)),0);$("bestStreak").textContent=bs+" days";$("progressBestStreak").textContent=bs+" days";$("activeHabits").textContent=habits.length;let total=habits.reduce((n,h)=>n+Object.values(h.completions||{}).filter(Boolean).length,0);$("totalCompletions").textContent=total;renderToday(t);renderAll();renderCharts();renderHistory();$("averageCompletion").textContent=weekly()+"%"}function renderToday(list){let box=$("todayHabits"),empty=$("emptyToday");box.innerHTML="";empty.classList.toggle("show",list.length===0);list.forEach(h=>{let e=document.createElement("div");e.className="habit-item";e.innerHTML=`<div class="habit-icon">${h.icon}</div><div class="habit-info"><h3>${esc(h.name)}</h3><p>${h.category} • 🔥 ${streak(h)} day streak</p></div><button class="check-btn ${done(h)?"completed":""}" onclick="toggleById('${h.id}')">${done(h)?"✓":""}</button>`;box.appendChild(e)})}function renderAll(){let box=$("allHabits"),empty=$("emptyAll");let list=filter==="all"?habits:habits.filter(h=>h.category===filter);box.innerHTML="";empty.classList.toggle("show",list.length===0);list.forEach(h=>{let e=document.createElement("div");e.className="habit-card";e.innerHTML=`<div class="habit-card-top"><div class="habit-card-icon">${h.icon}</div><span class="category">${h.category}</span></div><h3>${esc(h.name)}</h3><p>${h.days.length===7?"Every day":h.days.length+" days per week"}</p><div class="card-footer"><span class="streak">🔥 ${streak(h)} day streak</span><div class="card-actions"><button class="icon-btn" onclick="edit('${h.id}')">✎</button><button class="icon-btn" onclick="removeHabit('${h.id}')">×</button><button class="check-btn ${done(h)?"completed":""}" onclick="toggleById('${h.id}')">${done(h)?"✓":""}</button></div></div>`;box.appendChild(e)})}function renderCharts(){let data=weekData();$("weekChart").innerHTML=data.map(x=>`<div class="day-column"><div class="day-bar-container"><div class="day-bar" style="height:${x.p}%"></div></div><span class="day-label">${x.label}</span></div>`).join("");$("largeWeekChart").innerHTML=data.map(x=>`<div class="large-day"><div class="large-bar-container"><div class="large-bar" style="height:${x.p}%"></div></div><span>${x.label}</span></div>`).join("");$("weeklyCompletion").textContent=weekly()+"%"}function weekData(){let out=[];for(let i=6;i>=0;i--){let d=new Date();d.setDate(d.getDate()-i);let k=dateKey(d),eligible=habits.filter(h=>h.days.includes(d.getDay())),doneN=eligible.filter(h=>done(h,k)).length;out.push({label:d.toLocaleDateString("en-US",{weekday:"short"}).slice(0,2),p:pct(doneN,eligible.length)})}return out}function weekly(){let a=weekData();return pct(a.reduce((n,x)=>n+x.p,0),a.length*100)}function renderHistory(){let arr=[];habits.forEach(h=>Object.keys(h.completions||{}).filter(d=>h.completions[d]).forEach(d=>arr.push({h,d})));arr.sort((a,b)=>b.d.localeCompare(a.d));let box=$("historyList"),empty=$("emptyHistory");box.innerHTML="";empty.classList.toggle("show",!arr.length);arr.slice(0,30).forEach(x=>{let e=document.createElement("div");e.className="history-item";e.innerHTML=`<div class="history-icon">✓</div><div class="history-info"><strong>${esc(x.h.name)}</strong><span>${x.h.icon} ${x.h.category}</span></div><span class="history-date">${x.d===today()?"Today":format(x.d)}</span>`;box.appendChild(e)})}function format(d){return new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}function toggleById(i){let h=habits.find(x=>x.id==i);if(h)toggle(h)}function openModal(h=null){$("habitModal").classList.add("show");$("modalTitle").textContent=h?"Edit Habit":"Create a Habit";$("habitId").value=h?.id||"";$("habitName").value=h?.name||"";$("habitCategory").value=h?.category||"personal";$("habitIcon").value=h?.icon||"✓";document.querySelectorAll(".day-checkbox").forEach(x=>x.checked=h?h.days.includes(Number(x.value)):[1,2,3,4,5].includes(Number(x.value)));$("habitName").focus()}function closeModal(){$("habitModal").classList.remove("show")}function edit(i){let h=habits.find(x=>x.id==i);if(h)openModal(h)}function removeHabit(i){if(!confirm("Delete this habit?"))return;habits=habits.filter(h=>h.id!=i);save();render();toast("Habit deleted.")}function toast(m){$("toastMessage").textContent=m;let t=$("toast");t.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>t.classList.remove("show"),2200)}function nav(section){document.querySelectorAll(".page-section").forEach(x=>x.classList.toggle("active",x.id===section));document.querySelectorAll(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.section===section));location.hash=section;sidebar.classList.remove("open")}document.querySelectorAll(".nav-link").forEach(x=>x.addEventListener("click",e=>{e.preventDefault();nav(x.dataset.section)}));document.querySelectorAll("[data-section-link]").forEach(x=>x.addEventListener("click",()=>nav(x.dataset.sectionLink)));function setup(){[$("openAddHabit"),$("openAddHabit2"),$("emptyAddHabit")].forEach(x=>x?.addEventListener("click",()=>openModal()));$("closeModal").onclick=closeModal;$("cancelModal").onclick=closeModal;$("habitModal").addEventListener("click",e=>{if(e.target.id==="habitModal")closeModal()});$("habitForm").addEventListener("submit",e=>{e.preventDefault();let name=$("habitName").value.trim();let days=[...document.querySelectorAll(".day-checkbox:checked")].map(x=>Number(x.value));if(!name||!days.length){alert("Enter a habit name and select at least one day.");return}let data={name,category:$("habitCategory").value,icon:$("habitIcon").value,days,completions:{}};let existing=$("habitId").value;if(existing){let h=habits.find(x=>x.id==existing);if(h)Object.assign(h,data)}else habits.push({id:id(),...data});save();closeModal();render();toast(existing?"Habit updated!":"Habit created!")});document.querySelectorAll(".filter-btn").forEach(x=>x.addEventListener("click",()=>{document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));x.classList.add("active");filter=x.dataset.filter;renderAll()}));$("themeBtn").onclick=()=>{document.body.classList.toggle("dark");let dark=document.body.classList.contains("dark");localStorage.setItem(THEME,dark?"dark":"light");$("themeText").textContent=dark?"Light Mode":"Dark Mode"};$("menuBtn").onclick=()=>sidebar.classList.toggle("open");let saved=localStorage.getItem(THEME);if(saved==="dark"){document.body.classList.add("dark");$("themeText").textContent="Light Mode"}if(location.hash)nav(location.hash.slice(1));render()}document.addEventListener("DOMContentLoaded",setup);