const appEl = document.getElementById("appView");
const authViewEl = document.getElementById("authView");
const loginBtn = document.getElementById("loginBtn");
const authForm = document.getElementById("authForm");
const usernameInput = document.getElementById("loginUsername");
const passwordInput = document.getElementById("loginPassword");
const rememberLoginInput = document.getElementById("rememberLogin");
const authErrorEl = document.getElementById("authError");
const logoutBtn = document.getElementById("logoutBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const changePasswordDialog = document.getElementById("changePasswordDialog");
const savePasswordBtn = document.getElementById("savePasswordBtn");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordErrorEl = document.getElementById("passwordError");

let currentUser = null;
let currentProfile = null;

function showApp() {
  authViewEl.hidden = true;
  appEl.hidden = false;
}

function showAuth() {
  appEl.hidden = true;
  authViewEl.hidden = false;
  passwordInput.value = "";
  authErrorEl.hidden = true;
  usernameInput.focus();
}

function isCoach() {
  return currentProfile?.role === "coach";
}


function showError(msg) {
  authErrorEl.textContent = msg;
  authErrorEl.hidden = false;
}

async function login() {
  const username = usernameInput.value.toLowerCase().trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showError("Ievadi lietotājvārdu un paroli");
    return;
  }

  const email = username + "@skmitauer.app";
  authErrorEl.hidden = true;

  localStorage.setItem("rememberLogin", String(rememberLoginInput.checked));

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    showError(error?.message || "Pieslēgšanās neizdevās");
    return;
  }

  currentUser = data.user;
  currentProfile = await getProfile(currentUser.id);

  if (!currentProfile) {
    showError("Profils neeksistē. Sazinies ar administratoru.");
    await supabase.auth.signOut();
    currentUser = null;
    return;
  }

  await initApp();
  showApp();
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showAuth();
}

async function changePassword() {
  const newPwd = newPasswordInput.value;
  const confirmPwd = confirmPasswordInput.value;
  passwordErrorEl.hidden = true;

  if (newPwd.length < 5) {
    passwordErrorEl.textContent = "Parolei jābūt vismaz 5 rakstzīmēm";
    passwordErrorEl.hidden = false;
    return;
  }
  if (newPwd !== confirmPwd) {
    passwordErrorEl.textContent = "Paroles nesakrīt";
    passwordErrorEl.hidden = false;
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: newPwd });
  if (error) {
    passwordErrorEl.textContent = error.message || "Neizdevās nomainīt paroli";
    passwordErrorEl.hidden = false;
    return;
  }

  changePasswordDialog.close();
  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
}

loginBtn.addEventListener("click", login);
authForm.addEventListener("submit", function(e){ e.preventDefault(); login(); });
logoutBtn.addEventListener("click", logout);

changePasswordBtn.addEventListener("click", () => {
  passwordErrorEl.hidden = true;
  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  changePasswordDialog.showModal();
});
savePasswordBtn.addEventListener("click", changePassword);
