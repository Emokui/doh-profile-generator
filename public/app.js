"use strict";

const {
  DOMAINS,
  buildProfile,
  normalizeDohUrl,
  safeFilename,
} = window.ProfileGenerator;

const form = document.querySelector("#profile-form");
const dohInput = document.querySelector("#doh-url");
const nameInput = document.querySelector("#profile-name");
const dohError = document.querySelector("#doh-error");
const nameError = document.querySelector("#name-error");
const clearButton = document.querySelector("#clear-url");
const domainList = document.querySelector("#domain-list");
const domainCount = document.querySelector("#domain-count");
const successPanel = document.querySelector("#success-panel");
const successMessage = document.querySelector("#success-message");

function downloadProfile(profile, filename) {
  const blob = new Blob([profile], {
    type: "application/x-apple-aspen-config;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

function showError(input, output, message) {
  input.setAttribute("aria-invalid", "true");
  output.textContent = message;
}

function clearError(input, output) {
  input.removeAttribute("aria-invalid");
  output.textContent = "";
}

function renderDomains() {
  domainCount.textContent = `${DOMAINS.length} 个域名`;
  const fragment = document.createDocumentFragment();

  for (const domain of DOMAINS) {
    const item = document.createElement("li");
    item.textContent = domain;
    fragment.append(item);
  }

  domainList.replaceChildren(fragment);
}

function updateClearButton() {
  clearButton.hidden = dohInput.value.length === 0;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearError(dohInput, dohError);
  clearError(nameInput, nameError);
  successPanel.hidden = true;

  let dohUrl;
  const profileName = nameInput.value.trim();
  let isValid = true;

  try {
    dohUrl = normalizeDohUrl(dohInput.value);
  } catch (error) {
    showError(dohInput, dohError, error.message);
    isValid = false;
  }

  if (!profileName) {
    showError(nameInput, nameError, "请输入描述文件名称。");
    isValid = false;
  }

  if (!isValid) {
    return;
  }

  dohInput.value = dohUrl;
  const filename = safeFilename(profileName);
  const profile = buildProfile(dohUrl, profileName);
  downloadProfile(profile, filename);

  successMessage.textContent = `${filename} 已开始下载，包含 ${DOMAINS.length} 个分流域名。`;
  successPanel.hidden = false;
});

dohInput.addEventListener("input", () => {
  updateClearButton();
  clearError(dohInput, dohError);
  successPanel.hidden = true;
});

nameInput.addEventListener("input", () => {
  clearError(nameInput, nameError);
  successPanel.hidden = true;
});

clearButton.addEventListener("click", () => {
  dohInput.value = "";
  updateClearButton();
  clearError(dohInput, dohError);
  dohInput.focus();
});

renderDomains();
updateClearButton();
