(function () {
  const basePath = document.querySelector('meta[name="base-path"]').content;
  const levelInput = document.getElementById('level');
  const useManualValue = document.getElementById('use_manual_value');
  const preview = document.getElementById('autofill-preview');

  if (!levelInput || !preview) return;

  async function refresh() {
    const level = levelInput.value;
    if (level === '') {
      preview.textContent = '';
      return;
    }
    try {
      const res = await fetch(`${basePath}/monsters/api/autofill?level=${encodeURIComponent(level)}`);
      if (!res.ok) return;
      const data = await res.json();
      const manualNote = useManualValue && useManualValue.checked ? ' (manual value will be used instead)' : '';
      preview.textContent = `Auto-fill preview — Base DC: ${data.baseDc}, Total Harvest Value: ${data.totalHarvestValueCp} cp${manualNote}`;
    } catch (err) {
      // Best-effort preview only; ignore network errors.
    }
  }

  levelInput.addEventListener('input', refresh);
  if (useManualValue) useManualValue.addEventListener('change', refresh);
  refresh();
})();
