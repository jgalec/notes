document.addEventListener("DOMContentLoaded", () => {
  // --- DOM ELEMENTS ---
  const canvas = document.getElementById("canvas");
  const notesContainer = document.getElementById("notesContainer");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const colorPalette = document.getElementById("colorPalette");
  const settingsBtn = document.getElementById("settingsBtn");
  const colorPickerBtn = document.getElementById("colorPickerBtn");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const settingsModal = document.getElementById("settingsModal");
  const colorModal = document.getElementById("colorModal");
  const snapToGridSwitch = document.getElementById("snapToGridSwitch");
  const markdownSwitch = document.getElementById("markdownSwitch");

  // --- APP STATE ---
  let activeColor = "yellow";
  let selectedNoteId = null;
  const NOTES_STORAGE_KEY = "stickyNotesApp.notes";
  const THEME_STORAGE_KEY = "stickyNotesApp.theme";
  const SNAP_STORAGE_KEY = "stickyNotesApp.snapToGrid";
  const MARKDOWN_STORAGE_KEY = "stickyNotesApp.markdown";
  const GRID_SIZE = 20;

  // --- CANVAS STATE ---
  let pan = { x: 0, y: 0 };
  let isPanning = false;
  let startPanPoint = { x: 0, y: 0 };

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    addNoteBtn.addEventListener("click", createNewNote);
    themeToggleBtn.addEventListener("click", toggleTheme);
    snapToGridSwitch.addEventListener("change", saveSnapSetting);
    markdownSwitch.addEventListener("change", handleMarkdownToggle);

    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsModal.classList.toggle("hidden");
      colorModal.classList.add("hidden");
    });

    colorPickerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      colorModal.classList.toggle("hidden");
      settingsModal.classList.add("hidden");
    });

    colorPalette.addEventListener("click", (e) => {
      const target = e.target.closest(".color-swatch");
      if (!target) return;

      const newColor = target.dataset.color;

      document
        .querySelectorAll("#colorPalette .color-swatch")
        .forEach((s) => s.classList.remove("ring-2", "ring-blue-500"));
      target.classList.add("ring-2", "ring-blue-500");

      if (selectedNoteId) {
        const selectedNote = document.getElementById(selectedNoteId);
        if (selectedNote) {
          selectedNote.dataset.color = newColor;
          saveNotes();
        }
      } else {
        activeColor = newColor;
      }
    });

    canvas.addEventListener("mousedown", startPanning);
    canvas.addEventListener("mouseup", stopPanning);
    canvas.addEventListener("mouseleave", stopPanning);
    canvas.addEventListener("mousemove", handlePanning);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("click", (e) => {
      if (
        !settingsBtn.contains(e.target) &&
        !e.target.closest("#settingsModal")
      ) {
        settingsModal.classList.add("hidden");
      }
      if (
        !colorPickerBtn.contains(e.target) &&
        !e.target.closest("#colorModal")
      ) {
        colorModal.classList.add("hidden");
      }

      if (e.target === canvas || e.target === notesContainer) {
        deselectAllNotes();
      }
    });
  }

  // --- NOTE & RENDER LOGIC ---
  function createNewNote() {
    let x = pan.x + window.innerWidth / 2 - 110;
    let y = pan.y + window.innerHeight / 2 - 110;

    if (snapToGridSwitch.checked) {
      x = Math.round(x / GRID_SIZE) * GRID_SIZE;
      y = Math.round(y / GRID_SIZE) * GRID_SIZE;
    }

    const newNote = {
      id: `note_${Date.now()}`,
      text: "",
      color: activeColor,
      position: { x, y },
      width: 220,
      height: 220,
    };
    renderNote(newNote);
    saveNotes();
  }

  function deselectAllNotes() {
    document.querySelectorAll(".note.selected").forEach((note) => {
      note.classList.remove("selected");
    });
    selectedNoteId = null;
  }

  function selectNote(noteElement) {
    deselectAllNotes();
    noteElement.classList.add("selected");
    selectedNoteId = noteElement.id;
  }

  // --- SETTINGS LOGIC ---
  function applyTheme(theme) {
    const icon = themeToggleBtn.querySelector("i");
    document.documentElement.classList.toggle("dark", theme === "dark");
    icon.classList.toggle("fa-moon", theme !== "dark");
    icon.classList.toggle("fa-sun", theme === "dark");
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateColorPalette();
  }
  function toggleTheme() {
    const newTheme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    applyTheme(newTheme);
  }
  function updateColorPalette() {
    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      const colorName = swatch.dataset.color;
      swatch.style.backgroundColor = `var(--note-color-${colorName})`;
    });
  }
  function loadSettings() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
    applyTheme(savedTheme);

    const shouldSnap = localStorage.getItem(SNAP_STORAGE_KEY) === "true";
    snapToGridSwitch.checked = shouldSnap;

    const useMarkdown = localStorage.getItem(MARKDOWN_STORAGE_KEY) === "true";
    markdownSwitch.checked = useMarkdown;
  }
  function saveSnapSetting() {
    localStorage.setItem(SNAP_STORAGE_KEY, snapToGridSwitch.checked);
  }

  // --- MARKDOWN LOGIC ---
  function handleMarkdownToggle() {
    const isEnabled = markdownSwitch.checked;
    localStorage.setItem(MARKDOWN_STORAGE_KEY, isEnabled);
    document.querySelectorAll(".note").forEach((noteEl) => {
      const content = noteEl.querySelector(".note-content");
      if (isEnabled) {
        content.innerHTML = marked.parse(content.dataset.rawText);
        content.contentEditable = false;
      } else {
        content.innerText = content.dataset.rawText;
        content.contentEditable = true;
      }
    });
  }

  // --- DRAG & RESIZE LOGIC ---
  function makeDraggable(element) {
    function dragMouseDown(e) {
      if (e.target.closest(".note-content, .resize-handle") || e.button !== 0)
        return;
      e.preventDefault();
      element.classList.add("is-dragging");
      selectNote(element);
      const offsetX = e.clientX + pan.x - parseInt(element.style.left, 10);
      const offsetY = e.clientY + pan.y - parseInt(element.style.top, 10);

      function elementDrag(e) {
        e.preventDefault();
        element.style.left = e.clientX + pan.x - offsetX + "px";
        element.style.top = e.clientY + pan.y - offsetY + "px";
      }

      function closeDragElement() {
        element.classList.remove("is-dragging");
        document.removeEventListener("mousemove", elementDrag);
        document.removeEventListener("mouseup", closeDragElement);
        if (snapToGridSwitch.checked) {
          element.style.left =
            Math.round(parseInt(element.style.left, 10) / GRID_SIZE) *
              GRID_SIZE +
            "px";
          element.style.top =
            Math.round(parseInt(element.style.top, 10) / GRID_SIZE) *
              GRID_SIZE +
            "px";
        }
        saveNotes();
      }

      document.addEventListener("mousemove", elementDrag);
      document.addEventListener("mouseup", closeDragElement);
    }
    element.addEventListener("mousedown", dragMouseDown);
  }

  function makeResizable(element) {
    const handles = element.querySelectorAll(".resize-handle");
    handles.forEach((handle) => {
      handle.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        element.classList.add("is-resizing");

        const direction = handle.classList.contains("se")
          ? "se"
          : handle.classList.contains("sw")
          ? "sw"
          : handle.classList.contains("ne")
          ? "ne"
          : "nw";
        let originalWidth = element.offsetWidth;
        let originalHeight = element.offsetHeight;
        let originalX = element.offsetLeft;
        let originalY = element.offsetTop;
        let startMouseX = e.clientX + pan.x;
        let startMouseY = e.clientY + pan.y;

        function resizeElement(e) {
          const dx = e.clientX + pan.x - startMouseX;
          const dy = e.clientY + pan.y - startMouseY;
          const minWidth = parseInt(element.style.minWidth);
          const minHeight = parseInt(element.style.minHeight);

          if (direction.includes("e")) {
            const newWidth = originalWidth + dx;
            if (newWidth > minWidth) element.style.width = newWidth + "px";
          }
          if (direction.includes("w")) {
            const newWidth = originalWidth - dx;
            if (newWidth > minWidth) {
              element.style.width = newWidth + "px";
              element.style.left = originalX + dx + "px";
            }
          }
          if (direction.includes("s")) {
            const newHeight = originalHeight + dy;
            if (newHeight > minHeight) element.style.height = newHeight + "px";
          }
          if (direction.includes("n")) {
            const newHeight = originalHeight - dy;
            if (newHeight > minHeight) {
              element.style.height = newHeight + "px";
              element.style.top = originalY + dy + "px";
            }
          }
        }

        function stopResize() {
          element.classList.remove("is-resizing");
          document.removeEventListener("mousemove", resizeElement);
          document.removeEventListener("mouseup", stopResize);
          if (snapToGridSwitch.checked) {
            element.style.width =
              Math.round(element.offsetWidth / GRID_SIZE) * GRID_SIZE + "px";
            element.style.height =
              Math.round(element.offsetHeight / GRID_SIZE) * GRID_SIZE + "px";
            element.style.left =
              Math.round(element.offsetLeft / GRID_SIZE) * GRID_SIZE + "px";
            element.style.top =
              Math.round(element.offsetTop / GRID_SIZE) * GRID_SIZE + "px";
          }
          saveNotes();
        }

        document.addEventListener("mousemove", resizeElement);
        document.addEventListener("mouseup", stopResize);
      });
    });
  }

  // --- INIT ---
  function init() {
    loadSettings();
    setupEventListeners();
    loadNotes();
    requestAnimationFrame(updateTransform);
  }

  // --- DATA & RENDER FUNCTIONS ---
  function saveNotes() {
    const notes = [];
    document.querySelectorAll(".note").forEach((noteEl) => {
      notes.push({
        id: noteEl.id,
        text: noteEl.querySelector(".note-content").dataset.rawText,
        color: noteEl.dataset.color,
        position: {
          x: parseInt(noteEl.style.left, 10),
          y: parseInt(noteEl.style.top, 10),
        },
        width: parseInt(noteEl.style.width, 10),
        height: parseInt(noteEl.style.height, 10),
      });
    });
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  }
  function loadNotes() {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);
    if (stored) {
      JSON.parse(stored).forEach((note) => renderNote(note));
    }
  }
  function renderNote(data) {
    const el = document.createElement("div");
    el.id = data.id;
    el.className = "note";
    el.dataset.color = data.color;
    el.style.left = `${data.position.x}px`;
    el.style.top = `${data.position.y}px`;
    el.style.width = `${data.width || 220}px`;
    el.style.height = `${data.height || 220}px`;
    el.style.minWidth = `160px`;
    el.style.minHeight = `160px`;

    el.innerHTML = `
                    <div class="note-header"><i class="fas fa-times delete-note" title="Delete Note"></i></div>
                    <div class="note-content-wrapper">
                        <div class="note-content"></div>
                    </div>
                    <div class="resize-handle nw"></div>
                    <div class="resize-handle ne"></div>
                    <div class="resize-handle sw"></div>
                    <div class="resize-handle se"></div>
                `;

    const content = el.querySelector(".note-content");
    const rawText = data.text || "";
    content.dataset.rawText = rawText;

    if (markdownSwitch.checked) {
      content.innerHTML = marked.parse(rawText);
      content.contentEditable = false;
    } else {
      content.innerText = rawText;
      content.contentEditable = true;
    }

    notesContainer.appendChild(el);
    makeDraggable(el);
    makeResizable(el);
    addNoteEventListeners(el);
  }

  function addNoteEventListeners(el) {
    const content = el.querySelector(".note-content");
    const deleteBtn = el.querySelector(".delete-note");

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (
        !el.classList.contains("is-dragging") &&
        !el.classList.contains("is-resizing")
      ) {
        selectNote(el);
      }
    });

    content.addEventListener("dblclick", () => {
      if (markdownSwitch.checked && !content.isContentEditable) {
        content.innerText = content.dataset.rawText;
        content.contentEditable = true;
        content.focus();
      }
    });

    content.addEventListener("blur", () => {
      if (content.contentEditable === "false") return;

      const newRawText = content.innerText;
      content.dataset.rawText = newRawText;

      if (markdownSwitch.checked) {
        content.innerHTML = marked.parse(newRawText);
        content.contentEditable = false;
      }
      saveNotes();
    });

    deleteBtn.addEventListener("click", () => {
      el.remove();
      saveNotes();
    });
  }

  function startPanning(e) {
    if (e.button !== 1) return;
    e.preventDefault();
    isPanning = true;
    canvas.classList.add("panning");
    startPanPoint = { x: e.clientX, y: e.clientY };
  }
  function stopPanning() {
    isPanning = false;
    canvas.classList.remove("panning");
  }
  function handlePanning(e) {
    if (!isPanning) return;
    e.preventDefault();
    const dx = e.clientX - startPanPoint.x,
      dy = e.clientY - startPanPoint.y;
    pan.x -= dx;
    pan.y -= dy;
    startPanPoint = { x: e.clientX, y: e.clientY };
  }
  function updateTransform() {
    notesContainer.style.transform = `translate(${-pan.x}px, ${-pan.y}px)`;
    canvas.style.backgroundPosition = `${-pan.x}px ${-pan.y}px`;
    requestAnimationFrame(updateTransform);
  }

  init();
});
