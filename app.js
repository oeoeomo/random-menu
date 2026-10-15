const presets = {
  lunch: ["김치찌개", "돈가스", "초밥", "마라탕", "파스타", "쌀국수"],
  penalty: ["애교 부리기", "노래 한 곡", "커피 쏘기", "설거지하기", "셀카 찍기", "칭찬 3번"],
  weekend: ["집에서 쉬기", "공원 산책", "전시회 가기", "맛집 탐방", "영화 보기", "근교 나들이"],
};

const colors = ["#f3bf68", "#ed8066", "#8fb9a0", "#829ec6", "#c49bc5", "#e6a85d", "#76b7b1", "#d9859b", "#91a96c", "#ef9c77", "#8f9bc7", "#c5a16d"];
const minCandidates = 2;
const maxCandidates = 12;
const storageKey = "dolly-dolly-candidates";
const savedPresetsStorageKey = "dolly-dolly-presets";

const canvas = document.querySelector("#wheel");
const context = canvas.getContext("2d");
const candidateList = document.querySelector("#candidate-list");
const candidateInput = document.querySelector("#candidate-input");
const addForm = document.querySelector("#add-form");
const presetSaveForm = document.querySelector("#preset-save-form");
const presetNameInput = document.querySelector("#preset-name-input");
const presetStatus = document.querySelector("#preset-status");
const savedPresetsSection = document.querySelector("#saved-presets");
const savedPresetList = document.querySelector("#saved-preset-list");
const countBadge = document.querySelector("#candidate-count");
const helperText = document.querySelector("#helper-text");
const spinButton = document.querySelector("#spin-button");
const result = document.querySelector("#result");
const resultName = document.querySelector("#result-name");
const presetButtons = [...document.querySelectorAll(".preset-button")];

let customPresets = loadCustomPresets();
let candidates = loadCandidates();
let activePresetId = findActivePresetId(candidates);
let rotation = 0;
let spinning = false;

function loadCustomPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem(savedPresetsStorageKey));
    if (!Array.isArray(saved)) return [];

    const names = new Set();
    return saved.filter((preset) => {
      if (!preset || typeof preset.name !== "string" || !Array.isArray(preset.candidates)) return false;
      const name = preset.name.trim();
      const items = preset.candidates.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
      if (!name || names.has(name) || items.length < minCandidates || items.length > maxCandidates) return false;
      names.add(name);
      preset.name = name;
      preset.candidates = items;
      return true;
    });
  } catch (error) {
    console.warn("저장된 프리셋을 불러오지 못했습니다.", error);
    return [];
  }
}

function loadCandidates() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) {
      const valid = saved.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
      if (valid.length >= minCandidates && valid.length <= maxCandidates) return valid;
    }
  } catch (error) {
    console.warn("저장된 룰렛 후보를 불러오지 못했습니다.", error);
  }
  return [...presets.lunch];
}

function saveCandidates() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(candidates));
  } catch (error) {
    console.warn("룰렛 후보를 저장하지 못했습니다.", error);
  }
}

function saveCustomPresets(nextPresets) {
  try {
    localStorage.setItem(savedPresetsStorageKey, JSON.stringify(nextPresets));
    customPresets = nextPresets;
    renderCustomPresets();
    return true;
  } catch (error) {
    console.warn("프리셋을 저장하지 못했습니다.", error);
    presetStatus.textContent = "브라우저 저장 공간에 프리셋을 저장하지 못했어요.";
    return false;
  }
}

function findActivePresetId(items) {
  for (const [name, presetCandidates] of Object.entries(presets)) {
    if (JSON.stringify(items) === JSON.stringify(presetCandidates)) return `builtin:${name}`;
  }
  const matchingPreset = customPresets.find((preset) => JSON.stringify(items) === JSON.stringify(preset.candidates));
  return matchingPreset ? `custom:${matchingPreset.name}` : null;
}

