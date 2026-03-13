(() => {
  function getShiftType() {
    const day = document.getElementById("shift-day");
    return day && day.checked ? "Day" : "Night";
  }

  const PATIENT_FLAGS = [
    { id: "heparinDrip", label: "Heparin Drip", colorClass: "patient-flag-dot--heparin" },
    { id: "transfusionRisk", label: "Transfusion Risk", colorClass: "patient-flag-dot--transfusion" },
    { id: "isolation", label: "Isolation", colorClass: "patient-flag-dot--isolation" },
    { id: "goingToOr", label: "Going to OR", colorClass: "patient-flag-dot--or" },
    { id: "expectedDischarge", label: "Expected Discharge", colorClass: "patient-flag-dot--discharge" },
    { id: "highAcuity", label: "High Acuity", colorClass: "patient-flag-dot--acuity" },
    { id: "lines", label: "Lines (PICC / Central)", colorClass: "patient-flag-dot--lines" },
    { id: "drains", label: "Drains (JP / IR)", colorClass: "patient-flag-dot--drains" },
    { id: "woundCare", label: "Wound Care", colorClass: "patient-flag-dot--wound" },
    { id: "trach", label: "Trach", colorClass: "patient-flag-dot--trach" },
  ];

  const patientFlags = {};
  let currentShiftType = null;
  let activeModalRoom = null;

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
              <div class="nurse-slot" data-slot-type="charge">
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

    currentShiftType = shiftType;

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
    setupNurseNameEditing(board);

    const backBtn = document.getElementById("back-to-setup");
    if (backBtn) backBtn.addEventListener("click", showSetup, { once: true });
  }

  let draggedCard = null;
  let dragOriginParent = null;
  let dragOriginNextSibling = null;
  let dragHadValidDrop = false;
  let isDraggingCard = false;

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

  function evaluateNurseSlotRules() {
    const slots = document.querySelectorAll(".nurse-slot");

    slots.forEach((slot) => {
      const body = slot.querySelector(".nurse-slot__body");
      const header = slot.querySelector(".nurse-slot__header");
      if (!body || !header) return;

      const isChargeSlot = slot.dataset.slotType === "charge";

      const cards = Array.from(
        body.querySelectorAll(".patient-card[data-room]"),
      );
      const roomIds = cards.map((card) => card.dataset.room);

      const totalPatients = roomIds.length;

      let hasTrachOrHighAcuity = false;
      let hasTrach = false;
      let trachCount = 0;
      let heparinCount = 0;
      let transfusionCount = 0;
      let orCount = 0;
      let dischargeCount = 0;
      let woundCount = 0;
      let isolationCount = 0;

      roomIds.forEach((room) => {
        const flags = patientFlags[room] || {};
        if (flags.trach || flags.highAcuity) {
          hasTrachOrHighAcuity = true;
        }
        if (flags.trach) {
          hasTrach = true;
          trachCount += 1;
        }
        if (flags.heparinDrip) heparinCount += 1;
        if (flags.transfusionRisk) transfusionCount += 1;
        if (flags.goingToOr) orCount += 1;
        if (flags.expectedDischarge) dischargeCount += 1;
        if (flags.woundCare) woundCount += 1;
        if (flags.isolation) isolationCount += 1;
      });

      const violations = [];
      const advisories = [];

      // 1. Patient count > 4
      if (totalPatients > 4) {
        violations.push(`More than 4 patients (${totalPatients}/4)`);
      }

      // 2. Trach/High Acuity max 3 on DAY shift
      if (
        currentShiftType === "Day" &&
        hasTrachOrHighAcuity &&
        totalPatients > 3
      ) {
        violations.push(
          "Trach / high acuity requires max 3 patients on day shift",
        );
      }

      // 3. Heparin conflict: 2 or more Heparin
      if (heparinCount >= 2) {
        violations.push("2+ Heparin Drip patients");
      }

      // 4. Heparin + Transfusion
      if (heparinCount >= 1 && transfusionCount >= 1) {
        violations.push("Heparin Drip with Transfusion Risk");
      }

      // 5. OR overload: 3+ Going to OR
      if (orCount >= 3) {
        violations.push("3+ patients Going to OR");
      }

      // 6. Discharge overload: 3+ Expected Discharge
      if (dischargeCount >= 3) {
        violations.push("3+ Expected Discharge patients");
      }

      // 7. Wound care overload: 3+ Wound Care
      if (woundCount >= 3) {
        violations.push("3+ Wound Care patients");
      }

      // 8. Too many Trach patients on any shift
      if (trachCount >= 2) {
        violations.push("Too many trach patients - max 1 trach per nurse");
      }
      // 9. Isolation overload on a single nurse
      if (isolationCount >= 3) {
        violations.push(
          "Too many isolation patients - max 2 isolation patients per nurse recommended",
        );
      }

      // Night shift Trach advisory: soft warning only
      if (currentShiftType === "Night" && hasTrach && totalPatients <= 4) {
        advisories.push("Trach patient assigned - monitor workload");
      }

      // Charge-specific rules based on shift type
      if (isChargeSlot && currentShiftType === "Day") {
        if (totalPatients > 0) {
          violations.push(
            "Charge nurse should not take patients on day shift",
          );
        }
      }

      if (isChargeSlot && currentShiftType === "Night") {
        if (totalPatients > 1) {
          violations.push(
            "Charge nurse should only take 1 patient on night shift",
          );
        }
      }

      let warnings = slot.querySelector(".nurse-slot__warnings");

      if (violations.length === 0 && advisories.length === 0) {
        if (warnings) {
          warnings.remove();
        }
        header.style.backgroundColor = "";
        header.style.color = "";
        return;
      }

      if (!warnings) {
        warnings = document.createElement("div");
        warnings.className = "nurse-slot__warnings";
        warnings.style.fontSize = "0.8rem";
        warnings.style.padding = "0.3rem 0.7rem 0.2rem";
        header.insertAdjacentElement("afterend", warnings);
      }

      if (violations.length > 0) {
        warnings.style.color = "#b91c1c";
        warnings.style.backgroundColor = "rgba(248, 250, 252, 0.9)";
        warnings.textContent = `Warnings: ${[...violations, ...advisories].join(
          "; ",
        )}`;
        header.style.backgroundColor = "#b91c1c";
        header.style.color = "#ffffff";
      } else {
        // Advisory-only state (e.g., Trach on night shift)
        warnings.style.color = "#92400e";
        warnings.style.backgroundColor = "#fffbeb";
        warnings.textContent = advisories.join("; ");
        header.style.backgroundColor = "";
        header.style.color = "";
      }
    });
  }

  function setupDragAndDrop(boardRoot) {
    const cards = boardRoot.querySelectorAll(".patient-card");
    cards.forEach((card) => {
      card.setAttribute("draggable", "true");
      card.addEventListener("dragstart", onCardDragStart);
      card.addEventListener("dragend", onCardDragEnd);
      card.addEventListener("click", onPatientCardClick);
      const room = card.dataset.room;
      if (room) {
        updateCardsForRoomFlags(room);
      }
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

  function setupNurseNameEditing(boardRoot) {
    const titles = boardRoot.querySelectorAll(".nurse-slot__title");
    titles.forEach((titleEl) => {
      titleEl.addEventListener("click", onNurseTitleClick);
    });
  }

  function onNurseTitleClick(event) {
    const titleEl = event.currentTarget;
    const slot = titleEl.closest(".nurse-slot");
    if (!slot) return;

    // Avoid starting a new edit if one is already active in this slot
    if (slot.querySelector(".nurse-slot__title-input")) {
      return;
    }

    const currentName = titleEl.textContent || "";

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentName.trim();
    input.className = "nurse-slot__title-input";
    input.style.width = "100%";
    input.style.border = "none";
    input.style.background = "transparent";
    input.style.color = "inherit";
    input.style.font = "inherit";

    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      const newName = input.value.trim() || currentName.trim();
      titleEl.textContent = newName;
      titleEl.style.display = "";
      input.remove();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish();
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Cancel and revert to original name
        input.value = currentName.trim();
        finish();
      }
    });

    input.addEventListener("blur", () => {
      finish();
    });

    titleEl.style.display = "none";
    titleEl.parentElement.insertBefore(input, titleEl);
    input.focus();
    input.select();
  }

  function onCardDragStart(event) {
    draggedCard = event.currentTarget;
    dragOriginParent = draggedCard.parentElement;
    dragOriginNextSibling = draggedCard.nextElementSibling;
    dragHadValidDrop = false;
    isDraggingCard = true;
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
    isDraggingCard = false;

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
    evaluateNurseSlotRules();
  }

  function ensureFlagModal() {
    let modal = document.getElementById("patient-flag-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "patient-flag-modal";
    modal.className = "patient-flag-modal";
    modal.setAttribute("aria-hidden", "true");

    const content = `
      <div class="patient-flag-modal__backdrop" data-flag-modal-close></div>
      <div class="patient-flag-modal__content" role="dialog" aria-modal="true" aria-labelledby="patient-flag-modal-title">
        <header class="patient-flag-modal__header">
          <h2 id="patient-flag-modal-title" class="patient-flag-modal__title"></h2>
          <button type="button" class="patient-flag-modal__close" data-flag-modal-close aria-label="Close">
            ×
          </button>
        </header>
        <div class="patient-flag-modal__body">
          <form id="patient-flag-form" class="patient-flag-form">
            <div class="patient-flag-form__grid">
              ${PATIENT_FLAGS.map(
                (flag) => `
                  <label class="patient-flag-form__item">
                    <input
                      type="checkbox"
                      name="flag-${flag.id}"
                      value="${flag.id}"
                    />
                    <span>${flag.label}</span>
                  </label>
                `,
              ).join("")}
            </div>
            <div class="patient-flag-form__footer">
              <button type="submit" class="button button--primary patient-flag-form__save">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    modal.innerHTML = content;
    document.body.appendChild(modal);

    const closeElements = modal.querySelectorAll("[data-flag-modal-close]");
    closeElements.forEach((el) => {
      el.addEventListener("click", closePatientFlagModal);
    });

    const form = modal.querySelector("#patient-flag-form");
    if (form) {
      form.addEventListener("submit", onPatientFlagFormSubmit);
    }

    return modal;
  }

  function openPatientFlagModal(room) {
    const modal = ensureFlagModal();
    activeModalRoom = room;

    const title = modal.querySelector("#patient-flag-modal-title");
    if (title) {
      title.textContent = `Room ${room}`;
    }

    const flagsForRoom = patientFlags[room] || {};
    PATIENT_FLAGS.forEach((flag) => {
      const input = modal.querySelector(
        `input[name="flag-${flag.id}"]`,
      );
      if (input) {
        input.checked = !!flagsForRoom[flag.id];
      }
    });

    modal.classList.add("patient-flag-modal--open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePatientFlagModal() {
    const modal = document.getElementById("patient-flag-modal");
    if (!modal) return;
    modal.classList.remove("patient-flag-modal--open");
    modal.setAttribute("aria-hidden", "true");
    activeModalRoom = null;
  }

  function onPatientFlagFormSubmit(event) {
    event.preventDefault();
    if (!activeModalRoom) {
      closePatientFlagModal();
      return;
    }

    const modal = document.getElementById("patient-flag-modal");
    if (!modal) return;

    const form = modal.querySelector("#patient-flag-form");
    if (!form) return;

    const formData = new FormData(form);
    const flagsForRoom = {};

    PATIENT_FLAGS.forEach((flag) => {
      if (formData.getAll(`flag-${flag.id}`).includes(flag.id)) {
        flagsForRoom[flag.id] = true;
      }
    });

    patientFlags[activeModalRoom] = flagsForRoom;

    updateCardsForRoomFlags(activeModalRoom);
    evaluateNurseSlotRules();
    closePatientFlagModal();
  }

  function updateCardsForRoomFlags(room) {
    const flagsForRoom = patientFlags[room] || {};
    const hasAny = Object.keys(flagsForRoom).some((key) => flagsForRoom[key]);

    const cards = document.querySelectorAll(
      `.patient-card[data-room="${room}"]`,
    );

    cards.forEach((card) => {
      let flagsContainer = card.querySelector(".patient-card__flags");

      if (!hasAny) {
        if (flagsContainer) {
          flagsContainer.remove();
        }
        return;
      }

      if (!flagsContainer) {
        flagsContainer = document.createElement("div");
        flagsContainer.className = "patient-card__flags";
        card.appendChild(flagsContainer);
      }

      flagsContainer.innerHTML = "";

      PATIENT_FLAGS.forEach((flag) => {
        if (!flagsForRoom[flag.id]) return;
        const dot = document.createElement("span");
        dot.className = `patient-flag-dot ${flag.colorClass}`;
        flagsContainer.appendChild(dot);
      });
    });
  }

  function onPatientCardClick(event) {
    if (isDraggingCard) return;
    const card = event.currentTarget;
    const room = card.dataset.room;
    if (!room) return;
    openPatientFlagModal(room);
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

    ensureFlagModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

