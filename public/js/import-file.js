(function () {
  // Reads a chosen file as text into a hidden textarea before the form is
  // submitted, so the server can receive its contents as a normal text
  // field rather than needing multipart/file-upload parsing middleware.
  const wirings = [
    { fileInputId: 'import-file-input', textareaId: 'import-json-data', submitId: 'import-submit' },
    { fileInputId: 'csv-import-file-input', textareaId: 'csv-import-data', submitId: 'csv-import-submit' },
  ];

  wirings.forEach(({ fileInputId, textareaId, submitId }) => {
    const fileInput = document.getElementById(fileInputId);
    const textarea = document.getElementById(textareaId);
    const submitBtn = document.getElementById(submitId);
    if (!fileInput || !textarea || !submitBtn) return;

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) {
        submitBtn.disabled = true;
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        textarea.value = reader.result;
        submitBtn.disabled = false;
      };
      reader.readAsText(file);
    });

    // A large import can take a while — disable immediately on submit so a
    // double-click (or an impatient extra click) can't fire two overlapping
    // imports against the same database.
    submitBtn.closest('form').addEventListener('submit', () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Importing…';
    });
  });
})();
