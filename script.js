/* =========================================================
   IMAGE CONVERTER
   Production-ready client-side image converter
   No server uploads - everything happens in the browser
   ========================================================= */

(() => {
  "use strict";

  /* -------------------------------------------------------
     CONFIGURATION
  ------------------------------------------------------- */

  const CONFIG = {
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB
    MAX_PIXELS: 50_000_000,
    MAX_DIMENSION: 16000,
    HISTORY_LIMIT: 20,
    HISTORY_KEY: "imageConverterHistory",
    SUPPORTED_INPUTS: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/avif",
      "image/gif",
      "image/bmp"
    ],
    OUTPUTS: {
      png: {
        mime: "image/png",
        extension: "png"
      },
      jpeg: {
        mime: "image/jpeg",
        extension: "jpg"
      },
      webp: {
        mime: "image/webp",
        extension: "webp"
      },
      avif: {
        mime: "image/avif",
        extension: "avif"
      }
    }
  };

  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */

  const state = {
    files: [],
    results: [],
    selectedResult: null,
    busy: false,
    aspectLocked: true,
    activeDimensions: {
      preset: "original",
      width: null,
      height: null
    },
    previewURLs: new Map(),
    resultURLs: new Map(),
    history: []
  };

  /* -------------------------------------------------------
     DOM HELPERS
  ------------------------------------------------------- */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const byId = (id) => document.getElementById(id);

  const els = {};

  function cacheDOM() {
    els.uploadArea = byId("upload-area");
    els.browseBtn = byId("browse-btn");
    els.fileInput = byId("file-input");

    els.pasteNotice = byId("paste-notice");

    els.errorBanner = byId("error-banner");
    els.errorMessage = byId("error-message");
    els.errorClose = byId("error-close");

    els.imageQueue = byId("image-queue");
    els.queueCount = byId("queue-count");
    els.queueList = byId("queue-list");
    els.clearAllBtn = byId("clear-all-btn");

    els.settingsPanel = byId("settings-panel");

    els.qualitySection = byId("quality-section");
    els.qualitySlider = byId("quality-slider");
    els.qualityValue = byId("quality-value");

    els.resizePresets = byId("resize-presets");
    els.resizeInputs = byId("resize-inputs");
    els.widthInput = byId("width-input");
    els.heightInput = byId("height-input");
    els.aspectLock = byId("aspect-lock");

    els.advancedSettings = byId("advanced-settings");

    els.customTargetWrap = byId("custom-target-wrap");
    els.customTargetSize = byId("custom-target-size");

    els.jpegBgSection = byId("jpeg-bg-section");
    els.bgColorSelect = byId("bg-color-select");
    els.bgColorCustom = byId("bg-color-custom");

    els.stripMetadata = byId("strip-metadata");

    els.estimatedSize = byId("estimated-size");
    els.estimatedValue = byId("estimated-value");

    els.convertBtn = byId("convert-btn");

    els.progressSection = byId("progress-section");
    els.progressLabel = byId("progress-label");
    els.progressBar = byId("progress-bar");
    els.progressSub = byId("progress-sub");

    els.resultsSection = byId("results-section");
    els.comparison = byId("comparison");

    els.compareOriginalImg = byId("compare-original-img");
    els.compareOriginalFormat = byId("compare-original-format");
    els.compareOriginalSize = byId("compare-original-size");
    els.compareOriginalDims = byId("compare-original-dims");

    els.compareConvertedImg = byId("compare-converted-img");
    els.compareConvertedFormat = byId("compare-converted-format");
    els.compareConvertedSize = byId("compare-converted-size");
    els.compareConvertedDims = byId("compare-converted-dims");

    els.savingsBadge = byId("savings-badge");

    els.resultsList = byId("results-list");

    els.downloadActions = byId("download-actions");
    els.downloadSingleBtn = byId("download-single-btn");
    els.downloadAllBtn = byId("download-all-btn");
    els.clearResultsBtn = byId("clear-results-btn");

    els.convertAgainBtn = byId("convert-again-btn");

    els.historySection = byId("history-section");
    els.historyList = byId("history-list");
    els.clearHistoryBtn = byId("clear-history-btn");

    els.footerYear = byId("footer-year");

    els.navHamburger = $(".nav-hamburger");
    els.mobileMenu = byId("mobile-menu");
  }

  /* -------------------------------------------------------
     INITIALIZATION
  ------------------------------------------------------- */

  function init() {
    cacheDOM();

    if (els.footerYear) {
      els.footerYear.textContent = new Date().getFullYear();
    }

    loadHistory();
    bindEvents();
    updateFormatUI();
    updateQualityUI();
    updateResizeInputs();
    updateUI();

    registerServiceWorker();
  }

  /* -------------------------------------------------------
     EVENT BINDINGS
  ------------------------------------------------------- */

  function bindEvents() {
    /* Upload */

    els.browseBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      els.fileInput?.click();
    });

    els.uploadArea?.addEventListener("click", (event) => {
      if (
        event.target === els.browseBtn ||
        els.browseBtn?.contains(event.target)
      ) {
        return;
      }

      els.fileInput?.click();
    });

    els.uploadArea?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        els.fileInput?.click();
      }
    });

    els.fileInput?.addEventListener("change", (event) => {
      handleFiles(event.target.files);
      event.target.value = "";
    });

    /* Drag & Drop */

    ["dragenter", "dragover"].forEach((eventName) => {
      els.uploadArea?.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.uploadArea.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      els.uploadArea?.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.uploadArea.classList.remove("drag-over");
      });
    });

    els.uploadArea?.addEventListener("drop", (event) => {
      handleFiles(event.dataTransfer.files);
    });

    /* Clipboard */

    document.addEventListener("paste", handlePaste);

    /* Error */

    els.errorClose?.addEventListener("click", hideError);

    /* Queue */

    els.clearAllBtn?.addEventListener("click", clearFiles);

    /* Format */

    $$('input[name="format"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        updateFormatUI();
        updateEstimatedSize();
      });
    });

    /* Quality */

    els.qualitySlider?.addEventListener("input", () => {
      updateQualityUI();
      updateEstimatedSize();
    });

    /* Resize presets */

    els.resizePresets?.addEventListener("click", (event) => {
      const button = event.target.closest(".preset-btn");

      if (!button) return;

      const preset = button.dataset.preset;

      setActivePreset(preset);

      if (preset === "original") {
        state.activeDimensions.width = null;
        state.activeDimensions.height = null;

        els.widthInput.value = "";
        els.heightInput.value = "";

        updateResizeInputs();
        updateEstimatedSize();
        return;
      }

      if (preset === "custom") {
        updateResizeInputs();
        els.widthInput.focus();
        return;
      }

      const [width, height] = preset.split("x").map(Number);

      state.activeDimensions.width = width;
      state.activeDimensions.height = height;

      if (state.aspectLocked && state.files.length) {
        const first = state.files[0];

        if (first.width && first.height) {
          const resized = fitInside(
            first.width,
            first.height,
            width,
            height
          );

          state.activeDimensions.width = resized.width;
          state.activeDimensions.height = resized.height;

          els.widthInput.value = resized.width;
          els.heightInput.value = resized.height;
        }
      } else {
        els.widthInput.value = width;
        els.heightInput.value = height;
      }

      updateResizeInputs();
      updateEstimatedSize();
    });

    /* Width / Height */

    els.widthInput?.addEventListener("input", () => {
      setActivePreset("custom");

      let width = clamp(
        parseInt(els.widthInput.value, 10) || 0,
        1,
        CONFIG.MAX_DIMENSION
      );

      if (!width) return;

      if (state.aspectLocked && state.files[0]?.width) {
        const original = state.files[0];

        const height = Math.round(
          width * (original.height / original.width)
        );

        els.heightInput.value = clamp(
          height,
          1,
          CONFIG.MAX_DIMENSION
        );

        state.activeDimensions.height = height;
      }

      state.activeDimensions.width = width;

      updateEstimatedSize();
    });

    els.heightInput?.addEventListener("input", () => {
      setActivePreset("custom");

      let height = clamp(
        parseInt(els.heightInput.value, 10) || 0,
        1,
        CONFIG.MAX_DIMENSION
      );

      if (!height) return;

      if (state.aspectLocked && state.files[0]?.height) {
        const original = state.files[0];

        const width = Math.round(
          height * (original.width / original.height)
        );

        els.widthInput.value = clamp(
          width,
          1,
          CONFIG.MAX_DIMENSION
        );

        state.activeDimensions.width = width;
      }

      state.activeDimensions.height = height;

      updateEstimatedSize();
    });

    /* Aspect ratio */

    els.aspectLock?.addEventListener("click", toggleAspectLock);

    els.aspectLock?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleAspectLock();
      }
    });

    /* Target size */

    $$('input[name="target-size"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        updateTargetSizeUI();
        updateEstimatedSize();
      });
    });

    els.customTargetSize?.addEventListener("input", updateEstimatedSize);

    /* JPEG background */

    els.bgColorSelect?.addEventListener("change", () => {
      const custom = els.bgColorSelect.value === "custom";

      els.bgColorCustom.hidden = !custom;

      if (custom) {
        els.bgColorCustom.focus();
      }
    });

    /* Convert */

    els.convertBtn?.addEventListener("click", convertAll);

    /* Results */

    els.downloadSingleBtn?.addEventListener("click", () => {
      if (state.selectedResult) {
        downloadResult(state.selectedResult);
      }
    });

    els.downloadAllBtn?.addEventListener(
      "click",
      downloadAllAsZip
    );

    els.clearResultsBtn?.addEventListener(
      "click",
      clearResults
    );

    els.convertAgainBtn?.addEventListener("click", () => {
      clearResults();

      els.converter?.scrollIntoView?.({
        behavior: "smooth",
        block: "start"
      });
    });

    /* History */

    els.clearHistoryBtn?.addEventListener("click", clearHistory);

    /* Result list */

    els.resultsList?.addEventListener("click", (event) => {
      const button = event.target.closest(
        "[data-result-index]"
      );

      if (!button) return;

      const index = Number(button.dataset.resultIndex);

      if (!Number.isInteger(index)) return;

      const result = state.results[index];

      if (!result) return;

      if (button.dataset.action === "download") {
        downloadResult(result);
      }

      if (button.dataset.action === "compare") {
        selectResult(result);
      }
    });

    /* Mobile menu */

    els.navHamburger?.addEventListener(
      "click",
      toggleMobileMenu
    );

    $$("#mobile-menu a").forEach((link) => {
      link.addEventListener("click", closeMobileMenu);
    });

    /* ESC */

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMobileMenu();
        hideError();
      }
    });
  }

  /* -------------------------------------------------------
     FILE HANDLING
  ------------------------------------------------------- */

  async function handleFiles(fileList) {
    if (!fileList || !fileList.length) return;

    const incoming = Array.from(fileList);

    let accepted = 0;
    let rejected = 0;

    for (const file of incoming) {
      try {
        validateFile(file);

        const duplicate = state.files.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified
        );

        if (duplicate) continue;

        const metadata = await readImageMetadata(file);

        if (
          metadata.width * metadata.height >
          CONFIG.MAX_PIXELS
        ) {
          throw new Error(
            `${file.name} is too large in dimensions. Images above 50 megapixels are not supported.`
          );
        }

        state.files.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          width: metadata.width,
          height: metadata.height,
          previewURL: metadata.previewURL
        });

        accepted++;
      } catch (error) {
        rejected++;
        showError(
          error?.message ||
            `Could not add "${file.name}".`
        );
      }
    }

    if (accepted > 0) {
      hideError();

      /*
       * Initialize dimensions from first image
       * if the user hasn't selected a custom preset.
       */
      if (
        state.activeDimensions.preset === "original" &&
        state.files.length === accepted
      ) {
        resetResizeToOriginal();
      }

      updateUI();
      updateEstimatedSize();

      els.settingsPanel?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }

    if (rejected && accepted === 0) {
      updateUI();
    }
  }

  function validateFile(file) {
    if (!file) {
      throw new Error("Invalid file.");
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
      throw new Error(
        `"${file.name}" is larger than 50 MB.`
      );
    }

    const extension = getExtension(file.name);

    const allowedExtensions = [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "avif",
      "gif",
      "bmp"
    ];

    const validType =
      CONFIG.SUPPORTED_INPUTS.includes(file.type);

    const validExtension =
      allowedExtensions.includes(extension);

    if (!validType && !validExtension) {
      throw new Error(
        `"${file.name}" is not a supported image format.`
      );
    }
  }

  async function readImageMetadata(file) {
    const url = URL.createObjectURL(file);

    try {
      const img = await loadImage(url);

      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        previewURL: url
      };
    } catch (error) {
      URL.revokeObjectURL(url);

      throw new Error(
        `"${file.name}" could not be decoded by your browser.`
      );
    }
  }

  /* -------------------------------------------------------
     CLIPBOARD
  ------------------------------------------------------- */

  async function handlePaste(event) {
    if (
      document.activeElement &&
      ["INPUT", "TEXTAREA"].includes(
        document.activeElement.tagName
      )
    ) {
      return;
    }

    const items = Array.from(
      event.clipboardData?.items || []
    );

    const imageItems = items.filter((item) =>
      item.type.startsWith("image/")
    );

    if (!imageItems.length) return;

    const files = imageItems
      .map((item) => item.getAsFile())
      .filter(Boolean);

    if (!files.length) return;

    event.preventDefault();

    const renamed = files.map(
      (file, index) =>
        new File(
          [file],
          `pasted-image-${Date.now()}-${index + 1}.${getExtensionFromMime(
            file.type
          )}`,
          {
            type: file.type,
            lastModified: Date.now()
          }
        )
    );

    await handleFiles(renamed);

    showPasteNotice();
  }

  function showPasteNotice() {
    if (!els.pasteNotice) return;

    els.pasteNotice.hidden = false;

    clearTimeout(showPasteNotice.timer);

    showPasteNotice.timer = setTimeout(() => {
      els.pasteNotice.hidden = true;
    }, 3000);
  }

  /* -------------------------------------------------------
     QUEUE
  ------------------------------------------------------- */

  function renderQueue() {
    if (!els.queueList || !els.imageQueue) return;

    els.queueList.innerHTML = "";

    state.files.forEach((item, index) => {
      const wrapper = document.createElement("div");

      wrapper.className = "queue-item";
      wrapper.setAttribute("role", "listitem");

      const preview = document.createElement("img");

      preview.className = "queue-thumb";
      preview.src = item.previewURL;
      preview.alt = "";

      const info = document.createElement("div");

      info.className = "queue-info";

      const name = document.createElement("div");

      name.className = "queue-name";
      name.textContent = item.name;
      name.title = item.name;

      const meta = document.createElement("div");

      meta.className = "queue-meta";
      meta.textContent =
        `${formatBytes(item.size)} · ` +
        `${item.width} × ${item.height}`;

      info.appendChild(name);
      info.appendChild(meta);

      const remove = document.createElement("button");

      remove.type = "button";
      remove.className = "queue-remove";
      remove.setAttribute(
        "aria-label",
        `Remove ${item.name}`
      );
      remove.title = "Remove";

      remove.innerHTML = "×";

      remove.addEventListener("click", () => {
        removeFile(index);
      });

      wrapper.appendChild(preview);
      wrapper.appendChild(info);
      wrapper.appendChild(remove);

      els.queueList.appendChild(wrapper);
    });

    els.queueCount.textContent =
      `${state.files.length} ${
        state.files.length === 1 ? "image" : "images"
      } selected`;

    els.imageQueue.hidden = state.files.length === 0;
  }

  function removeFile(index) {
    const item = state.files[index];

    if (item?.previewURL) {
      URL.revokeObjectURL(item.previewURL);
    }

    state.files.splice(index, 1);

    if (!state.files.length) {
      resetConverterState();
    }

    updateUI();
    updateEstimatedSize();
  }

  function clearFiles() {
    state.files.forEach((item) => {
      if (item.previewURL) {
        URL.revokeObjectURL(item.previewURL);
      }
    });

    state.files = [];

    clearResults();
    resetResizeToOriginal();

    updateUI();
  }

  /* -------------------------------------------------------
     UI STATE
  ------------------------------------------------------- */

  function updateUI() {
    renderQueue();

    const hasFiles = state.files.length > 0;

    if (els.settingsPanel) {
      els.settingsPanel.hidden = !hasFiles;
    }

    if (els.estimatedSize) {
      els.estimatedSize.hidden = !hasFiles;
    }

    if (els.convertBtn) {
      els.convertBtn.disabled =
        !hasFiles || state.busy;
    }

    if (els.clearAllBtn) {
      els.clearAllBtn.disabled =
        !hasFiles || state.busy;
    }

    updateFormatUI();
    updateTargetSizeUI();
  }

  function updateFormatUI() {
    const format = getSelectedFormat();

    if (els.jpegBgSection) {
      els.jpegBgSection.hidden =
        format !== "jpeg";
    }

    const qualityFormats = ["jpeg", "webp", "avif"];

    if (els.qualitySection) {
      els.qualitySection.hidden =
        !qualityFormats.includes(format);
    }

    /*
     * Check whether AVIF is actually supported.
     */
    const avifRadio = $('input[name="format"][value="avif"]');

    if (avifRadio) {
      const supported = supportsMime("image/avif");

      avifRadio.disabled = !supported;

      const avifOption = byId("avif-option");

      if (avifOption) {
        avifOption.hidden = !supported;
      }

      if (
        !supported &&
        avifRadio.checked
      ) {
        const webpRadio = $(
          'input[name="format"][value="webp"]'
        );

        if (webpRadio) {
          webpRadio.checked = true;
        }
      }
    }
  }

  function updateQualityUI() {
    if (!els.qualitySlider || !els.qualityValue) {
      return;
    }

    const value = clamp(
      Number(els.qualitySlider.value) || 85,
      1,
      100
    );

    els.qualitySlider.value = value;
    els.qualitySlider.setAttribute(
      "aria-valuenow",
      value
    );

    els.qualityValue.textContent = `${value}%`;
  }

  function updateResizeInputs() {
    const original = state.activeDimensions.preset === "original";

    if (original && state.files[0]) {
      els.widthInput.value = state.files[0].width;
      els.heightInput.value = state.files[0].height;
    }

    if (!state.files.length) {
      els.widthInput.value = "";
      els.heightInput.value = "";
    }

    if (els.aspectLock) {
      els.aspectLock.setAttribute(
        "aria-pressed",
        String(state.aspectLocked)
      );

      els.aspectLock.classList.toggle(
        "locked",
        state.aspectLocked
      );
    }
  }

  function updateTargetSizeUI() {
    const target = getTargetSize();

    if (els.customTargetWrap) {
      els.customTargetWrap.hidden =
        target !== "custom";
    }
  }

  function setActivePreset(preset) {
    state.activeDimensions.preset = preset;

    $$(".preset-btn").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.preset === preset
      );
    });
  }

  function resetResizeToOriginal() {
    setActivePreset("original");

    state.activeDimensions.width = null;
    state.activeDimensions.height = null;

    if (els.widthInput) {
      els.widthInput.value =
        state.files[0]?.width || "";
    }

    if (els.heightInput) {
      els.heightInput.value =
        state.files[0]?.height || "";
    }
  }

  function toggleAspectLock() {
    state.aspectLocked = !state.aspectLocked;

    if (els.aspectLock) {
      els.aspectLock.setAttribute(
        "aria-pressed",
        String(state.aspectLocked)
      );
    }

    if (
      state.aspectLocked &&
      state.files[0] &&
      els.widthInput.value
    ) {
      const width = Number(els.widthInput.value);

      if (width > 0) {
        const height = Math.round(
          width *
            (state.files[0].height /
              state.files[0].width)
        );

        els.heightInput.value = clamp(
          height,
          1,
          CONFIG.MAX_DIMENSION
        );
      }
    }
  }

  /* -------------------------------------------------------
     CONVERSION
  ------------------------------------------------------- */

  async function convertAll() {
    if (state.busy) return;

    if (!state.files.length) {
      showError("Please select at least one image.");
      return;
    }

    hideError();

    state.busy = true;
    state.results = [];
    state.selectedResult = null;

    showProgress(0, "Preparing conversion...", "");

    if (els.resultsSection) {
      els.resultsSection.hidden = true;
    }

    if (els.comparison) {
      els.comparison.hidden = true;
    }

    try {
      const settings = collectSettings();

      for (
        let index = 0;
        index < state.files.length;
        index++
      ) {
        const item = state.files[index];

        const baseProgress =
          (index / state.files.length) * 100;

        updateProgress(
          baseProgress,
          `Converting ${index + 1} of ${state.files.length}...`,
          item.name
        );

        try {
          const result = await convertOne(
            item,
            settings,
            (localProgress) => {
              const overall =
                baseProgress +
                (localProgress /
                  100) *
                  (100 /
                    state.files.length);

              updateProgress(
                overall,
                `Converting ${index + 1} of ${state.files.length}...`,
                item.name
              );
            }
          );

          state.results.push(result);
        } catch (error) {
          console.error(
            "Conversion failed:",
            item.name,
            error
          );

          showError(
            `Could not convert "${item.name}". ${
              error?.message || ""
            }`
          );
        }

        /*
         * Yield to browser so the UI stays responsive.
         */
        await nextFrame();
      }

      if (!state.results.length) {
        throw new Error(
          "None of the selected images could be converted."
        );
      }

      updateProgress(
        100,
        "Conversion complete",
        `${state.results.length} ${
          state.results.length === 1
            ? "image"
            : "images"
        } converted`
      );

      renderResults();

      state.selectedResult = state.results[0];

      if (state.results.length === 1) {
        selectResult(state.results[0]);
      }

      state.results.forEach(addHistoryEntry);

      saveHistory();

      setTimeout(() => {
        els.resultsSection?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 100);
    } catch (error) {
      console.error(error);

      showError(
        error?.message ||
          "Something went wrong during conversion."
      );
    } finally {
      state.busy = false;

      if (els.convertBtn) {
        els.convertBtn.disabled =
          state.files.length === 0;
      }
    }
  }

  function collectSettings() {
    const format = getSelectedFormat();

    let width = null;
    let height = null;

    if (
      state.activeDimensions.preset !==
      "original"
    ) {
      width =
        parseInt(els.widthInput?.value, 10) ||
        null;

      height =
        parseInt(els.heightInput?.value, 10) ||
        null;

      if (!width || !height) {
        throw new Error(
          "Please enter valid width and height values."
        );
      }

      width = clamp(
        width,
        1,
        CONFIG.MAX_DIMENSION
      );

      height = clamp(
        height,
        1,
        CONFIG.MAX_DIMENSION
      );
    }

    let quality =
      Number(els.qualitySlider?.value) / 100;

    if (!Number.isFinite(quality)) {
      quality = 0.85;
    }

    const target = getTargetSize();

    let targetBytes = null;

    if (target === "custom") {
      const kb =
        Number(els.customTargetSize?.value);

      if (!kb || kb <= 0) {
        throw new Error(
          "Please enter a valid custom target file size."
        );
      }

      targetBytes = kb * 1024;
    } else if (target) {
      targetBytes = Number(target) * 1024;
    }

    let background = "#ffffff";

    if (els.bgColorSelect?.value === "custom") {
      background =
        els.bgColorCustom?.value || "#ffffff";
    } else {
      background =
        els.bgColorSelect?.value ||
        "#ffffff";
    }

    return {
      format,
      quality,
      width,
      height,
      targetBytes,
      background,
      stripMetadata:
        Boolean(els.stripMetadata?.checked)
    };
  }

  async function convertOne(
    item,
    settings,
    progressCallback
  ) {
    const img = await loadImage(item.previewURL);

    let sourceWidth = img.naturalWidth;
    let sourceHeight = img.naturalHeight;

    let width = settings.width || sourceWidth;
    let height = settings.height || sourceHeight;

    /*
     * Never upscale when using a standard resize preset.
     * Custom dimensions are respected exactly.
     */
    if (
      settings.width &&
      settings.height &&
      state.activeDimensions.preset !==
        "custom"
    ) {
      const fitted = fitInside(
        sourceWidth,
        sourceHeight,
        settings.width,
        settings.height
      );

      width = fitted.width;
      height = fitted.height;
    }

    /*
     * Guard against accidentally huge canvas allocations.
     */
    const pixels = width * height;

    if (pixels > CONFIG.MAX_PIXELS) {
      const fitted = fitInside(
        width,
        height,
        Math.sqrt(CONFIG.MAX_PIXELS),
        Math.sqrt(CONFIG.MAX_PIXELS)
      );

      width = fitted.width;
      height = fitted.height;
    }

    progressCallback?.(5);

    let blob;

    if (settings.targetBytes) {
      blob = await convertToTargetSize(
        img,
        width,
        height,
        settings,
        progressCallback
      );
    } else {
      blob = await renderToBlob(
        img,
        width,
        height,
        settings.format,
        settings.quality,
        settings.background
      );

      progressCallback?.(95);
    }

    if (!blob) {
      throw new Error(
        "Your browser could not create the requested output format."
      );
    }

    const extension =
      CONFIG.OUTPUTS[settings.format]
        .extension;

    const outputName =
      makeOutputName(
        item.name,
        extension
      );

    const url = URL.createObjectURL(blob);

    state.resultURLs.set(
      `${item.name}-${state.results.length}-${Date.now()}`,
      url
    );

    progressCallback?.(100);

    return {
      originalFile: item.file,
      originalName: item.name,
      originalSize: item.size,
      originalWidth: sourceWidth,
      originalHeight: sourceHeight,

      blob,
      url,

      outputName,
      format: settings.format,
      mime: blob.type,
      size: blob.size,

      width,
      height
    };
  }

  /* -------------------------------------------------------
     CANVAS RENDERING
  ------------------------------------------------------- */

  async function renderToBlob(
    img,
    width,
    height,
    format,
    quality,
    background
  ) {
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      willReadFrequently: false
    });

    if (!ctx) {
      throw new Error(
        "Canvas is not available in this browser."
      );
    }

    /*
     * Better downscaling quality.
     */
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    /*
     * JPEG cannot store transparency.
     */
    if (format === "jpeg") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(
      img,
      0,
      0,
      width,
      height
    );

    const output =
      CONFIG.OUTPUTS[format];

    if (!output) {
      throw new Error(
        `Unsupported output format: ${format}`
      );
    }

    const blob = await canvasToBlob(
      canvas,
      output.mime,
      quality
    );

    /*
     * Some browsers silently return PNG when a
     * requested MIME type isn't supported.
     */
    if (
      format === "avif" &&
      blob &&
      blob.type !== "image/avif"
    ) {
      throw new Error(
        "AVIF conversion is not supported by this browser."
      );
    }

    return blob;
  }

  function canvasToBlob(
    canvas,
    mime,
    quality
  ) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  "The browser could not create the image."
                )
              );
              return;
            }

            resolve(blob);
          },
          mime,
          quality
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /* -------------------------------------------------------
     TARGET FILE SIZE
  ------------------------------------------------------- */

  async function convertToTargetSize(
    img,
    width,
    height,
    settings,
    progressCallback
  ) {
    /*
     * Target-size conversion is meaningful for lossy
     * formats. PNG doesn't expose useful quality control.
     */
    if (settings.format === "png") {
      const blob = await renderToBlob(
        img,
        width,
        height,
        settings.format,
        1,
        settings.background
      );

      progressCallback?.(95);

      return blob;
    }

    const target = settings.targetBytes;

    let low = 0.05;
    let high = 1.0;

    let bestBlob = null;
    let bestDifference = Infinity;

    /*
     * First render at requested quality.
     */
    for (let iteration = 0; iteration < 9; iteration++) {
      const quality =
        (low + high) / 2;

      const blob = await renderToBlob(
        img,
        width,
        height,
        settings.format,
        quality,
        settings.background
      );

      if (!blob) continue;

      const difference = Math.abs(
        blob.size - target
      );

      if (difference < bestDifference) {
        bestDifference = difference;
        bestBlob = blob;
      }

      const progress =
        10 +
        ((iteration + 1) / 9) * 85;

      progressCallback?.(progress);

      /*
       * We reached the target or got sufficiently close.
       */
      if (
        blob.size <= target &&
        target - blob.size <
          target * 0.03
      ) {
        bestBlob = blob;
        break;
      }

      if (blob.size > target) {
        high = quality;
      } else {
        low = quality;
      }

      await nextFrame();
    }

    /*
     * If even minimum quality is too large, try resizing
     * slightly rather than producing a misleading result.
     */
    if (
      bestBlob &&
      bestBlob.size > target
    ) {
      let scale = 0.9;

      for (let attempt = 0; attempt < 4; attempt++) {
        const smallerWidth = Math.max(
          1,
          Math.round(width * scale)
        );

        const smallerHeight = Math.max(
          1,
          Math.round(height * scale)
        );

        const blob = await renderToBlob(
          img,
          smallerWidth,
          smallerHeight,
          settings.format,
          0.5,
          settings.background
        );

        if (
          blob &&
          blob.size < bestBlob.size
        ) {
          bestBlob = blob;
        }

        if (
          blob &&
          blob.size <= target
        ) {
          break;
        }

        scale -= 0.1;
      }
    }

    progressCallback?.(100);

    return bestBlob;
  }

  /* -------------------------------------------------------
     RESULTS
  ------------------------------------------------------- */

  function renderResults() {
    if (!els.resultsSection) return;

    els.resultsSection.hidden = false;

    renderResultsList();

    const single =
      state.results.length === 1;

    els.downloadSingleBtn.hidden = !single;
    els.downloadAllBtn.hidden =
      state.results.length <= 1;

    els.comparison.hidden = true;
  }

  function renderResultsList() {
    if (!els.resultsList) return;

    els.resultsList.innerHTML = "";

    /*
     * For a single result, the comparison section is enough.
     * For multiple results, show cards.
     */
    if (state.results.length === 1) {
      els.resultsList.innerHTML = "";
      return;
    }

    state.results.forEach((result, index) => {
      const card =
        document.createElement("div");

      card.className = "result-card";
      card.setAttribute("role", "listitem");

      const image =
        document.createElement("img");

      image.className = "result-thumb";
      image.src = result.url;
      image.alt =
        `Converted ${result.outputName}`;
      image.loading = "lazy";

      const info =
        document.createElement("div");

      info.className = "result-info";

      const name =
        document.createElement("div");

      name.className = "result-name";
      name.textContent =
        result.outputName;
      name.title =
        result.outputName;

      const meta =
        document.createElement("div");

      meta.className = "result-meta";

      meta.textContent =
        `${formatBytes(result.size)} · ` +
        `${result.width} × ${result.height} · ` +
        `${result.format.toUpperCase()}`;

      const actions =
        document.createElement("div");

      actions.className =
        "result-actions";

      const compareBtn =
        document.createElement("button");

      compareBtn.type = "button";
      compareBtn.className =
        "btn btn-ghost btn-sm";

      compareBtn.dataset.action =
        "compare";

      compareBtn.dataset.resultIndex =
        index;

      compareBtn.textContent =
        "Compare";

      const downloadBtn =
        document.createElement("button");

      downloadBtn.type = "button";
      downloadBtn.className =
        "btn btn-primary btn-sm";

      downloadBtn.dataset.action =
        "download";

      downloadBtn.dataset.resultIndex =
        index;

      downloadBtn.textContent =
        "Download";

      actions.appendChild(compareBtn);
      actions.appendChild(downloadBtn);

      info.appendChild(name);
      info.appendChild(meta);
      info.appendChild(actions);

      card.appendChild(image);
      card.appendChild(info);

      els.resultsList.appendChild(card);
    });
  }

  function selectResult(result) {
    if (!result) return;

    state.selectedResult = result;

    if (!els.comparison) return;

    els.comparison.hidden = false;

    const originalURL =
      findOriginalPreviewURL(
        result.originalName
      );

    if (els.compareOriginalImg) {
      els.compareOriginalImg.src =
        originalURL || "";
    }

    if (els.compareOriginalFormat) {
      els.compareOriginalFormat.textContent =
        getDisplayFormat(
          result.originalFile
        );
    }

    if (els.compareOriginalSize) {
      els.compareOriginalSize.textContent =
        formatBytes(result.originalSize);
    }

    if (els.compareOriginalDims) {
      els.compareOriginalDims.textContent =
        `${result.originalWidth} × ${result.originalHeight}`;
    }

    if (els.compareConvertedImg) {
      els.compareConvertedImg.src =
        result.url;
    }

    if (els.compareConvertedFormat) {
      els.compareConvertedFormat.textContent =
        result.format.toUpperCase();
    }

    if (els.compareConvertedSize) {
      els.compareConvertedSize.textContent =
        formatBytes(result.size);
    }

    if (els.compareConvertedDims) {
      els.compareConvertedDims.textContent =
        `${result.width} × ${result.height}`;
    }

    if (els.savingsBadge) {
      els.savingsBadge.textContent =
        calculateSavingsText(
          result.originalSize,
          result.size
        );
    }
  }

  function findOriginalPreviewURL(name) {
    const file = state.files.find(
      (item) => item.name === name
    );

    return file?.previewURL || "";
  }

  function calculateSavingsText(
    originalSize,
    convertedSize
  ) {
    if (!originalSize || !convertedSize) {
      return "";
    }

    const difference =
      originalSize - convertedSize;

    const percent =
      Math.abs(difference) /
      originalSize *
      100;

    if (difference > 0) {
      return `${percent.toFixed(1)}% smaller`;
    }

    if (difference < 0) {
      return `${percent.toFixed(1)}% larger`;
    }

    return "Same size";
  }

  /* -------------------------------------------------------
     DOWNLOADS
  ------------------------------------------------------- */

  function downloadResult(result) {
    if (!result?.blob) return;

    downloadBlob(
      result.blob,
      result.outputName
    );
  }

  async function downloadAllAsZip() {
    if (!state.results.length) return;

    if (
      typeof window.JSZip === "undefined"
    ) {
      showError(
        "ZIP download library is not available. Please check your internet connection and reload the page."
      );
      return;
    }

    try {
      els.downloadAllBtn.disabled = true;

      const zip = new JSZip();

      const usedNames = new Set();

      state.results.forEach((result) => {
        let name = result.outputName;

        if (usedNames.has(name)) {
          const extension =
            getExtension(name);

          const base =
            name.slice(
              0,
              -(extension.length + 1)
            );

          let counter = 2;

          while (
            usedNames.has(
              `${base}-${counter}.${extension}`
            )
          ) {
            counter++;
          }

          name =
            `${base}-${counter}.${extension}`;
        }

        usedNames.add(name);

        zip.file(
          name,
          result.blob
        );
      });

      const blob =
        await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6
          }
        });

      downloadBlob(
        blob,
        `converted-images-${formatDateForFile(
          new Date()
        )}.zip`
      );
    } catch (error) {
      console.error(error);

      showError(
        "Could not create the ZIP file."
      );
    } finally {
      els.downloadAllBtn.disabled = false;
    }
  }

  function downloadBlob(blob, filename) {
    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = filename;

    link.style.display = "none";

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* -------------------------------------------------------
     ESTIMATED SIZE
  ------------------------------------------------------- */

  let estimateTimer = null;

  function updateEstimatedSize() {
    if (
      !state.files.length ||
      !els.estimatedValue
    ) {
      return;
    }

    clearTimeout(estimateTimer);

    const format = getSelectedFormat();
    const quality =
      Number(els.qualitySlider?.value || 85) /
      100;

    const target = getTargetSize();

    if (target) {
      const targetBytes =
        target === "custom"
          ? Number(
              els.customTargetSize?.value || 0
            ) * 1024
          : Number(target) * 1024;

      if (targetBytes > 0) {
        els.estimatedValue.textContent =
          `~${formatBytes(targetBytes)}`;

        return;
      }
    }

    /*
     * PNG is lossless and cannot be estimated reliably
     * from quality alone.
     */
    if (format === "png") {
      els.estimatedValue.textContent =
        "Calculated during conversion";

      return;
    }

    const totalOriginal =
      state.files.reduce(
        (sum, item) =>
          sum + item.size,
        0
      );

    let multiplier;

    switch (format) {
      case "jpeg":
        multiplier =
          0.35 + quality * 0.55;
        break;

      case "webp":
        multiplier =
          0.25 + quality * 0.50;
        break;

      case "avif":
        multiplier =
          0.18 + quality * 0.45;
        break;

      default:
        multiplier = 0.7;
    }

    let dimensionMultiplier = 1;

    if (
      state.activeDimensions.width &&
      state.activeDimensions.height
    ) {
      const originalPixels =
        state.files.reduce(
          (sum, item) =>
            sum +
            item.width *
              item.height,
          0
        );

      const targetPixels =
        state.files.length *
        state.activeDimensions.width *
        state.activeDimensions.height;

      if (originalPixels > 0) {
        dimensionMultiplier =
          targetPixels /
          originalPixels;
      }
    }

    const estimate =
      totalOriginal *
      multiplier *
      Math.max(
        0.02,
        Math.min(
          1,
          dimensionMultiplier
        )
      );

    estimateTimer = setTimeout(() => {
      els.estimatedValue.textContent =
        `~${formatBytes(estimate)}`;
    }, 100);
  }

  /* -------------------------------------------------------
     HISTORY
  ------------------------------------------------------- */

  function addHistoryEntry(result) {
    const entry = {
      originalName:
        result.originalName,

      outputName:
        result.outputName,

      format:
        result.format,

      originalSize:
        result.originalSize,

      outputSize:
        result.size,

      width:
        result.width,

      height:
        result.height,

      timestamp:
        Date.now()
    };

    state.history.unshift(entry);

    /*
     * Keep only recent entries.
     */
    state.history =
      state.history.slice(
        0,
        CONFIG.HISTORY_LIMIT
      );
  }

  function saveHistory() {
    try {
      localStorage.setItem(
        CONFIG.HISTORY_KEY,
        JSON.stringify(state.history)
      );
    } catch (error) {
      console.warn(
        "Could not save history:",
        error
      );
    }

    renderHistory();
  }

  function loadHistory() {
    try {
      const saved =
        localStorage.getItem(
          CONFIG.HISTORY_KEY
        );

      if (!saved) {
        state.history = [];
        return;
      }

      const parsed =
        JSON.parse(saved);

      state.history =
        Array.isArray(parsed)
          ? parsed.slice(
              0,
              CONFIG.HISTORY_LIMIT
            )
          : [];
    } catch (error) {
      state.history = [];
    }

    renderHistory();
  }

  function renderHistory() {
    if (
      !els.historySection ||
      !els.historyList
    ) {
      return;
    }

    if (!state.history.length) {
      els.historySection.hidden = true;
      els.historyList.innerHTML = "";
      return;
    }

    els.historySection.hidden = false;
    els.historyList.innerHTML = "";

    state.history.forEach((entry) => {
      const item =
        document.createElement("div");

      item.className =
        "history-item";

      item.setAttribute(
        "role",
        "listitem"
      );

      const info =
        document.createElement("div");

      info.className =
        "history-info";

      const name =
        document.createElement("div");

      name.className =
        "history-name";

      name.textContent =
        entry.originalName;

      const meta =
        document.createElement("div");

      meta.className =
        "history-meta";

      meta.textContent =
        `${entry.format.toUpperCase()} · ` +
        `${formatBytes(entry.outputSize)} · ` +
        `${entry.width} × ${entry.height}`;

      const date =
        document.createElement("div");

      date.className =
        "history-date";

      date.textContent =
        formatHistoryDate(
          entry.timestamp
        );

      info.appendChild(name);
      info.appendChild(meta);
      info.appendChild(date);

      item.appendChild(info);

      els.historyList.appendChild(item);
    });
  }

  function clearHistory() {
    state.history = [];

    try {
      localStorage.removeItem(
        CONFIG.HISTORY_KEY
      );
    } catch (error) {
      console.warn(error);
    }

    renderHistory();
  }

  /* -------------------------------------------------------
     RESULTS / RESET
  ------------------------------------------------------- */

  function clearResults() {
    state.results.forEach((result) => {
      if (result.url) {
        URL.revokeObjectURL(result.url);
      }
    });

    state.results = [];
    state.selectedResult = null;

    if (els.resultsSection) {
      els.resultsSection.hidden = true;
    }

    if (els.comparison) {
      els.comparison.hidden = true;
    }

    if (els.resultsList) {
      els.resultsList.innerHTML = "";
    }

    if (els.downloadSingleBtn) {
      els.downloadSingleBtn.hidden = true;
    }

    if (els.downloadAllBtn) {
      els.downloadAllBtn.hidden = true;
    }
  }

  function resetConverterState() {
    clearResults();

    state.busy = false;

    hideProgress();

    if (els.settingsPanel) {
      els.settingsPanel.hidden = true;
    }

    if (els.estimatedSize) {
      els.estimatedSize.hidden = true;
    }

    if (els.estimatedValue) {
      els.estimatedValue.textContent =
        "—";
    }
  }

  /* -------------------------------------------------------
     PROGRESS
  ------------------------------------------------------- */

  function showProgress(
    percent,
    label,
    sub
  ) {
    if (!els.progressSection) return;

    els.progressSection.hidden = false;

    updateProgress(
      percent,
      label,
      sub
    );
  }

  function updateProgress(
    percent,
    label,
    sub
  ) {
    if (!els.progressSection) return;

    const value = clamp(
      Math.round(percent),
      0,
      100
    );

    els.progressLabel.textContent =
      label || "";

    els.progressSub.textContent =
      sub || "";

    els.progressBar.style.width =
      `${value}%`;

    els.progressBar.setAttribute(
      "aria-valuenow",
      String(value)
    );
  }

  function hideProgress() {
    if (els.progressSection) {
      els.progressSection.hidden = true;
    }
  }

  /* -------------------------------------------------------
     ERROR HANDLING
  ------------------------------------------------------- */

  let errorTimer = null;

  function showError(message) {
    if (!els.errorBanner) {
      console.error(message);
      return;
    }

    els.errorMessage.textContent =
      message;

    els.errorBanner.hidden = false;

    clearTimeout(errorTimer);

    errorTimer = setTimeout(() => {
      hideError();
    }, 8000);
  }

  function hideError() {
    if (els.errorBanner) {
      els.errorBanner.hidden = true;
    }
  }

  /* -------------------------------------------------------
     MOBILE NAVIGATION
  ------------------------------------------------------- */

  function toggleMobileMenu() {
    if (!els.mobileMenu) return;

    const isOpen =
      els.mobileMenu.hidden;

    els.mobileMenu.hidden = !isOpen;

    els.navHamburger?.setAttribute(
      "aria-expanded",
      String(isOpen)
    );
  }

  function closeMobileMenu() {
    if (!els.mobileMenu) return;

    els.mobileMenu.hidden = true;

    els.navHamburger?.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  /* -------------------------------------------------------
     PWA / SERVICE WORKER
  ------------------------------------------------------- */

  function registerServiceWorker() {
    if (
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    /*
     * Service workers don't work from file://.
     */
    if (
      location.protocol !== "http:" &&
      location.protocol !== "https:"
    ) {
      return;
    }

    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker
          .register("./sw.js")
          .then((registration) => {
            console.log(
              "Service Worker registered:",
              registration.scope
            );
          })
          .catch((error) => {
            console.warn(
              "Service Worker registration failed:",
              error
            );
          });
      }
    );
  }

  /* -------------------------------------------------------
     FORMAT / TARGET HELPERS
  ------------------------------------------------------- */

  function getSelectedFormat() {
    const selected = $(
      'input[name="format"]:checked'
    );

    return selected?.value || "webp";
  }

  function getTargetSize() {
    const selected = $(
      'input[name="target-size"]:checked'
    );

    return selected?.value || null;
  }

  function getDisplayFormat(file) {
    if (!file) return "";

    const extension =
      getExtension(file.name);

    if (
      extension === "jpg" ||
      extension === "jpeg"
    ) {
      return "JPEG";
    }

    return extension.toUpperCase();
  }

  /* -------------------------------------------------------
     BROWSER SUPPORT
  ------------------------------------------------------- */

  function supportsMime(mime) {
    const canvas =
      document.createElement("canvas");

    try {
      return canvas
        .toDataURL(mime)
        .startsWith(
          `data:${mime}`
        );
    } catch {
      return false;
    }
  }

  /* -------------------------------------------------------
     IMAGE LOADING
  ------------------------------------------------------- */

  function loadImage(src) {
    return new Promise(
      (resolve, reject) => {
        const img =
          new Image();

        img.onload = () => {
          resolve(img);
        };

        img.onerror = () => {
          reject(
            new Error(
              "Image could not be loaded."
            )
          );
        };

        /*
         * Needed for some browser contexts.
         */
        img.decoding = "async";

        img.src = src;
      }
    );
  }

  /* -------------------------------------------------------
     DIMENSION HELPERS
  ------------------------------------------------------- */

  function fitInside(
    sourceWidth,
    sourceHeight,
    maxWidth,
    maxHeight
  ) {
    const ratio = Math.min(
      maxWidth / sourceWidth,
      maxHeight / sourceHeight,
      1
    );

    return {
      width: Math.max(
        1,
        Math.round(
          sourceWidth * ratio
        )
      ),

      height: Math.max(
        1,
        Math.round(
          sourceHeight * ratio
        )
      )
    };
  }

  /* -------------------------------------------------------
     FILENAME HELPERS
  ------------------------------------------------------- */

  function makeOutputName(
    originalName,
    extension
  ) {
    const lastDot =
      originalName.lastIndexOf(".");

    const base =
      lastDot > 0
        ? originalName.slice(
            0,
            lastDot
          )
        : originalName;

    return `${base}.${extension}`;
  }

  function getExtension(filename) {
    const parts =
      filename
        .toLowerCase()
        .split(".");

    return (
      parts.length > 1
        ? parts.pop()
        : ""
    );
  }

  function getExtensionFromMime(mime) {
    switch (mime) {
      case "image/png":
        return "png";

      case "image/jpeg":
        return "jpg";

      case "image/webp":
        return "webp";

      case "image/avif":
        return "avif";

      case "image/gif":
        return "gif";

      case "image/bmp":
        return "bmp";

      default:
        return "png";
    }
  }

  /* -------------------------------------------------------
     FORMATTING HELPERS
  ------------------------------------------------------- */

  function formatBytes(bytes) {
    if (
      !Number.isFinite(bytes) ||
      bytes < 0
    ) {
      return "0 B";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const units = [
      "KB",
      "MB",
      "GB"
    ];

    let value =
      bytes / 1024;

    let unitIndex = 0;

    while (
      value >= 1024 &&
      unitIndex <
        units.length - 1
    ) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(
      value >= 10 ? 1 : 2
    )} ${units[unitIndex]}`;
  }

  function formatHistoryDate(timestamp) {
    if (!timestamp) return "";

    const date =
      new Date(timestamp);

    return date.toLocaleString(
      undefined,
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );
  }

  function formatDateForFile(date) {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    const hours =
      String(
        date.getHours()
      ).padStart(2, "0");

    const minutes =
      String(
        date.getMinutes()
      ).padStart(2, "0");

    return `${year}-${month}-${day}-${hours}${minutes}`;
  }

  /* -------------------------------------------------------
     GENERIC HELPERS
  ------------------------------------------------------- */

  function clamp(
    value,
    min,
    max
  ) {
    return Math.min(
      Math.max(value, min),
      max
    );
  }

  function nextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(
        () => resolve()
      );
    });
  }

  /* -------------------------------------------------------
     START
  ------------------------------------------------------- */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
