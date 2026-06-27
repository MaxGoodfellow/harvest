// PF2e degree-of-success helper. Pure, no DB/I/O.
const DEGREES = ['critical_failure', 'failure', 'success', 'critical_success'];

function baseDegree(total, dc) {
  if (total >= dc + 10) return 'critical_success';
  if (total >= dc) return 'success';
  if (total <= dc - 10) return 'critical_failure';
  return 'failure';
}

function shiftDegree(degree, steps) {
  const idx = DEGREES.indexOf(degree);
  const clampedIdx = Math.max(0, Math.min(DEGREES.length - 1, idx + steps));
  return DEGREES[clampedIdx];
}

// PF2e: a natural 20 shifts the degree of success up one step, a natural 1
// shifts it down one step, applied after the threshold comparison and
// clamped at critical success / critical failure.
function degreeOfSuccess(total, dc, naturalDie) {
  const degree = baseDegree(total, dc);
  let finalDegree = degree;
  if (naturalDie === 20) {
    finalDegree = shiftDegree(degree, 1);
  } else if (naturalDie === 1) {
    finalDegree = shiftDegree(degree, -1);
  }
  return { degree: finalDegree, shifted: finalDegree !== degree };
}

module.exports = { degreeOfSuccess, DEGREES };
