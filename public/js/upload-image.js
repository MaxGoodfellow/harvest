(function () {
  // Same approach as import-file.js: read the chosen file client-side and
  // post its contents as a normal text field, avoiding any need for
  // multipart/form-data parsing on the server.
  const fileInput = document.getElementById('bg-upload-file-input');
  const dataField = document.getElementById('bg-upload-data');
  const submitBtn = document.getElementById('bg-upload-submit');
  const form = document.getElementById('bg-upload-form');
  if (!fileInput || !dataField || !submitBtn || !form) return;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) {
      submitBtn.disabled = true;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      dataField.value = reader.result;
      submitBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener('submit', () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';
  });
})();
