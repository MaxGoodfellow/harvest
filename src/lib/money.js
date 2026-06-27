// Money/time formatting helpers. Pure, no DB/I/O. All money is stored as
// integer copper pieces (cp); 1 gp = 100 cp, 1 sp = 10 cp.

function toCp({ gp = 0, sp = 0, cp = 0 } = {}) {
  return gp * 100 + sp * 10 + cp;
}

function fromCp(totalCp) {
  const sign = totalCp < 0 ? -1 : 1;
  let remaining = Math.abs(Math.round(totalCp));
  const gp = Math.floor(remaining / 100);
  remaining -= gp * 100;
  const sp = Math.floor(remaining / 10);
  remaining -= sp * 10;
  const cp = remaining;
  return { gp: gp * sign, sp: sp * sign, cp: cp * sign };
}

function formatCp(totalCp) {
  const { gp, sp, cp } = fromCp(totalCp);
  const parts = [];
  if (gp) parts.push(`${gp} gp`);
  if (sp) parts.push(`${sp} sp`);
  if (cp || parts.length === 0) parts.push(`${cp} cp`);
  return parts.join(' ');
}

function unitFor(totalMinutes) {
  if (totalMinutes < 60) return { value: totalMinutes, unit: 'minute' };
  if (totalMinutes < 1440) return { value: totalMinutes / 60, unit: 'hour' };
  return { value: totalMinutes / 1440, unit: 'day' };
}

function formatMinutes(totalMinutes) {
  const { value, unit } = unitFor(totalMinutes);
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

function formatMinutesRange(min, max) {
  if (min === max) return formatMinutes(min);
  const a = unitFor(min);
  const b = unitFor(max);
  if (a.unit === b.unit) {
    return `${a.value}–${b.value} ${b.unit}${b.value === 1 ? '' : 's'}`;
  }
  return `${formatMinutes(min)}–${formatMinutes(max)}`;
}

module.exports = { toCp, fromCp, formatCp, formatMinutes, formatMinutesRange };
