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
const soundStorageKey = "dolly-dolly-result-sound";

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
const gameStatus = document.querySelector("#game-status");
const spinButton = document.querySelector("#spin-button");
const result = document.querySelector("#result");
const resultName = document.querySelector("#result-name");
const fireworks = document.querySelector("#fireworks");
const settingsButton = document.querySelector("#settings-button");
const settingsMenu = document.querySelector("#settings-menu");
const clearAllButton = document.querySelector("#clear-all-button");
const soundToggle = document.querySelector("#sound-toggle");
const soundStatus = document.querySelector("#sound-status");
const presetButtons = [...document.querySelectorAll(".preset-button")];

let customPresets = loadCustomPresets();
let candidates = loadCandidates();
let activePresetId = findActivePresetId(candidates);
let rotation = 0;
let spinning = false;
let soundEnabled = loadSoundPreference();
let audioContext = null;
let fireworksTimer = null;

soundToggle.checked = soundEnabled;
soundStatus.textContent = soundEnabled ? "결과 순간에만 재생 · 켜짐" : "결과 순간에만 재생 · 기본 꺼짐";

function loadSoundPreference() {
  try {
    return localStorage.getItem(soundStorageKey) === "on";
  } catch (error) {
    console.warn("효과음 설정을 불러오지 못했습니다.", error);
    return false;
  }
}

function saveSoundPreference() {
  try {
    localStorage.setItem(soundStorageKey, soundEnabled ? "on" : "off");
  } catch (error) {
    console.warn("효과음 설정을 저장하지 못했습니다.", error);
    soundStatus.textContent = "설정을 브라우저에 저장하지 못했어요.";
  }
}

function prepareAudio() {
  if (!window.AudioContext) {
    soundEnabled = false;
    soundToggle.checked = false;
    soundStatus.textContent = "이 브라우저에서는 효과음을 사용할 수 없어요.";
    saveSoundPreference();
    return false;
  }

  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch((error) => {
        if (!soundEnabled) return;
        console.warn("효과음을 시작하지 못했습니다.", error);
        soundEnabled = false;
        soundToggle.checked = false;
        soundStatus.textContent = "효과음을 시작하지 못했어요.";
        saveSoundPreference();
      });
    }
    return true;
  } catch (error) {
    console.warn("효과음을 준비하지 못했습니다.", error);
    soundEnabled = false;
    soundToggle.checked = false;
    soundStatus.textContent = "효과음을 준비하지 못했어요.";
    saveSoundPreference();
    return false;
  }
}

function playResultSound() {
  if (!soundEnabled || !audioContext || audioContext.state !== "running") return;

  const now = audioContext.currentTime;
  [659.25, 880].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + index * 0.07;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.055, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.23);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
  });
}

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
      if (saved.length === 0 || (valid.length > 0 && valid.length <= maxCandidates)) return valid;
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
  if (candidates.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "candidate-empty";
    emptyItem.textContent = "후보가 비어 있어요. 첫 번째 항목을 추가해 보세요.";
    candidateList.append(emptyItem);
  }

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
  clearAllButton.disabled = candidates.length === 0 || spinning;
  helperText.textContent = candidates.length === 0
    ? "항목을 2개 이상 추가하면 룰렛을 돌릴 수 있어요."
    : candidates.length < minCandidates
      ? "룰렛을 돌리려면 항목을 하나 더 추가해주세요."
      : candidates.length >= maxCandidates
        ? "후보를 더 추가하려면 먼저 하나를 삭제해주세요."
        : "항목을 2개 이상, 최대 12개까지 추가할 수 있어요.";
  spinButton.disabled = candidates.length < minCandidates || spinning;
  if (!spinning && candidates.length < minCandidates) {
    gameStatus.textContent = candidates.length === 0 ? "ADD OPTIONS" : "ADD ONE MORE";
  }
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
  const radius = center - 5;
  if (candidates.length === 0) {
    context.clearRect(0, 0, size, size);
    context.save();
    context.translate(center, center);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = "#17202d";
    context.fill();
    context.setLineDash([8, 12]);
    context.strokeStyle = "rgba(211, 250, 85, 0.48)";
    context.lineWidth = 5;
    context.stroke();
    context.setLineDash([]);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#d3fa55";
    context.font = '700 25px Pretendard, sans-serif';
    context.fillText("ADD OPTIONS", 0, -15);
    context.fillStyle = "#a5afc2";
    context.font = '400 17px Pretendard, sans-serif';
    context.fillText("후보를 추가해 주세요", 0, 22);
    context.restore();
    return;
  }

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
    const isRed = index % 2 === 0;
    context.fillStyle = isRed ? "#ed1c2e" : "#fffdf9";
    context.fill();
    context.strokeStyle = isRed ? "rgba(255, 255, 255, 0.75)" : "rgba(72, 68, 65, 0.14)";
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.rotate(start + segment / 2);
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = isRed ? "#fffdf8" : "#373638";
    context.shadowColor = "rgba(82, 54, 36, 0.2)";
    context.shadowBlur = isRed ? 3 : 1;
    context.font = `400 ${labelFontSize(candidates.length)}px Pretendard, sans-serif`;
    context.fillText(candidate, radius * 0.81, 0, radius * 0.48);
    context.restore();
  });

  context.save();
  context.shadowColor = "rgba(73, 50, 23, 0.24)";
  context.shadowBlur = 8;
  context.beginPath();
  context.arc(0, 0, center * 0.19, 0, Math.PI * 2);
  context.fillStyle = "#f4c735";
  context.fill();
  context.restore();

  context.beginPath();
  context.arc(0, 0, center * 0.145, 0, Math.PI * 2);
  context.fillStyle = "#ffe879";
  context.fill();
  context.strokeStyle = "#eab42e";
  context.lineWidth = 3;
  context.stroke();

  context.restore();
}

