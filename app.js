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
    { id: "aggressivePatient", label: "Aggressive Patient", colorClass: "patient-flag-dot--aggressive" },
    { id: "oneToOne", label: "1:1 (Safety / Suicide Precaution)", colorClass: "patient-flag-dot--or" },
    { id: "policePrisonCustody", label: "Police / Prison Custody", colorClass: "patient-flag-dot--isolation" },
    {
      id: "other",
      label: "Other",
      colorClass: "patient-flag-dot--other",
      otherField: true,
    },
  ];

  const PATIENT_FLAGS_GRID = PATIENT_FLAGS.filter((f) => !f.otherField);

  const patientFlags = {};
  /** Previous shift snapshot for future report continuity (e.g. auto-assign). */
  let outgoingAssignment = [];
  /** Board params waiting after setup until outgoing step completes. */
  let pendingBoardParams = null;
  /** Keyed by nurse slot index string (e.g. "2", "3"). Charge slot has no entry. */
  const nurseSlotReturning = Object.create(null);
  let currentShiftType = null;
  let activeModalRoom = null;
  const STORAGE_KEY = "chargedeck_board_state";
  let isRestoringBoardState = false;

  function getBoardContainerIfVisible() {
    const board = document.getElementById("board-container");
    if (!board || board.style.display === "none") return null;
    return board;
  }

  function collectBoardStateForStorage() {
    if (!getBoardContainerIfVisible() || !currentShiftType) return null;

    const slots = document.querySelectorAll(".nurse-slot");
    if (!slots.length) return null;

    const nurseCount = document.querySelectorAll(".nurse-slot").length;

    const assignment = { unassigned: [] };
    const unassignedList = document.querySelector(".unassigned-list");
    if (unassignedList) {
      assignment.unassigned = Array.from(
        unassignedList.querySelectorAll(".patient-card[data-room]"),
        (c) => c.dataset.room,
      ).filter(Boolean);
    }

    slots.forEach((slot) => {
      const body = slot.querySelector(".nurse-slot__body");
      const titleEl = slot.querySelector(".nurse-slot__title");
      if (!body) return;
      const name = titleEl ? titleEl.textContent.trim() : "";
      const rooms = Array.from(
        body.querySelectorAll(".patient-card[data-room]"),
        (c) => c.dataset.room,
      ).filter(Boolean);
      if (slot.dataset.slotType === "charge") {
        assignment.charge = { rooms, name: name || "Charge" };
      } else {
        const idx = slot.dataset.nurseIndex;
        if (idx) {
          const btn = slot.querySelector(".nurse-slot__returning");
          const on = Boolean(
            btn && btn.classList.contains("nurse-slot__returning--on"),
          );
          assignment[`nurse${idx}`] = {
            rooms,
            name: name || `Nurse ${idx}`,
            returning: on,
          };
        }
      }
    });

    const allRoomSet = new Set();
    assignment.unassigned.forEach((r) => allRoomSet.add(String(r)));
    if (assignment.charge) {
      assignment.charge.rooms.forEach((r) => allRoomSet.add(String(r)));
    }
    for (const k of Object.keys(assignment)) {
      if (k === "unassigned" || k === "charge") continue;
      if (k.startsWith("nurse") && assignment[k] && Array.isArray(assignment[k].rooms)) {
        assignment[k].rooms.forEach((r) => allRoomSet.add(String(r)));
      }
    }
    const rooms = Array.from(allRoomSet).sort(
      (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
    );

    return {
      v: 1,
      shiftType: currentShiftType,
      nurseCount,
      rooms,
      patientFlags: JSON.parse(JSON.stringify(patientFlags)),
      outgoingAssignment: JSON.parse(JSON.stringify(outgoingAssignment)),
      assignment,
    };
  }

  function saveBoardStateToLocalStorage() {
    if (isRestoringBoardState) return;
    const data = collectBoardStateForStorage();
    if (!data) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...data, savedAt: new Date().toISOString() }),
      );
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function applyRestoredState(state) {
    if (!state || !state.assignment) return;
    isRestoringBoardState = true;
    try {
      const a = state.assignment;
      const getCard = (room) =>
        document.querySelector(`.patient-card[data-room="${room}"]`);

      function appendToBody(body, roomList) {
        if (!body || !Array.isArray(roomList)) return;
        roomList.forEach((r) => {
          const key = String(r);
          const c = getCard(key);
          if (c) body.appendChild(c);
        });
        if (body.classList && body.classList.contains("nurse-slot__body")) {
          sortNurseSlotPatients(body);
        }
      }

      if (a.charge) {
        const b = document.querySelector(
          '.nurse-slot[data-slot-type="charge"] .nurse-slot__body',
        );
        if (a.charge.rooms && b) appendToBody(b, a.charge.rooms);
        const t = document.querySelector(
          '.nurse-slot[data-slot-type="charge"] .nurse-slot__title',
        );
        if (t) t.textContent = a.charge.name || "Charge";
      }

      for (let i = 2; i <= 20; i += 1) {
        const slotA = a[`nurse${i}`];
        if (!slotA) continue;
        const body = document.querySelector(
          `.nurse-slot[data-nurse-index="${i}"] .nurse-slot__body`,
        );
        if (slotA.rooms && body) appendToBody(body, slotA.rooms);
        const t = document.querySelector(
          `.nurse-slot[data-nurse-index="${i}"] .nurse-slot__title`,
        );
        if (t) t.textContent = slotA.name || `Nurse ${i}`;
        const idxStr = String(i);
        const btn = document.querySelector(
          `.nurse-slot__returning[data-nurse-index="${idxStr}"]`,
        );
        if (btn) {
          const on = Boolean(slotA.returning);
          nurseSlotReturning[idxStr] = on;
          btn.classList.toggle("nurse-slot__returning--on", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
          btn.textContent = on ? "\u21A9 Returning" : "Returning";
        }
      }

      const unL = document.querySelector(".unassigned-list");
      if (unL && Array.isArray(a.unassigned)) {
        a.unassigned.forEach((r) => {
          const c = getCard(String(r));
          if (c) unL.appendChild(c);
        });
        sortUnassignedPatients();
      }
    } finally {
      isRestoringBoardState = false;
    }
    updateNurseSlotCounts();
    evaluateNurseSlotRules();
    (state.rooms || []).forEach((r) => {
      updateCardsForRoomFlags(String(r));
    });
    saveBoardStateToLocalStorage();
  }

  function onBackToSetupWithConfirm() {
    const msg =
      "Going back to setup will not delete your current assignment \u2014 it is saved automatically. Continue?";
    if (window.confirm(msg)) {
      showSetup();
    }
  }

  const POD_ROOM_IDS = {
    podA: [1, 2, 3, 5],
    podB: [8, 9, 10, 11, 12, 43, 44],
    podC: [15, 16, 17, 18, 22],
    podD: [35, 38, 39, 40, 41],
    podE: [23, 24, 25, 26],
    podF: [31, 32, 33, 34],
  };

  const ROOM_TO_POD_ID = new Map();
  Object.entries(POD_ROOM_IDS).forEach(([podId, rooms]) => {
    rooms.forEach((n) => ROOM_TO_POD_ID.set(n, podId));
  });

  const POD_ORDER = ["podA", "podB", "podC", "podD", "podE", "podF"];

  const POD_NEIGHBORS = {
    podA: new Set(["podB"]),
    podB: new Set(["podA", "podC", "podF"]),
    podC: new Set(["podB", "podD", "podE"]),
    podD: new Set(["podC", "podF"]),
    podE: new Set(["podC", "podF"]),
    podF: new Set(["podB", "podD", "podE"]),
  };

  function getPodIdForRoomStr(roomStr) {
    const n = Number.parseInt(roomStr, 10);
    return ROOM_TO_POD_ID.get(n) || null;
  }

  function getPodsInRoomIds(roomIds) {
    const pods = new Set();
    roomIds.forEach((r) => {
      const p = getPodIdForRoomStr(r);
      if (p) pods.add(p);
    });
    return pods;
  }

  function podsAreNeighbors(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return Boolean(POD_NEIGHBORS[a]?.has(b));
  }

  /** Pods in set linked via POD_NEIGHBORS; multiple components ⇒ no single geographic cluster. */
  function countInducedPodComponents(podSet) {
    if (podSet.size < 3) return 1;
    const visited = new Set();
    let components = 0;
    for (const start of podSet) {
      if (visited.has(start)) continue;
      components += 1;
      const stack = [start];
      visited.add(start);
      while (stack.length) {
        const u = stack.pop();
        const neighbors = POD_NEIGHBORS[u];
        if (!neighbors) continue;
        neighbors.forEach((v) => {
          if (!podSet.has(v) || visited.has(v)) return;
          visited.add(v);
          stack.push(v);
        });
      }
    }
    return components;
  }

  function slotHasRuleViolations(roomIds, isChargeSlot) {
    let hasTrachOrHighAcuity = false;
    let trachCount = 0;
    let heparinCount = 0;
    let transfusionCount = 0;
    let orCount = 0;
    let dischargeCount = 0;
    let woundCount = 0;
    let isolationCount = 0;
    let highAcuityCount = 0;

    roomIds.forEach((room) => {
      const f = patientFlags[room] || {};
      if (f.trach || f.highAcuity) {
        hasTrachOrHighAcuity = true;
      }
      if (f.trach) trachCount += 1;
      if (f.highAcuity) highAcuityCount += 1;
      if (f.heparinDrip) heparinCount += 1;
      if (f.transfusionRisk) transfusionCount += 1;
      if (f.goingToOr) orCount += 1;
      if (f.expectedDischarge) dischargeCount += 1;
      if (f.woundCare) woundCount += 1;
      if (f.isolation) isolationCount += 1;
    });

    const totalPatients = roomIds.length;

    if (totalPatients > 4) return true;
    if (
      currentShiftType === "Day" &&
      hasTrachOrHighAcuity &&
      totalPatients > 3
    ) {
      return true;
    }
    if (heparinCount >= 2) return true;
    if (heparinCount >= 1 && transfusionCount >= 1) return true;
    if (orCount >= 3) return true;
    if (dischargeCount >= 3) return true;
    if (woundCount >= 3) return true;
    if (trachCount >= 2) return true;
    if (isolationCount >= 3) return true;
    if (highAcuityCount >= 2) return true;
    if (trachCount >= 1 && highAcuityCount >= 1) return true;

    if (isChargeSlot && currentShiftType === "Day" && totalPatients > 0) {
      return true;
    }
    if (isChargeSlot && currentShiftType === "Night" && totalPatients > 1) {
      return true;
    }

    return false;
  }

  function canAssignRoomToSlotBody(body, roomStr) {
    const slot = body.closest(".nurse-slot");
    if (!slot) return false;

    const isChargeSlot = slot.dataset.slotType === "charge";
    const max = Number.parseInt(body.dataset.max || "0", 10);
    const currentIds = Array.from(
      body.querySelectorAll(".patient-card[data-room]"),
      (c) => c.dataset.room,
    ).filter(Boolean);

    if (currentIds.length >= max) return false;

    const nextIds = [...currentIds, roomStr];
    return !slotHasRuleViolations(nextIds, isChargeSlot);
  }

  function isReturningNurseSlot(slot) {
    if (!slot || slot.dataset.slotType === "charge") return false;
    const idx = slot.dataset.nurseIndex;
    if (!idx) return false;
    return nurseSlotReturning[idx] === true;
  }

  function getBodyRoomIds(body) {
    return Array.from(
      body.querySelectorAll(".patient-card[data-room]"),
      (c) => c.dataset.room,
    ).filter(Boolean);
  }

  function getBodyMaxPatients(body) {
    return Number.parseInt(body.dataset.max || "0", 10);
  }

  function buildOutgoingRoomToSourceIndicesMap() {
    if (!outgoingAssignment || outgoingAssignment.length === 0) {
      return null;
    }
    const roomToIndices = new Map();
    let hasRoomData = false;
    outgoingAssignment.forEach((entry, idx) => {
      if (!entry.rooms || entry.rooms.length === 0) return;
      hasRoomData = true;
      entry.rooms.forEach((n) => {
        const key = String(n);
        if (!roomToIndices.has(key)) roomToIndices.set(key, new Set());
        roomToIndices.get(key).add(idx);
      });
    });
    if (!hasRoomData) return null;
    return roomToIndices;
  }

  function countDistinctOutgoingReportSources(roomIds, roomToIndices) {
    const indices = new Set();
    roomIds.forEach((r) => {
      const set = roomToIndices.get(String(r));
      if (set) set.forEach((i) => indices.add(i));
    });
    return indices.size;
  }

  function reportContinuityPenaltyScore(sourceCount) {
    if (sourceCount <= 1) return 0;
    if (sourceCount === 2) return 1;
    if (sourceCount === 3) return 2;
    return 4;
  }

  function buildAutoAssignScoredCandidate(body, roomStr, reportRoomMap) {
    const slot = body.closest(".nurse-slot");
    if (!slot) return null;
    const max = getBodyMaxPatients(body);
    const currentIds = getBodyRoomIds(body);
    if (currentIds.length >= max) return null;
    if (!canAssignRoomToSlotBody(body, roomStr)) return null;

    let reportSourceScore = 0;
    if (reportRoomMap) {
      const nextIds = [...currentIds, roomStr];
      const srcCount = countDistinctOutgoingReportSources(
        nextIds,
        reportRoomMap,
      );
      reportSourceScore = reportContinuityPenaltyScore(srcCount);
    }

    const roomPod = getPodIdForRoomStr(roomStr);
    const existingPods = getPodsInRoomIds(currentIds);
    const returning = isReturningNurseSlot(slot) ? 0 : 1;

    let countInRoomPodAfter = 0;
    if (roomPod) {
      currentIds.forEach((r) => {
        if (getPodIdForRoomStr(r) === roomPod) countInRoomPodAfter += 1;
      });
      countInRoomPodAfter += 1;
    }
    const thirdSamePodSoft = roomPod && countInRoomPodAfter === 3 ? 1 : 0;
    const fourthSamePodSoft = roomPod && countInRoomPodAfter === 4 ? 2 : 0;

    let neighborPodPenalty = 0;
    if (roomPod && existingPods.size > 0) {
      if (!existingPods.has(roomPod)) {
        let touchesNeighbor = false;
        for (const p of existingPods) {
          if (podsAreNeighbors(p, roomPod)) {
            touchesNeighbor = true;
            break;
          }
        }
        neighborPodPenalty = touchesNeighbor ? 0 : 1;
      }
    }

    const count = currentIds.length;
    const idxStr = slot.dataset.nurseIndex || "";
    const idxNum = Number.parseInt(idxStr, 10);
    const sortIdx = Number.isFinite(idxNum) ? idxNum : 0;

    return {
      body,
      reportSourceScore,
      returning,
      fourthSamePodSoft,
      thirdSamePodSoft,
      neighborPodPenalty,
      count,
      sortIdx,
    };
  }

  function compareAutoAssignScored(a, b) {
    const ra = a.reportSourceScore ?? 0;
    const rb = b.reportSourceScore ?? 0;
    if (ra !== rb) return ra - rb;
    if (a.returning !== b.returning) return a.returning - b.returning;
    if (a.fourthSamePodSoft !== b.fourthSamePodSoft) {
      return a.fourthSamePodSoft - b.fourthSamePodSoft;
    }
    if (a.thirdSamePodSoft !== b.thirdSamePodSoft) {
      return a.thirdSamePodSoft - b.thirdSamePodSoft;
    }
    if (a.neighborPodPenalty !== b.neighborPodPenalty) {
      return a.neighborPodPenalty - b.neighborPodPenalty;
    }
    if (a.count !== b.count) return a.count - b.count;
    return a.sortIdx - b.sortIdx;
  }

  function runAutoAssign() {
    const list = document.querySelector(".unassigned-list");
    if (!list) return;

    const queue = Array.from(
      list.querySelectorAll(".patient-card[data-room]"),
      (c) => ({ card: c, room: c.dataset.room }),
    );

    queue.sort((a, b) => {
      const pa = getPodIdForRoomStr(a.room);
      const pb = getPodIdForRoomStr(b.room);
      const ia = pa ? POD_ORDER.indexOf(pa) : 99;
      const ib = pb ? POD_ORDER.indexOf(pb) : 99;
      if (ia !== ib) return ia - ib;
      return Number.parseInt(a.room, 10) - Number.parseInt(b.room, 10);
    });

    const bodies = Array.from(
      document.querySelectorAll(".nurse-slot__body.drop-zone"),
    );
    const reportRoomMap = buildOutgoingRoomToSourceIndicesMap();
    const fullCapBodies = bodies.filter((b) => getBodyMaxPatients(b) >= 4);
    const n = fullCapBodies.length;

    const phase1Targets = new Map();
    if (n > 0) {
      const total = queue.length;
      if (total >= 3 * n) {
        fullCapBodies.forEach((b) => phase1Targets.set(b, 3));
      } else {
        const base = Math.floor(total / n);
        const rem = total % n;
        fullCapBodies.forEach((b, i) => {
          phase1Targets.set(b, i < rem ? base + 1 : base);
        });
      }
    }

    function phase1StillNeedsWork() {
      if (n === 0) return false;
      return fullCapBodies.some((b) => {
        const c = getBodyRoomIds(b).length;
        const t = phase1Targets.get(b) ?? 0;
        return c < t;
      });
    }

    function collectCandidates(roomStr, phase) {
      return bodies
        .map((body) => {
          if (phase === 1) {
            if (!fullCapBodies.includes(body)) return null;
            const t = phase1Targets.get(body);
            if (t === undefined) return null;
            if (getBodyRoomIds(body).length >= t) return null;
          }
          if (phase === 2) {
            const slot = body.closest(".nurse-slot");
            if (slot && slot.dataset.slotType === "charge") {
              if (currentShiftType === "Day") {
                return null;
              }
              if (getBodyRoomIds(body).length >= 1) {
                return null;
              }
            }
          }
          return buildAutoAssignScoredCandidate(body, roomStr, reportRoomMap);
        })
        .filter(Boolean);
    }

    while (queue.length > 0 && phase1StillNeedsWork()) {
      const { card, room } = queue[0];
      const candidates = collectCandidates(room, 1);
      if (candidates.length === 0) break;
      candidates.sort(compareAutoAssignScored);
      const destBody1 = candidates[0].body;
      destBody1.appendChild(card);
      sortNurseSlotPatients(destBody1);
      queue.shift();
    }

    while (queue.length > 0) {
      const { card, room } = queue[0];
      const candidates = collectCandidates(room, 2);
      if (candidates.length === 0) break;
      candidates.sort(compareAutoAssignScored);
      const destBody = candidates[0].body;
      destBody.appendChild(card);
      sortNurseSlotPatients(destBody);
      queue.shift();
    }

    function collectSweepCandidates(roomStr) {
      return bodies
        .map((body) => {
          const slot = body.closest(".nurse-slot");
          if (slot && slot.dataset.slotType === "charge") {
            if (currentShiftType === "Day") return null;
            if (getBodyRoomIds(body).length >= 1) return null;
          }
          const max = getBodyMaxPatients(body);
          const currentIds = getBodyRoomIds(body);
          if (currentIds.length >= max) return null;
          if (!canAssignRoomToSlotBody(body, roomStr)) return null;
          const idxStr = slot ? slot.dataset.nurseIndex || "" : "";
          const idxNum = Number.parseInt(idxStr, 10);
          const sortIdx = Number.isFinite(idxNum) ? idxNum : 0;
          return { body, sortIdx };
        })
        .filter(Boolean);
    }

    let sweepProgress = true;
    while (sweepProgress && queue.length > 0) {
      sweepProgress = false;
      for (let i = 0; i < queue.length; ) {
        const { card, room } = queue[i];
        const sweep = collectSweepCandidates(room);
        if (sweep.length === 0) {
          i += 1;
          continue;
        }
        sweep.sort((a, b) => a.sortIdx - b.sortIdx);
        const dest = sweep[0].body;
        dest.appendChild(card);
        sortNurseSlotPatients(dest);
        queue.splice(i, 1);
        sweepProgress = true;
      }
    }

    sortUnassignedPatients();
    updateNurseSlotCounts();
    evaluateNurseSlotRules();
  }

  function clearAllNurseAssignments() {
    const list = document.querySelector(".unassigned-list");
    if (!list) return;

    const bodies = document.querySelectorAll(".nurse-slot__body.drop-zone");
    bodies.forEach((body) => {
      const cards = body.querySelectorAll(".patient-card[data-room]");
      cards.forEach((card) => {
        list.appendChild(card);
      });
    });

    sortUnassignedPatients();
    updateNurseSlotCounts();
    evaluateNurseSlotRules();
  }

  function onClearAssignmentClick() {
    clearAllNurseAssignments();
    saveBoardStateToLocalStorage();
  }

  function clearAllPatientFlagsEverywhere() {
    Object.keys(patientFlags).forEach((k) => {
      delete patientFlags[k];
    });
    const seen = new Set();
    document.querySelectorAll(".patient-card[data-room]").forEach((card) => {
      const r = card.dataset.room;
      if (!r || seen.has(r)) return;
      seen.add(r);
      updateCardsForRoomFlags(r);
    });
    evaluateNurseSlotRules();
  }

  function onResetAllFlagsClick() {
    const ok = window.confirm(
      "This will clear ALL patient flags on every room.\n\nAre you sure?",
    );
    if (!ok) return;
    clearAllPatientFlagsEverywhere();
    saveBoardStateToLocalStorage();
  }

  function clearPatientFlagModalFormFields() {
    const modal = document.getElementById("patient-flag-modal");
    if (!modal) return;
    const form = modal.querySelector("#patient-flag-form");
    if (!form) return;

    PATIENT_FLAGS_GRID.forEach((flag) => {
      const input = form.querySelector(`input[name="flag-${flag.id}"]`);
      if (input) input.checked = false;
    });

    const otherCb = form.querySelector('input[name="flag-other"]');
    const otherWrap = form.querySelector(
      ".patient-flag-form__other-comment-wrap",
    );
    const otherInput = form.querySelector(".patient-flag-form__other-input");
    if (otherCb) otherCb.checked = false;
    if (otherInput) otherInput.value = "";
    syncPatientFlagOtherCommentUI(otherWrap, otherCb, otherInput);
  }

  function showAutoAssignToast() {
    let el = document.getElementById("auto-assign-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "auto-assign-toast";
      el.setAttribute("role", "status");
      el.style.cssText = [
        "position:fixed",
        "left:50%",
        "bottom:1.25rem",
        "transform:translateX(-50%)",
        "z-index:2000",
        "max-width:min(90vw,28rem)",
        "padding:0.65rem 1rem",
        "border-radius:10px",
        "background:#ffffff",
        "color:#0f172a",
        "box-shadow:0 10px 30px rgba(15,23,42,0.18)",
        "font-size:0.9rem",
        "font-weight:600",
        "text-align:center",
        "pointer-events:none",
        "opacity:0",
        "transition:opacity 0.25s ease",
      ].join(";");
      document.body.appendChild(el);
    }

    el.textContent = "Auto-assign complete - review before finalizing";
    el.style.opacity = "1";

    if (el._hideTimer) {
      clearTimeout(el._hideTimer);
    }
    el._hideTimer = setTimeout(() => {
      el.style.opacity = "0";
    }, 3200);
  }

  function onAutoAssignClick() {
    runAutoAssign();
    showAutoAssignToast();
    saveBoardStateToLocalStorage();
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
    const main = document.querySelector(".app-main");
    const board = document.getElementById("board-container");
    const setupScreen = document.getElementById("setup-screen");
    const outgoingScreen = document.getElementById("outgoing-screen");

    pendingBoardParams = null;

    if (main) main.style.display = "";
    if (setupScreen) setupScreen.style.display = "";
    if (outgoingScreen) {
      outgoingScreen.style.display = "none";
      outgoingScreen.setAttribute("aria-hidden", "true");
    }
    if (board) board.style.display = "none";
  }

  function parseOutgoingRoomsInput(str) {
    if (!str || typeof str !== "string") return [];
    return str
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n));
  }

  function renderOutgoingTableRows(count) {
    const tbody = document.getElementById("outgoing-table-body");
    if (!tbody) return;

    let safe = 0;
    if (
      typeof count === "number" &&
      Number.isFinite(count) &&
      count >= 1 &&
      count <= 12
    ) {
      safe = Math.floor(count);
    }

    tbody.innerHTML = "";

    for (let i = 1; i <= safe; i += 1) {
      const label = i === 1 ? "Charge" : `Nurse ${i}`;
      const tr = document.createElement("tr");
      tr.className = "outgoing-table__row";
      tr.innerHTML = `
        <td class="outgoing-table__cell outgoing-table__cell--label">${label}</td>
        <td class="outgoing-table__cell">
          <input
            type="text"
            class="text-input outgoing-table__name"
            placeholder="Nurse name (optional)"
            autocomplete="off"
          />
        </td>
        <td class="outgoing-table__cell">
          <input
            type="text"
            class="text-input outgoing-table__rooms"
            placeholder="e.g. 8, 9, 10, 11"
            autocomplete="off"
          />
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  function collectOutgoingAssignmentFromTable() {
    const tbody = document.getElementById("outgoing-table-body");
    if (!tbody) return [];

    const rows = tbody.querySelectorAll(".outgoing-table__row");
    const result = [];

    rows.forEach((row) => {
      const nameInput = row.querySelector(".outgoing-table__name");
      const roomsInput = row.querySelector(".outgoing-table__rooms");
      const name = nameInput ? nameInput.value.trim() : "";
      const roomsStr = roomsInput ? roomsInput.value : "";
      result.push({
        name,
        rooms: parseOutgoingRoomsInput(roomsStr),
      });
    });

    return result;
  }

  function showOutgoingScreen() {
    const main = document.querySelector(".app-main");
    const setupScreen = document.getElementById("setup-screen");
    const outgoingScreen = document.getElementById("outgoing-screen");
    const countInput = document.getElementById("outgoing-nurse-count");

    if (main) main.style.display = "";
    if (setupScreen) setupScreen.style.display = "none";
    if (outgoingScreen) {
      outgoingScreen.style.display = "block";
      outgoingScreen.setAttribute("aria-hidden", "false");
    }

    let nForRows = 0;
    if (countInput && countInput.value.trim() !== "") {
      const parsed = Number.parseInt(countInput.value.trim(), 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) {
        nForRows = parsed;
      }
    }

    renderOutgoingTableRows(nForRows);
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
              <div class="nurse-slot" data-nurse-index="${i}">
                <div class="nurse-slot__header">
                  <span class="nurse-slot__title">Nurse ${i}</span>
                  <button
                    type="button"
                    class="nurse-slot__returning"
                    aria-pressed="false"
                    data-nurse-index="${i}"
                  >
                    Returning
                  </button>
                  <span class="nurse-slot__badge">0/4</span>
                </div>
                <div class="nurse-slot__body drop-zone" data-max="4"></div>
              </div>
            `;
    }

    return slots;
  }

  function showBoard({ shiftType, nurseCount, rooms }, options) {
    options = options || {};
    const main = document.querySelector(".app-main");
    const board = ensureBoardContainer();
    const setupScreen = document.getElementById("setup-screen");
    const outgoingScreen = document.getElementById("outgoing-screen");

    currentShiftType = shiftType;

    if (main) main.style.display = "none";
    if (setupScreen) setupScreen.style.display = "none";
    if (outgoingScreen) {
      outgoingScreen.style.display = "none";
      outgoingScreen.setAttribute("aria-hidden", "true");
    }
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
          <div class="board-header__actions">
            <button
              type="button"
              id="print-assignment"
              class="button button--secondary board-header__print"
            >
              Print
            </button>
            <button
              type="button"
              id="back-to-setup"
              class="button button--secondary board-header__back"
            >
              ← Back to Setup
            </button>
          </div>
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
            <div class="board-assignment-actions">
              <button
                type="button"
                id="auto-assign-button"
                class="button board-assignment-actions__auto"
              >
                Auto-Assign
              </button>
              <button
                type="button"
                id="reset-flags-button"
                class="button button--reset-flags board-assignment-actions__reset-flags"
              >
                Reset Flags
              </button>
              <button
                type="button"
                id="clear-assignment-button"
                class="button button--danger board-assignment-actions__clear"
              >
                Clear Assignment
              </button>
            </div>
          </section>

          <div class="board-legend-block">
            <div class="board-legend__button-row">
              <button
                type="button"
                class="board-legend__toggle"
                id="board-legend-toggle"
                aria-expanded="false"
                aria-controls="board-legend-panel"
              >
                🔑 Legend
              </button>
            </div>
            <div
              id="board-legend-panel"
              class="board-legend__panel"
              role="region"
              aria-label="Flag legend"
              hidden
            >
              <div class="board-legend__inner">
                <div class="board-legend__group">
                  <div class="board-legend__cat">Medication &amp; Transfusion:</div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--heparin" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Heparin Drip</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--transfusion" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Transfusion Risk</span>
                  </div>
                </div>
                <div class="board-legend__group">
                  <div class="board-legend__cat">Isolation &amp; Precautions:</div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--isolation" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Isolation</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--aggressive" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Aggressive Patient</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot board-legend__dot--purple" aria-hidden="true"></span>
                    <span class="board-legend__row-label">1:1 (Safety / Suicide Precaution)</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--isolation" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Police / Prison Custody</span>
                  </div>
                </div>
                <div class="board-legend__group">
                  <div class="board-legend__cat">Procedures &amp; Discharge:</div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--or" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Going to OR</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--discharge" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Expected Discharge</span>
                  </div>
                </div>
                <div class="board-legend__group">
                  <div class="board-legend__cat">Acuity &amp; Equipment:</div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--acuity" aria-hidden="true"></span>
                    <span class="board-legend__row-label">High Acuity</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--trach" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Trach</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--lines" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Lines (PICC / Central)</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--drains" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Drains (JP / IR)</span>
                  </div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--wound" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Wound Care</span>
                  </div>
                </div>
                <div class="board-legend__group">
                  <div class="board-legend__cat">Other:</div>
                  <div class="board-legend__row">
                    <span class="patient-flag-dot patient-flag-dot--other" aria-hidden="true"></span>
                    <span class="board-legend__row-label">Other (with comment)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section class="board-section board-section--footer">
            <div class="board-footer-row">CNA: (to be assigned)</div>
            <div class="board-footer-row">1:1: (to be assigned)</div>
          </section>
        </div>
      </div>
    `;

    setupDragAndDrop(board);
    setupNurseNameEditing(board);
    setupReturningToggles(board);
    setupBoardLegend(board);

    const backBtn = document.getElementById("back-to-setup");
    if (backBtn) {
      backBtn.addEventListener("click", onBackToSetupWithConfirm, { once: true });
    }

    if (options.restoreState) {
      applyRestoredState(options.restoreState);
    }

    const printBtn = document.getElementById("print-assignment");
    if (printBtn) {
      printBtn.addEventListener("click", onPrintClick);
    }

    const autoAssignBtn = document.getElementById("auto-assign-button");
    if (autoAssignBtn) {
      autoAssignBtn.addEventListener("click", onAutoAssignClick);
    }

    const clearAssignmentBtn = document.getElementById("clear-assignment-button");
    if (clearAssignmentBtn) {
      clearAssignmentBtn.addEventListener("click", onClearAssignmentClick);
    }

    const resetFlagsBtn = document.getElementById("reset-flags-button");
    if (resetFlagsBtn) {
      resetFlagsBtn.addEventListener("click", onResetAllFlagsClick);
    }
  }

  let draggedCard = null;
  let dragOriginParent = null;
  let dragOriginNextSibling = null;
  let dragHadValidDrop = false;
  let isDraggingCard = false;

  // Touch drag state (mobile)
  let touchDragCard = null;
  let touchDragClone = null;
  let touchOriginParent = null;
  let touchOriginNextSibling = null;
  let touchCurrentZone = null;
  let touchCardWidth = 0;
  let touchCardHeight = 0;
  let touchStartX = null;
  let touchStartY = null;
  let longPressTimeoutId = null;
  let lastTouchX = null;
  let lastTouchY = null;

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

  function collectNurseAssignmentsForPrint() {
    const rows = [];
    const slots = document.querySelectorAll(".nurse-slot");

    slots.forEach((slot) => {
      const titleEl = slot.querySelector(".nurse-slot__title");
      const nurseName = titleEl ? titleEl.textContent.trim() : "";

      const cards = slot.querySelectorAll(
        ".nurse-slot__body .patient-card[data-room]",
      );

      const roomNumbers = [];
      const flagLabels = new Set();

      cards.forEach((card) => {
        const room = card.dataset.room;
        if (room) {
          roomNumbers.push(room);
          const flags = patientFlags[room] || {};
          PATIENT_FLAGS_GRID.forEach((flag) => {
            if (flags[flag.id]) {
              flagLabels.add(flag.label);
            }
          });
          const oc =
            typeof flags.otherComment === "string"
              ? flags.otherComment.trim()
              : "";
          if (flags.other && oc) {
            flagLabels.add(`Other: ${oc}`);
          } else if (flags.other) {
            flagLabels.add("Other");
          }
        }
      });

      rows.push({
        nurseName: nurseName || "—",
        rooms: roomNumbers.sort((a, b) => Number(a) - Number(b)),
        flags: Array.from(flagLabels),
      });
    });

    return rows;
  }

  function onPrintClick() {
    // Before printing, ensure rooms within each nurse body are comma-separated.
    const bodies = document.querySelectorAll(".nurse-slot__body");
    const originalHtml = [];

    bodies.forEach((body) => {
      originalHtml.push({ body, html: body.innerHTML });

      const cards = Array.from(
        body.querySelectorAll(".patient-card[data-room]"),
      );
      const rooms = cards
        .map((card) => card.dataset.room)
        .filter(Boolean);

      if (rooms.length) {
        body.textContent = rooms.join(", ");
      } else {
        body.textContent = "";
      }
    });

    const restore = () => {
      originalHtml.forEach(({ body, html }) => {
        body.innerHTML = html;
      });
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);
    window.print();
  }

  function evaluateNurseSlotRules() {
    const slots = document.querySelectorAll(".nurse-slot");
    const reportRoomMapForEval = buildOutgoingRoomToSourceIndicesMap();

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
      let aggressivePatientCount = 0;
      let highAcuityCount = 0;

      const podsAssigned = new Set();
      let hasTrachOutsidePodB = false;

      roomIds.forEach((room) => {
        const pod = getPodIdForRoomStr(room);
        if (pod) podsAssigned.add(pod);

        const flags = patientFlags[room] || {};
        if (flags.trach || flags.highAcuity) {
          hasTrachOrHighAcuity = true;
        }
        if (flags.trach) {
          hasTrach = true;
          trachCount += 1;
          if (pod !== "podB") {
            hasTrachOutsidePodB = true;
          }
        }
        if (flags.highAcuity) highAcuityCount += 1;
        if (flags.heparinDrip) heparinCount += 1;
        if (flags.transfusionRisk) transfusionCount += 1;
        if (flags.goingToOr) orCount += 1;
        if (flags.expectedDischarge) dischargeCount += 1;
        if (flags.woundCare) woundCount += 1;
        if (flags.isolation) isolationCount += 1;
        if (flags.aggressivePatient) aggressivePatientCount += 1;
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

      if (highAcuityCount >= 2) {
        violations.push("2+ High Acuity patients - review load");
      }
      if (trachCount >= 1 && highAcuityCount >= 1) {
        violations.push("Trach + High Acuity combination - review load");
      }

      // Night shift Trach advisory: soft warning only
      if (currentShiftType === "Night" && hasTrach && totalPatients <= 4) {
        advisories.push("Trach patient assigned - monitor workload");
      }

      // Multiple aggressive patients advisory: soft warning only
      if (aggressivePatientCount >= 2) {
        advisories.push(
          "Multiple aggressive patients assigned - review workload",
        );
      }

      // Geographic spread advisory: 3+ pods forming 2+ disconnected clusters
      if (
        podsAssigned.size >= 3 &&
        countInducedPodComponents(podsAssigned) >= 2
      ) {
        advisories.push(
          "Patients too spread out - consider clustering rooms",
        );
      }

      // Trach placement advisory: soft warning only
      if (hasTrachOutsidePodB) {
        advisories.push(
          "Trach patient should be near nursing station (rooms 8-12, 43-44)",
        );
      }

      if (reportRoomMapForEval && roomIds.length > 0) {
        const reportSrcCount = countDistinctOutgoingReportSources(
          roomIds,
          reportRoomMapForEval,
        );
        if (reportSrcCount >= 4) {
          advisories.push(
            "Getting report from 4+ nurses - consider redistributing",
          );
        }
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
       // Touch support for mobile drag
      card.addEventListener("touchstart", onCardTouchStart, {
        passive: false,
      });
      card.addEventListener("touchmove", onCardTouchMove, {
        passive: false,
      });
      card.addEventListener("touchend", onCardTouchEnd);
      card.addEventListener("touchcancel", onCardTouchEnd);
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
      saveBoardStateToLocalStorage();
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

  function setupReturningToggles(boardRoot) {
    Object.keys(nurseSlotReturning).forEach((k) => {
      delete nurseSlotReturning[k];
    });

    boardRoot.querySelectorAll(".nurse-slot__returning").forEach((btn) => {
      const idx = btn.dataset.nurseIndex;
      if (!idx) return;

      nurseSlotReturning[idx] = false;
      btn.classList.remove("nurse-slot__returning--on");
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = "Returning";

      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        btn.classList.toggle("nurse-slot__returning--on");
        const on = btn.classList.contains("nurse-slot__returning--on");
        nurseSlotReturning[idx] = on;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.textContent = on ? "\u21A9 Returning" : "Returning";
        saveBoardStateToLocalStorage();
      });
    });
  }

  function setupBoardLegend(boardRoot) {
    const btn = boardRoot.querySelector("#board-legend-toggle");
    const panel = boardRoot.querySelector("#board-legend-panel");
    if (!btn || !panel) return;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (panel.hasAttribute("hidden")) {
        panel.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
      } else {
        panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
      }
    });
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
      sortUnassignedPatients();
    } else {
      zone.appendChild(draggedCard);
      if (zone.classList.contains("nurse-slot__body")) {
        sortNurseSlotPatients(zone);
      }
    }

    updateNurseSlotCounts();
    evaluateNurseSlotRules();
    saveBoardStateToLocalStorage();
  }

  function sortNurseSlotPatients(body) {
    if (!body || !body.classList.contains("nurse-slot__body")) return;
    const cards = Array.from(
      body.querySelectorAll(".patient-card[data-room]"),
    );
    cards
      .sort((a, b) => {
        const aRoom = Number.parseInt(a.dataset.room || "0", 10);
        const bRoom = Number.parseInt(b.dataset.room || "0", 10);
        return aRoom - bRoom;
      })
      .forEach((card) => body.appendChild(card));
  }

  function sortUnassignedPatients() {
    const list = document.querySelector(".unassigned-list");
    if (!list) return;
    const cards = Array.from(list.querySelectorAll(".patient-card"));
    cards
      .sort((a, b) => {
        const aRoom = Number.parseInt(a.dataset.room || "0", 10);
        const bRoom = Number.parseInt(b.dataset.room || "0", 10);
        return aRoom - bRoom;
      })
      .forEach((card) => list.appendChild(card));
  }

  function getDropZoneFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    return el.closest(".board-section--unassigned, .nurse-slot__body");
  }

  function clearTouchDropZoneHighlight() {
    if (!touchCurrentZone) return;
    touchCurrentZone.classList.remove("drop-zone--active");
    touchCurrentZone = null;
  }

  function onCardTouchStart(event) {
    if (event.touches.length !== 1) return;
    const card = event.currentTarget;
    // Prevent triggering click-to-open-modal immediately
    isDraggingCard = true;
    touchDragCard = card;
    touchOriginParent = card.parentElement;
    touchOriginNextSibling = card.nextElementSibling;

    // Visual clone that follows the finger
    const rect = card.getBoundingClientRect();
    touchCardWidth = rect.width;
    touchCardHeight = rect.height;
    const clone = card.cloneNode(true);
    clone.removeAttribute("id");
    clone.style.position = "fixed";
    clone.style.width = `${rect.width}px`;
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "999";
    clone.style.transform = "scale(1.1)";
    clone.style.boxShadow = "0 10px 25px rgba(15, 23, 42, 0.3)";
    document.body.appendChild(clone);

    touchDragClone = clone;
    card.style.opacity = "0.5";

    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    moveTouchClone(touch.clientX, touch.clientY);

    if (longPressTimeoutId) {
      clearTimeout(longPressTimeoutId);
      longPressTimeoutId = null;
    }

    longPressTimeoutId = setTimeout(() => {
      if (!touchDragCard || touchStartX == null || touchStartY == null) {
        return;
      }
      const dx = (lastTouchX ?? touchStartX) - touchStartX;
      const dy = (lastTouchY ?? touchStartY) - touchStartY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq <= 100) {
        const room = touchDragCard.dataset.room;
        if (room) {
          openPatientFlagModal(room);
        }
      }
      longPressTimeoutId = null;
    }, 500);

    event.preventDefault();
  }

  function moveTouchClone(x, y) {
    if (!touchDragClone) return;
    const offsetX = touchCardWidth / 2;
    const offsetY = touchCardHeight / 2;
    touchDragClone.style.left = `${x - offsetX}px`;
    touchDragClone.style.top = `${y - offsetY}px`;
    touchDragClone.style.transform = "scale(1.1)";

    const zone = getDropZoneFromPoint(x, y);
    if (zone !== touchCurrentZone) {
      if (touchCurrentZone) {
        touchCurrentZone.classList.remove("drop-zone--active");
      }
      touchCurrentZone = zone;
      if (touchCurrentZone) {
        touchCurrentZone.classList.add("drop-zone--active");
      }
    }
  }

  function onCardTouchMove(event) {
    if (!touchDragCard || event.touches.length !== 1) return;
    const touch = event.touches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    if (touchStartX != null && touchStartY != null && longPressTimeoutId) {
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > 100) {
        clearTimeout(longPressTimeoutId);
        longPressTimeoutId = null;
      }
    }

    moveTouchClone(touch.clientX, touch.clientY);
    event.preventDefault();
  }

  function onCardTouchEnd(event) {
    if (!touchDragCard) return;

    if (longPressTimeoutId) {
      clearTimeout(longPressTimeoutId);
      longPressTimeoutId = null;
    }

    const card = touchDragCard;
    const originParent = touchOriginParent;
    const originNextSibling = touchOriginNextSibling;
    const targetZone = touchCurrentZone;

    if (targetZone) {
      if (targetZone.classList.contains("board-section--unassigned")) {
        const list = targetZone.querySelector(".unassigned-list");
        if (list) {
          list.appendChild(card);
        } else {
          targetZone.appendChild(card);
        }
        sortUnassignedPatients();
      } else {
        targetZone.appendChild(card);
        if (targetZone.classList.contains("nurse-slot__body")) {
          sortNurseSlotPatients(targetZone);
        }
      }
      updateNurseSlotCounts();
      evaluateNurseSlotRules();
      saveBoardStateToLocalStorage();
    } else if (originParent) {
      if (
        originNextSibling &&
        originNextSibling.parentElement === originParent
      ) {
        originParent.insertBefore(card, originNextSibling);
      } else {
        originParent.appendChild(card);
      }
    }

    card.style.opacity = "";
    if (touchDragClone) {
      touchDragClone.remove();
    }
    touchDragCard = null;
    touchDragClone = null;
    touchOriginParent = null;
    touchOriginNextSibling = null;
    clearTouchDropZoneHighlight();
    isDraggingCard = false;
  }

  function getDisplayFlagsForRoom(room) {
    const raw = patientFlags[room] || {};
    const f = { ...raw };
    if (f.oneToOneSafetyFallElopement || f.oneToOneSuicidePrecaution) {
      f.oneToOne = true;
    }
    if (
      typeof f.otherComment === "string" &&
      f.otherComment.trim() &&
      !f.other
    ) {
      f.other = true;
    }
    return f;
  }

  function roomFlagsHaveMarkers(flagsForRoom) {
    if (!flagsForRoom || typeof flagsForRoom !== "object") return false;
    const oc = flagsForRoom.otherComment;
    if (typeof oc === "string" && oc.trim()) return true;
    return Object.keys(flagsForRoom).some(
      (key) => key !== "otherComment" && flagsForRoom[key] === true,
    );
  }

  function getPatientCardFlagSummaryParts(room) {
    const f = getDisplayFlagsForRoom(room);
    const names = [];
    PATIENT_FLAGS_GRID.forEach((flag) => {
      if (f[flag.id]) names.push(flag.label);
    });
    if (f.other) names.push("Other");
    const main = names.join(", ");
    const oc =
      f.other && typeof f.otherComment === "string" ? f.otherComment.trim() : "";
    return {
      main,
      note: oc ? `Note: ${oc}` : "",
    };
  }

  function syncPatientFlagOtherCommentUI(wrap, checkbox, input) {
    const show = Boolean(checkbox && checkbox.checked);
    if (wrap) {
      wrap.classList.toggle(
        "patient-flag-form__other-comment-wrap--visible",
        show,
      );
    }
    if (!show && input) {
      input.value = "";
    }
  }

  function wirePatientFlagOtherField(modal) {
    if (modal.dataset.otherFieldWired === "1") return;
    modal.dataset.otherFieldWired = "1";
    const cb = modal.querySelector('input[name="flag-other"]');
    const wrap = modal.querySelector(".patient-flag-form__other-comment-wrap");
    const input = modal.querySelector(".patient-flag-form__other-input");
    if (!cb || !wrap || !input) return;
    cb.addEventListener("change", () => {
      syncPatientFlagOtherCommentUI(wrap, cb, input);
    });
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
              ${PATIENT_FLAGS_GRID.map(
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
              <div class="patient-flag-form__other-block">
                <label class="patient-flag-form__item patient-flag-form__item--other">
                  <input
                    type="checkbox"
                    name="flag-other"
                    value="other"
                  />
                  <span>Other</span>
                </label>
                <div class="patient-flag-form__other-comment-wrap">
                  <label class="patient-flag-form__other-comment-label" for="patient-flag-other-text">Comment</label>
                  <input
                    type="text"
                    id="patient-flag-other-text"
                    class="patient-flag-form__other-input"
                    name="otherCommentField"
                    autocomplete="off"
                  />
                </div>
              </div>
            </div>
            <div class="patient-flag-form__footer">
              <button
                type="button"
                class="button button--modal-clear patient-flag-form__clear-all"
                id="patient-flag-form-clear-all"
              >
                Clear All
              </button>
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

    wirePatientFlagOtherField(modal);

    const clearAllBtn = modal.querySelector("#patient-flag-form-clear-all");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        clearPatientFlagModalFormFields();
      });
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

    const flagsForRoom = getDisplayFlagsForRoom(room);
    PATIENT_FLAGS_GRID.forEach((flag) => {
      const input = modal.querySelector(
        `input[name="flag-${flag.id}"]`,
      );
      if (input) {
        input.checked = !!flagsForRoom[flag.id];
      }
    });

    const otherCb = modal.querySelector('input[name="flag-other"]');
    const otherWrap = modal.querySelector(
      ".patient-flag-form__other-comment-wrap",
    );
    const otherInput = modal.querySelector(".patient-flag-form__other-input");
    if (otherCb) {
      otherCb.checked = !!flagsForRoom.other;
    }
    if (otherInput) {
      otherInput.value =
        flagsForRoom.other &&
        typeof flagsForRoom.otherComment === "string"
          ? flagsForRoom.otherComment
          : "";
    }
    syncPatientFlagOtherCommentUI(otherWrap, otherCb, otherInput);

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

    PATIENT_FLAGS_GRID.forEach((flag) => {
      if (formData.getAll(`flag-${flag.id}`).includes(flag.id)) {
        flagsForRoom[flag.id] = true;
      }
    });

    const otherCb = form.querySelector('input[name="flag-other"]');
    const otherInput = form.querySelector(".patient-flag-form__other-input");
    if (otherCb && otherCb.checked) {
      flagsForRoom.other = true;
      const text = otherInput ? otherInput.value.trim() : "";
      if (text) {
        flagsForRoom.otherComment = text;
      }
    }

    delete flagsForRoom.oneToOneSafetyFallElopement;
    delete flagsForRoom.oneToOneSuicidePrecaution;

    patientFlags[activeModalRoom] = flagsForRoom;

    updateCardsForRoomFlags(activeModalRoom);
    evaluateNurseSlotRules();
    closePatientFlagModal();
    saveBoardStateToLocalStorage();
  }

  function updateCardsForRoomFlags(room) {
    const flagsForRoom = patientFlags[room] || {};
    const hasAny = roomFlagsHaveMarkers(flagsForRoom);

    const cards = document.querySelectorAll(
      `.patient-card[data-room="${room}"]`,
    );

    cards.forEach((card) => {
      let flagsContainer = card.querySelector(".patient-card__flags");

      if (!hasAny) {
        if (flagsContainer) {
          flagsContainer.remove();
        }
        const oldOtherTip = card.querySelector(".patient-card__other-tooltip");
        if (oldOtherTip) oldOtherTip.remove();
        const oldFlagTip = card.querySelector(".patient-card__flag-tooltip");
        if (oldFlagTip) oldFlagTip.remove();
        return;
      }

      if (!flagsContainer) {
        flagsContainer = document.createElement("div");
        flagsContainer.className = "patient-card__flags";
        card.appendChild(flagsContainer);
      }

      flagsContainer.innerHTML = "";

      PATIENT_FLAGS_GRID.forEach((flag) => {
        if (!flagsForRoom[flag.id]) return;
        const dot = document.createElement("span");
        dot.className = `patient-flag-dot ${flag.colorClass}`;
        flagsContainer.appendChild(dot);
      });

      if (flagsForRoom.other) {
        const otherFlag = PATIENT_FLAGS.find((f) => f.id === "other");
        if (otherFlag) {
          const dot = document.createElement("span");
          dot.className = `patient-flag-dot ${otherFlag.colorClass}`;
          flagsContainer.appendChild(dot);
        }
      }

      const parts = getPatientCardFlagSummaryParts(room);
      let tip = card.querySelector(".patient-card__flag-tooltip");
      if (!tip) {
        tip = document.createElement("div");
        tip.className = "patient-card__flag-tooltip";
        card.appendChild(tip);
      }
      tip.textContent = "";
      if (parts.main) {
        const mainEl = document.createElement("div");
        mainEl.className = "patient-card__flag-tooltip__main";
        mainEl.textContent = parts.main;
        tip.appendChild(mainEl);
      }
      if (parts.note) {
        const noteEl = document.createElement("div");
        noteEl.className = "patient-card__flag-tooltip__note";
        noteEl.textContent = parts.note;
        tip.appendChild(noteEl);
      }
      if (!tip.firstChild) {
        tip.remove();
      }
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

    outgoingAssignment = [];
    pendingBoardParams = {
      shiftType: getShiftType(),
      nurseCount: value,
      rooms,
    };

    showOutgoingScreen();
  }

  function onOutgoingBackToSetup() {
    pendingBoardParams = null;
    showSetup();
  }

  function onOutgoingSkipToBoard() {
    outgoingAssignment = [];
    if (!pendingBoardParams) return;
    const params = pendingBoardParams;
    pendingBoardParams = null;
    showBoard(params);
  }

  function onOutgoingContinueToBoard() {
    if (!pendingBoardParams) return;

    const draft = collectOutgoingAssignmentFromTable();
    const selectedSet = new Set(
      (pendingBoardParams.rooms || []).map(String),
    );
    const invalidSet = new Set();
    draft.forEach((entry) => {
      (entry.rooms || []).forEach((r) => {
        const key = String(r);
        if (!selectedSet.has(key)) {
          invalidSet.add(key);
        }
      });
    });

    if (invalidSet.size > 0) {
      const invalidList = Array.from(invalidSet).sort(
        (a, b) => Number(a) - Number(b),
      );
      alert(
        `The following rooms are not in today's assignment: ${invalidList.join(", ")}. Please check and correct before continuing.`,
      );
      return;
    }

    outgoingAssignment = draft;
    const params = pendingBoardParams;
    pendingBoardParams = null;
    showBoard(params);
  }

  function onOutgoingNurseCountChange() {
    const countInput = document.getElementById("outgoing-nurse-count");
    if (!countInput) return;
    const raw = countInput.value.trim();
    if (raw === "") {
      renderOutgoingTableRows(0);
      return;
    }
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 12) {
      renderOutgoingTableRows(0);
      return;
    }
    renderOutgoingTableRows(n);
  }

  function removeRestoreSessionBanner() {
    const b = document.getElementById("chargedeck-restore-banner");
    if (b) b.remove();
  }

  function onRestoreSessionClick() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let state;
    try {
      state = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!state || !state.assignment) return;
    if (!Array.isArray(state.rooms) || !state.shiftType) return;
    const nParsed = Number.parseInt(String(state.nurseCount), 10);
    if (!Number.isFinite(nParsed) || nParsed < 1) return;

    const allowedRooms = new Set(state.rooms.map((r) => String(r)));
    Object.keys(patientFlags).forEach((k) => {
      delete patientFlags[k];
    });
    if (state.patientFlags && typeof state.patientFlags === "object") {
      Object.keys(state.patientFlags).forEach((k) => {
        if (allowedRooms.has(String(k)) && state.patientFlags[k]) {
          patientFlags[k] = JSON.parse(
            JSON.stringify(state.patientFlags[k]),
          );
        }
      });
    }
    outgoingAssignment = Array.isArray(state.outgoingAssignment)
      ? JSON.parse(JSON.stringify(state.outgoingAssignment))
      : [];
    pendingBoardParams = null;

    removeRestoreSessionBanner();
    showBoard(
      {
        shiftType: state.shiftType,
        nurseCount: nParsed,
        rooms: state.rooms.map((r) => String(r)),
      },
      { restoreState: state },
    );
  }

  function onStartFreshClick() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    removeRestoreSessionBanner();
  }

  function ensureRestoreSessionBanner() {
    const setup = document.getElementById("setup-screen");
    if (!setup) return;
    if (setup.style.display === "none") return;
    const outgoing = document.getElementById("outgoing-screen");
    if (outgoing && outgoing.style.display === "block") {
      return;
    }
    if (document.getElementById("chargedeck-restore-banner")) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let st;
    try {
      st = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!st || !st.savedAt) return;
    const when = new Date(st.savedAt);
    const whenStr = Number.isNaN(when.getTime())
      ? String(st.savedAt)
      : when.toLocaleString();
    const wrap = document.createElement("div");
    wrap.id = "chargedeck-restore-banner";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Saved session");
    const p = document.createElement("p");
    p.appendChild(
      document.createTextNode("You have a saved session from "),
    );
    const strong = document.createElement("strong");
    strong.textContent = whenStr;
    p.appendChild(strong);
    p.appendChild(
      document.createTextNode(". Would you like to restore it?"),
    );
    p.style.margin = "0 0 0.6rem 0";
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;flex-wrap:wrap;gap:0.5rem;";
    const btnYes = document.createElement("button");
    btnYes.type = "button";
    btnYes.id = "chargedeck-restore-confirm";
    btnYes.className = "button";
    btnYes.textContent = "Restore Session";
    const btnNo = document.createElement("button");
    btnNo.type = "button";
    btnNo.id = "chargedeck-restore-dismiss";
    btnNo.className = "button button--secondary";
    btnNo.textContent = "Start Fresh";
    actions.appendChild(btnYes);
    actions.appendChild(btnNo);
    wrap.style.cssText =
      "margin:0 0 1rem 0;padding:0.75rem 1rem;border:1px solid rgba(148,163,184,0.45);border-radius:10px;background:#f0f4fb;font-size:0.9rem;color:#0f172a;";
    wrap.appendChild(p);
    wrap.appendChild(actions);
    setup.insertBefore(wrap, setup.firstChild);
    btnYes.addEventListener("click", onRestoreSessionClick);
    btnNo.addEventListener("click", onStartFreshClick);
  }

  function init() {
    const btn = document.getElementById("generate-board");
    if (btn) {
      btn.addEventListener("click", onGenerateClick);
    }

    const outgoingBack = document.getElementById("outgoing-back-setup");
    if (outgoingBack) {
      outgoingBack.addEventListener("click", onOutgoingBackToSetup);
    }

    const outgoingSkip = document.getElementById("outgoing-skip");
    if (outgoingSkip) {
      outgoingSkip.addEventListener("click", onOutgoingSkipToBoard);
    }

    const outgoingContinue = document.getElementById("outgoing-continue");
    if (outgoingContinue) {
      outgoingContinue.addEventListener("click", onOutgoingContinueToBoard);
    }

    const outgoingCount = document.getElementById("outgoing-nurse-count");
    if (outgoingCount) {
      outgoingCount.addEventListener("input", onOutgoingNurseCountChange);
      outgoingCount.addEventListener("change", onOutgoingNurseCountChange);
    }

    const toggleRoomsBtn = document.getElementById("toggle-rooms");
    if (toggleRoomsBtn) {
      toggleRoomsBtn.addEventListener("click", onToggleRoomsClick);
      updateToggleRoomsLabel();
    }

    ensureFlagModal();
    ensureRestoreSessionBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