function renderCandidates() {
  candidateList.replaceChildren();
  candidates.forEach((candidate, index) => {
    const item = document.createElement("li");
    item.className = "candidate-item";

    const swatch = document.createElement("span");
    swatch.className = "candidate-swatch";
    swatch.style.backgroundColor = colors[index % colors.length];
    swatch.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "candidate-name";
    name.textContent = candidate;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `${candidate} 삭제`);
    removeButton.disabled = candidates.length <= minCandidates || spinning;
    removeButton.addEventListener("click", () => removeCandidate(index));

    item.append(swatch, name, removeButton);
    candidateList.append(item);
  });

  countBadge.textContent = `${candidates.length}개`;
  candidateInput.disabled = candidates.length >= maxCandidates || spinning;
  addForm.querySelector("button").disabled = candidates.length >= maxCandidates || spinning;
  helperText.textContent = candidates.length >= maxCandidates
    ? "후보를 더 추가하려면 먼저 하나를 삭제해주세요."
    : "후보는 2개 이상, 최대 12개까지 추가할 수 있어요.";
  spinButton.disabled = candidates.length < minCandidates || spinning;
  presetNameInput.disabled = spinning;
  presetSaveForm.querySelector("button").disabled = spinning;
  presetButtons.forEach((button) => {
    button.disabled = spinning;
  });
  renderPresetSelection();
  drawWheel();
}

function renderPresetSelection() {
  presetButtons.forEach((button) => {
    button.classList.toggle("is-active", activePresetId === `builtin:${button.dataset.preset}`);
  });
  savedPresetList.querySelectorAll("[data-custom-preset]").forEach((button) => {
    button.classList.toggle("is-active", activePresetId === `custom:${button.dataset.customPreset}`);
  });
}

function renderCustomPresets() {
  savedPresetList.replaceChildren();
  savedPresetsSection.hidden = customPresets.length === 0;

  customPresets.forEach((preset) => {
    const item = document.createElement("div");
    item.className = "saved-preset-item";

    const loadButton = document.createElement("button");
    loadButton.className = "preset-button";
    loadButton.type = "button";
    loadButton.textContent = preset.name;
    loadButton.dataset.customPreset = preset.name;
    loadButton.setAttribute("aria-label", `${preset.name} 프리셋 불러오기`);
    loadButton.disabled = spinning;
    loadButton.addEventListener("click", () => applyCustomPreset(preset.name));

    const deleteButton = document.createElement("button");
    deleteButton.className = "saved-preset-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `${preset.name} 프리셋 삭제`);
    deleteButton.disabled = spinning;
    deleteButton.addEventListener("click", () => deleteCustomPreset(preset.name));

    item.append(loadButton, deleteButton);
    savedPresetList.append(item);
  });
  renderPresetSelection();
}

function drawWheel() {
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 20;
  const segment = (Math.PI * 2) / candidates.length;

  context.clearRect(0, 0, size, size);
  context.save();
  context.translate(center, center);
  context.rotate(rotation);

  candidates.forEach((candidate, index) => {
    const start = -Math.PI / 2 + index * segment;
    const end = start + segment;

    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, start, end);
    context.closePath();
    context.fillStyle = colors[index % colors.length];
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.85)";
    context.lineWidth = 4;
    context.stroke();

    context.save();
    context.rotate(start + segment / 2);
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = "#fffdf8";
    context.shadowColor = "rgba(82, 54, 36, 0.2)";
    context.shadowBlur = 3;
    context.font = `700 ${labelFontSize(candidates.length)}px "Noto Sans KR", sans-serif`;
    context.fillText(candidate, radius * 0.81, 0, radius * 0.48);
    context.restore();
  });

  context.restore();
}

function labelFontSize(count) {
  if (count <= 4) return 27;
  if (count <= 6) return 23;
  if (count <= 8) return 19;
  return 16;
}

