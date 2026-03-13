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

  function showBoard({ shiftType, nurseCount, rooms }) {
    const setup = document.querySelector(".app-main");
    const board = ensureBoardContainer();

    if (setup) setup.style.display = "none";
    board.style.display = "";

    const roomsList = rooms.length ? rooms.join(", ") : "(none)";

    board.innerHTML = `
      <div>Shift type: ${shiftType}</div>
      <div>Number of nurses: ${nurseCount}</div>
      <div>Selected rooms: ${roomsList}</div>
      <button type="button" id="back-to-setup">Back to Setup</button>
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
    if (!btn) return;
    btn.addEventListener("click", onGenerateClick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