function labelFontSize(count) {
  if (count <= 4) return 33;
  if (count <= 6) return 29;
  if (count <= 8) return 25;
  return 21;
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
  gameStatus.textContent = candidates.length < minCandidates ? "ADD ONE MORE" : "READY TO PLAY";
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
  gameStatus.textContent = candidates.length < minCandidates ? "ADD ONE MORE" : "READY TO PLAY";
  clearResult();
  saveCandidates();
  renderCandidates();
}

function setPreset(name) {
  if (spinning || !Object.hasOwn(presets, name)) return;
  candidates = [...presets[name]];
  activePresetId = `builtin:${name}`;
  gameStatus.textContent = "READY TO PLAY";
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
  if (candidates.length < minCandidates) {
    presetStatus.textContent = "프리셋으로 저장하려면 후보를 2개 이상 추가해주세요.";
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
  gameStatus.textContent = "READY TO PLAY";
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
  result.classList.remove("is-winning");
  resultName.textContent = "";
  hideFireworks();
}

function hideFireworks() {
  window.clearTimeout(fireworksTimer);
  fireworksTimer = null;
  fireworks.classList.remove("is-active");
  fireworks.hidden = true;
}

function showFireworks() {
  hideFireworks();
  fireworks.hidden = false;
  void fireworks.offsetWidth;
  fireworks.classList.add("is-active");
  fireworksTimer = window.setTimeout(hideFireworks, 1100);
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
  if (soundEnabled) prepareAudio();
  spinning = true;
  gameStatus.textContent = "SPIN IN PROGRESS";
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
  const duration = 5000;
  const startTime = performance.now();

  function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = progress < 0.5
      ? 4 * progress ** 3
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    rotation = startRotation + delta * eased;
    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    rotation = normalize(endRotation);
    drawWheel();
    spinning = false;
    gameStatus.textContent = "ROUND COMPLETE";
    resultName.textContent = candidates[winner];
    result.hidden = false;
    result.classList.remove("is-winning");
    void result.offsetWidth;
    result.classList.add("is-winning");
    showFireworks();
    playResultSound();
    spinButton.querySelector("span:nth-child(2)").textContent = "다시 돌리기";
    renderCandidates();
  }

  requestAnimationFrame(animate);
}

function setSettingsMenuOpen(open) {
  settingsMenu.hidden = !open;
  settingsButton.setAttribute("aria-expanded", String(open));
  settingsButton.setAttribute("aria-label", open ? "설정 메뉴 닫기" : "설정 메뉴 열기");
}

function clearAllCandidates() {
  if (spinning || candidates.length === 0) return;
  if (!window.confirm("룰렛 항목을 모두 삭제할까요?")) return;

  candidates = [];
  activePresetId = null;
  gameStatus.textContent = "ADD OPTIONS";
  spinButton.querySelector("span:nth-child(2)").textContent = "룰렛 돌리기";
  clearResult();
  saveCandidates();
  renderCandidates();
  candidateInput.value = "";
  presetStatus.textContent = "";
  setSettingsMenuOpen(false);
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
settingsButton.addEventListener("click", () => {
  setSettingsMenuOpen(settingsMenu.hidden);
});
soundToggle.addEventListener("change", () => {
  soundEnabled = soundToggle.checked;
  soundStatus.textContent = soundEnabled ? "결과 순간에만 재생 · 켜짐" : "결과 순간에만 재생 · 꺼짐";
  saveSoundPreference();
  if (soundEnabled) prepareAudio();
});
clearAllButton.addEventListener("click", clearAllCandidates);

document.addEventListener("click", (event) => {
  if (!settingsMenu.hidden && !event.target.closest(".header-menu")) {
    setSettingsMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsMenu.hidden) {
    setSettingsMenuOpen(false);
    settingsButton.focus();
  }
});

renderCustomPresets();
renderCandidates();
