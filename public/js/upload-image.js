(function () {
  // A small drag-to-pan + zoom crop tool: reads the chosen file client-side
  // (FileReader, same no-multipart-needed approach as import-file.js), lets
  // the GM frame it within a 16:9 viewport, then bakes the framed view down
  // to a fixed-resolution JPEG via <canvas> and posts that as a normal text
  // field — the server never sees the original, only the exported crop.
  const TARGET_WIDTH = 1920;
  const TARGET_HEIGHT = 1080;

  const fileInput = document.getElementById('bg-upload-file-input');
  const dataField = document.getElementById('bg-upload-data');
  const submitBtn = document.getElementById('bg-upload-submit');
  const form = document.getElementById('bg-upload-form');
  const cropTool = document.getElementById('crop-tool');
  const viewport = document.getElementById('crop-viewport');
  const imageEl = document.getElementById('crop-image');
  const zoomSlider = document.getElementById('crop-zoom');

  if (!fileInput || !dataField || !submitBtn || !form || !cropTool || !viewport || !imageEl || !zoomSlider) {
    return;
  }

  let naturalWidth = 0;
  let naturalHeight = 0;
  let coverScale = 1; // the scale at which the image just covers the viewport with no gaps
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;

  function viewportSize() {
    const rect = viewport.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  function clampTranslate() {
    const { width: vw, height: vh } = viewportSize();
    const scaledW = naturalWidth * scale;
    const scaledH = naturalHeight * scale;
    translateX = Math.min(0, Math.max(vw - scaledW, translateX));
    translateY = Math.min(0, Math.max(vh - scaledH, translateY));
  }

  function applyTransform() {
    imageEl.style.width = `${naturalWidth * scale}px`;
    imageEl.style.height = `${naturalHeight * scale}px`;
    imageEl.style.transform = `translate(${translateX}px, ${translateY}px)`;
  }

  function resetForImage() {
    const { width: vw, height: vh } = viewportSize();
    coverScale = Math.max(vw / naturalWidth, vh / naturalHeight);
    scale = coverScale;
    translateX = (vw - naturalWidth * scale) / 2;
    translateY = (vh - naturalHeight * scale) / 2;
    zoomSlider.value = 100;
    clampTranslate();
    applyTransform();
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) {
      cropTool.hidden = true;
      submitBtn.disabled = true;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      imageEl.onload = () => {
        naturalWidth = imageEl.naturalWidth;
        naturalHeight = imageEl.naturalHeight;
        cropTool.hidden = false;
        resetForImage();
        submitBtn.disabled = false;
      };
      imageEl.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  zoomSlider.addEventListener('input', () => {
    const { width: vw, height: vh } = viewportSize();
    const zoomFactor = Number(zoomSlider.value) / 100;
    // Zoom around the viewport's center rather than the image's top-left,
    // so the same spot stays under the middle of the frame as you zoom.
    const centerX = vw / 2;
    const centerY = vh / 2;
    const imgCenterXBefore = (centerX - translateX) / scale;
    const imgCenterYBefore = (centerY - translateY) / scale;
    scale = coverScale * zoomFactor;
    translateX = centerX - imgCenterXBefore * scale;
    translateY = centerY - imgCenterYBefore * scale;
    clampTranslate();
    applyTransform();
  });

  function startDrag(clientX, clientY) {
    dragging = true;
    dragStartX = clientX;
    dragStartY = clientY;
    dragOriginX = translateX;
    dragOriginY = translateY;
    viewport.classList.add('dragging');
  }

  function moveDrag(clientX, clientY) {
    if (!dragging) return;
    translateX = dragOriginX + (clientX - dragStartX);
    translateY = dragOriginY + (clientY - dragStartY);
    clampTranslate();
    applyTransform();
  }

  function endDrag() {
    dragging = false;
    viewport.classList.remove('dragging');
  }

  viewport.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);

  viewport.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (t) startDrag(t.clientX, t.clientY);
    },
    { passive: true }
  );
  viewport.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (t) moveDrag(t.clientX, t.clientY);
    },
    { passive: true }
  );
  viewport.addEventListener('touchend', endDrag);

  function exportCroppedImage() {
    const { width: vw } = viewportSize();
    const exportScale = TARGET_WIDTH / vw;
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      imageEl,
      0,
      0,
      naturalWidth,
      naturalHeight,
      translateX * exportScale,
      translateY * exportScale,
      naturalWidth * scale * exportScale,
      naturalHeight * scale * exportScale
    );
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  form.addEventListener('submit', () => {
    if (!cropTool.hidden && naturalWidth > 0) {
      dataField.value = exportCroppedImage();
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';
  });
})();
