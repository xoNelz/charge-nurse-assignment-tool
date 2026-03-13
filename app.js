(() => {
  function getShiftType() {
    const day = document.getElementById("shift-day");
    return day && day.checked ? "Day" : "Night";
  }

  function getNurseCount() {
    const input = document.getElementById("nurse-count");
    const raw = input ? input.value.trim() : "";
    const value = Number.parseInt(raw, 10);
    return { raw, value };
  }

  function getSelectedRooms() {
    return Array.from(
      document.querySelectorAll('input[name="occupiedRooms"]:checked'),
      (el) => el.value,
    );
  }

  function getAllRoomInputs() {
    return Array.from(
      document.querySelectorAll('input[name="occupiedRooms"]'),
    );
  }

  function setRoomSelection(checked) {
    const inputs = getAllRoomInputs();
    inputs.forEach((input) => {
      input.checked = checked;
      const label = input.nextElementSibling;
      if (label && label.classList && label.classList.contains("room-tile")) {
        label.classList.toggle("room-tile--selected", checked);
      }
    });
  }

  function areAllRoomsSelected() {
    const inputs = getAllRoomInputs();
    return inputs.length > 0 && inputs.every((input) => input.checked);
  }

  function updateToggleRoomsLabel() {
    const toggleBtn = document.getElementById("toggle-rooms");
    if (!toggleBtn) return;
    toggleBtn.textContent = areAllRoomsSelected() ? "Clear All" : "Select All";
  }

  function onToggleRoomsClick() {
    const allSelected = areAllRoomsSelected();
    setRoomSelection(!allSelected);
    updateToggleRoomsLabel();
  }

  function ensureBoardContainer() {
    let board = document.getElementById("board-container");
    if (board) return board;

    board = document.createElement("div");
    board.id = "board-container";
    board.style.display = "none";
    document.body.appendChild(board);
    return board;
  }

  function showSetup() {
    const setup = document.querySelector(".app-main");
    const board = document.getElementById("board-container");

    if (setup) setup.style.display = "";
    if (board) board.style.display = "none";
  }

  function createUnassignedPatientsMarkup(rooms) {
    if (!rooms || rooms.length === 0) {
      return '<span class="board-section__empty">No unassigned patients.</span>';
    }

    return rooms
      .map(
        (room) => `
              <div class="patient-card">
                <span class="patient-card__room">${room}</span>
              </div>
            `,
      )
      .join("");
  }

  function createNurseSlotsMarkup(nurseCount, shiftType) {
    if (!Number.isFinite(nurseCount) || nurseCount < 1) return "";

    const isDay = shiftType === "Day";
    const chargeMax = isDay ? "0/0" : "0/1";

    let slots = `
              <div class="nurse-slot">
                <div class="nurse-slot__header">
                  <span class="nurse-slot__title">Charge</span>
                  <span class="nurse-slot__badge">${chargeMax}</span>
                </div>
                <div class="nurse-slot__body"></div>
              </div>
            `;

    for (let i = 2; i <= nurseCount; i++) {
      slots += `
              <div class="nurse-slot">
                <div class="nurse-slot__header">
                  <span class="nurse-slot__title">Nurse ${i}</span>
                  <span class="nurse-slot__badge">0/4</span>
                </div>
                <div class="nurse-slot__body"></div>
              </div>
            `;
    }

    return slots;
  }

  function showBoard({ shiftType, nurseCount, rooms }) {
    const setup = document.querySelector(".app-main");
    const board = ensureBoardContainer();

    if (setup) setup.style.display = "none";
    board.style.display = "";

    const nurseLabel =
      nurseCount === 1 ? "1 nurse" : `${nurseCount} nurses`;

    board.innerHTML = `
      <div class="assignment-board">
        <header class="board-header">
          <div class="board-header__info">
            <span class="board-header__shift">${shiftType} shift</span>
            <span class="board-header__meta">${nurseLabel}</span>
          </div>
          <button
            type="button"
            id="back-to-setup"
            class="button button--secondary board-header__back"
          >
            ← Back to Setup
          </button>
        </header>
        <div class="board-body">
          <section class="board-section board-section--unassigned">
            <h3 class="board-section__title">Unassigned Patients</h3>
            <div class="unassigned-list">
              ${createUnassignedPatientsMarkup(rooms)}
            </div>
          </section>

          <section class="board-section board-section--nurses">
            <h3 class="board-section__title">Nurse Assignments</h3>
            <div class="nurse-grid">
              ${createNurseSlotsMarkup(nurseCount, shiftType)}
            </div>
          </section>

          <section class="board-section board-section--footer">
            <div class="board-footer-row">CNA: (to be assigned)</div>
            <div class="board-footer-row">1:1: (to be assigned)</div>
          </section>
        </div>
      </div>
    `;

    const backBtn = document.getElementById("back-to-setup");
    if (backBtn) backBtn.addEventListener("click", showSetup, { once: true });
  }

  function onGenerateClick() {
    const rooms = getSelectedRooms();
    if (rooms.length === 0) {
      alert("Please select at least one room.");
      return;
    }

    const { raw, value } = getNurseCount();
    const isValidNurseCount =
      raw.length > 0 && Number.isFinite(value) && value >= 1 && value <= 12;

    if (!isValidNurseCount) {
      alert("Please enter a valid number of nurses (1-12).");
      return;
    }

    showBoard({
      shiftType: getShiftType(),
      nurseCount: value,
      rooms,
    });
  }

  function init() {
    const btn = document.getElementById("generate-board");
    if (btn) {
      btn.addEventListener("click", onGenerateClick);
    }

    const toggleRoomsBtn = document.getElementById("toggle-rooms");
    if (toggleRoomsBtn) {
      toggleRoomsBtn.addEventListener("click", onToggleRoomsClick);
      updateToggleRoomsLabel();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

