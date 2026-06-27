(function () {
  document.querySelectorAll('.session-assign-select').forEach(function (select) {
    select.addEventListener('change', function () {
      select.closest('form').submit();
    });
  });
})();
