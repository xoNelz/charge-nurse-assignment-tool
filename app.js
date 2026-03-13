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
              <div class="patient-card" data-room="${room}">
                <span class="patient-card__room">${room}</span>
              </div>
            `,
      )
      .join("");
  }

  function getChargeSlotConfig(shiftType) {
    if (shiftType === "Day") {
      return { display: "0/0", maxPatients: 0 };
    }

    return { display: "0/1", maxPatients: 1 };
  }

  function createNurseSlotsMarkup(nurseCount, shiftType) {
    if (!Number.isFinite(nurseCount) || nurseCount < 1) return "";

    const chargeConfig = getChargeSlotConfig(shiftType);

    let slots = `
              <div class="nurse-slot">
                <div class="nurse-slot__header">
                  <span class="nurse-slot__title">Charge</span>
                  <span class="nurse-slot__badge">${chargeConfig.display}</span>
                </div>
                <div class="nurse-slot__body drop-zone" data-max="${chargeConfig.maxPatients}"></div>
              </div>
            `;

    for (let i = 2; i <= nurseCount; i++) {
      slots += `
              <div class="nurse-slot">
                <div class="nurse-slot__header">
                  <span class="nurse-slot__title">Nurse ${i}</span>
                  <span class="nurse-slot__badge">0/4</span>
                </div>
                <div class="nurse-slot__body drop-zone" data-max="4"></div>
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
          <section class="board-section board-section--unassigned drop-zone" data-zone="unassigned">
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

    setupDragAndDrop(board);

    const backBtn = document.getElementById("back-to-setup");
    if (backBtn) backBtn.addEventListener("click", showSetup, { once: true });
  }

  let draggedCard = null;
  let dragOriginParent = null;
  let dragOriginNextSibling = null;
  let dragHadValidDrop = false;

  function updateNurseSlotCounts() {
    const slots = document.querySelectorAll(".nurse-slot");
    slots.forEach((slot) => {
      const body = slot.querySelector(".nurse-slot__body");
      const badge = slot.querySelector(".nurse-slot__badge");
      if (!body || !badge) return;

      const max = Number.parseInt(body.dataset.max || "0", 10);
      const count = body.querySelectorAll(".patient-card").length;
      const safeMax = Number.isFinite(max) ? max : 0;
      badge.textContent = `${count}/${safeMax}`;
    });
  }

  function setupDragAndDrop(boardRoot) {
    const cards = boardRoot.querySelectorAll(".patient-card");
    cards.forEach((card) => {
      card.setAttribute("draggable", "true");
      card.addEventListener("dragstart", onCardDragStart);
      card.addEventListener("dragend", onCardDragEnd);
    });

    const dropZones = boardRoot.querySelectorAll(
      ".board-section--unassigned, .nurse-slot__body",
    );

    dropZones.forEach((zone) => {
      zone.addEventListener("dragover", onDropZoneDragOver);
      zone.addEventListener("dragenter", onDropZoneDragEnter);
      zone.addEventListener("dragleave", onDropZoneDragLeave);
      zone.addEventListener("drop", onDropZoneDrop);
    });

    updateNurseSlotCounts();
  }

  function onCardDragStart(event) {
    draggedCard = event.currentTarget;
    dragOriginParent = draggedCard.parentElement;
    dragOriginNextSibling = draggedCard.nextElementSibling;
    dragHadValidDrop = false;
    draggedCard.classList.add("patient-card--dragging");
    draggedCard.style.opacity = "0.4";
    event.dataTransfer.effectAllowed = "move";
  }

  function onCardDragEnd() {
    if (!draggedCard) return;

    if (!dragHadValidDrop && dragOriginParent) {
      if (
        dragOriginNextSibling &&
        dragOriginNextSibling.parentElement === dragOriginParent
      ) {
        dragOriginParent.insertBefore(draggedCard, dragOriginNextSibling);
      } else {
        dragOriginParent.appendChild(draggedCard);
      }
    }

    draggedCard.classList.remove("patient-card--dragging");
    draggedCard.style.opacity = "";
    draggedCard = null;
    dragOriginParent = null;
    dragOriginNextSibling = null;
    dragHadValidDrop = false;

    document
      .querySelectorAll(".drop-zone--active")
      .forEach((zone) => zone.classList.remove("drop-zone--active"));

    updateNurseSlotCounts();
  }

  function onDropZoneDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onDropZoneDragEnter(event) {
    event.preventDefault();
    const zone = event.currentTarget;
    zone.classList.add("drop-zone--active");
  }

  function onDropZoneDragLeave(event) {
    const zone = event.currentTarget;
    zone.classList.remove("drop-zone--active");
  }

  function onDropZoneDrop(event) {
    event.preventDefault();
    const zone = event.currentTarget;
    zone.classList.remove("drop-zone--active");
    if (!draggedCard) return;

    dragHadValidDrop = true;

    if (zone.classList.contains("board-section--unassigned")) {
      const list = zone.querySelector(".unassigned-list");
      if (list) {
        list.appendChild(draggedCard);
      } else {
        zone.appendChild(draggedCard);
      }
    } else {
      zone.appendChild(draggedCard);
    }

    updateNurseSlotCounts();
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

