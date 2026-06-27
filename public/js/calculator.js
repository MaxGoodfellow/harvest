(function () {
  const form = document.getElementById('calculator-form');
  if (!form) return;
  const creatureSelect = document.getElementById('creatureId');
  const targetSelect = document.getElementById('target');

  if (creatureSelect) creatureSelect.addEventListener('change', () => form.submit());
  if (targetSelect) targetSelect.addEventListener('change', () => form.submit());

  const rollDie = document.getElementById('rollDie');
  const skillBonus = document.getElementById('skillBonus');
  const preview = document.getElementById('roll-total-preview');

  function refreshRollTotal() {
    if (!rollDie || !preview) return;
    if (rollDie.value === '') {
      preview.textContent = '';
      return;
    }
    const die = Number(rollDie.value) || 0;
    const bonus = skillBonus && skillBonus.value !== '' ? Number(skillBonus.value) : 0;
    preview.textContent = `Roll total: ${die + bonus}`;
  }

  if (rollDie) rollDie.addEventListener('input', refreshRollTotal);
  if (skillBonus) skillBonus.addEventListener('input', refreshRollTotal);
  refreshRollTotal();
})();
