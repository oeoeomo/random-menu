const presets = {
  lunch: ["김치찌개", "돈가스", "초밥", "마라탕", "파스타", "쌀국수"],
  penalty: ["애교 부리기", "노래 한 곡", "커피 쏘기", "설거지하기", "셀카 찍기", "칭찬 3번"],
  weekend: ["집에서 쉬기", "공원 산책", "전시회 가기", "맛집 탐방", "영화 보기", "근교 나들이"],
};

const colors = ["#f3bf68", "#ed8066", "#8fb9a0", "#829ec6", "#c49bc5", "#e6a85d", "#76b7b1", "#d9859b", "#91a96c", "#ef9c77", "#8f9bc7", "#c5a16d"];
const minCandidates = 2;
const maxCandidates = 12;
const storageKey = "dolly-dolly-candidates";

const canvas = document.querySelector("#wheel");
const context = canvas.getContext("2d");
const candidateList = document.querySelector("#candidate-list");
const candidateInput = document.querySelector("#candidate-input");
const addForm = document.querySelector("#add-form");
const countBadge = document.querySelector("#candidate-count");
const helperText = document.querySelector("#helper-text");
const spinButton = document.querySelector("#spin-button");
const result = document.querySelector("#result");
const resultName = document.querySelector("#result-name");
const presetButtons = [...document.querySelectorAll(".preset-button")];

let candidates = loadCandidates();
let rotation = 0;
let spinning = false;

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
  drawWheel();
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
  clearResult();
  saveCandidates();
  renderCandidates();
  candidateInput.value = "";
  candidateInput.focus();
}

function removeCandidate(index) {
  if (candidates.length <= minCandidates || spinning) return;
  candidates.splice(index, 1);
  clearResult();
  saveCandidates();
  renderCandidates();
}

function setPreset(name) {
  if (spinning) return;
  candidates = [...presets[name]];
  presetButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.preset === name));
  clearResult();
  saveCandidates();
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

presetButtons.forEach((button) => {
  button.addEventListener("click", () => setPreset(button.dataset.preset));
});

spinButton.addEventListener("click", spin);

renderCandidates();