function addCandidate(value) {
  const candidate = value.trim();
  if (!candidate) {
    candidateInput.focus();
    return;
  }
  if (candidates.length >= maxCandidates) return;

  candidates.push(candidate);
  activePresetId = null;
  clearResult();
  saveCandidates();
  renderCandidates();
  candidateInput.value = "";
  candidateInput.focus();
}

function removeCandidate(index) {
  if (candidates.length <= minCandidates || spinning) return;
  candidates.splice(index, 1);
  activePresetId = null;
  clearResult();
  saveCandidates();
  renderCandidates();
}

function setPreset(name) {
  if (spinning || !Object.hasOwn(presets, name)) return;
  candidates = [...presets[name]];
  activePresetId = `builtin:${name}`;
  presetStatus.textContent = "";
  clearResult();
  saveCandidates();
  renderCandidates();
}

function saveCurrentPreset(name) {
  if (spinning) return;
  const presetName = name.trim();
  if (!presetName) {
    presetStatus.textContent = "프리셋 이름을 입력해주세요.";
    presetNameInput.focus();
    return;
  }
  if (customPresets.some((preset) => preset.name.toLocaleLowerCase() === presetName.toLocaleLowerCase())) {
    presetStatus.textContent = "같은 이름의 프리셋이 이미 있어요. 다른 이름을 입력해주세요.";
    presetNameInput.focus();
    return;
  }

  const nextPresets = [...customPresets, { name: presetName, candidates: [...candidates] }];
  if (!saveCustomPresets(nextPresets)) return;

  activePresetId = `custom:${presetName}`;
  presetNameInput.value = "";
  presetStatus.textContent = `“${presetName}” 프리셋을 저장했어요.`;
  renderCandidates();
}

function applyCustomPreset(name) {
  if (spinning) return;
  const preset = customPresets.find((item) => item.name === name);
  if (!preset) return;
  candidates = [...preset.candidates];
  activePresetId = `custom:${preset.name}`;
  presetStatus.textContent = `“${preset.name}” 프리셋을 불러왔어요.`;
  clearResult();
  saveCandidates();
  renderCandidates();
}

function deleteCustomPreset(name) {
  if (spinning) return;
  const nextPresets = customPresets.filter((preset) => preset.name !== name);
  if (nextPresets.length === customPresets.length || !saveCustomPresets(nextPresets)) return;
  if (activePresetId === `custom:${name}`) activePresetId = null;
  presetStatus.textContent = `“${name}” 프리셋을 삭제했어요.`;
  renderCandidates();
}

function clearResult() {
  result.hidden = true;
  resultName.textContent = "";
}

function randomUnit() {
  if (window.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] / 0x100000000;
  }
  return Math.random();
}

function spin() {
  if (spinning || candidates.length < minCandidates) return;
  spinning = true;
  renderCandidates();
  clearResult();
  spinButton.querySelector("span:nth-child(2)").textContent = "돌아가는 중...";

  const count = candidates.length;
  const segment = (Math.PI * 2) / count;
  const winner = Math.floor(randomUnit() * count);
  const withinSegment = 0.16 + randomUnit() * 0.68;
  const targetRotation = normalize(-(winner + withinSegment) * segment);
  const delta = normalize(targetRotation - normalize(rotation)) + (5 + Math.floor(randomUnit() * 3)) * Math.PI * 2;
  const startRotation = rotation;
  const endRotation = rotation + delta;
  const duration = 4400;
  const startTime = performance.now();

  function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    rotation = startRotation + delta * eased;
    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    rotation = normalize(endRotation);
    drawWheel();
    spinning = false;
    resultName.textContent = candidates[winner];
    result.hidden = false;
    spinButton.querySelector("span:nth-child(2)").textContent = "다시 돌리기";
    renderCandidates();
  }

  requestAnimationFrame(animate);
}

function normalize(angle) {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addCandidate(candidateInput.value);
});

presetSaveForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrentPreset(presetNameInput.value);
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => setPreset(button.dataset.preset));
});

spinButton.addEventListener("click", spin);

renderCustomPresets();
renderCandidates();
