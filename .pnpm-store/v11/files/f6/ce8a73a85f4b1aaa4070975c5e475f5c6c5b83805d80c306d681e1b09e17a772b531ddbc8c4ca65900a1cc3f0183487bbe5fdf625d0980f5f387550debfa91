/**
 * Gives you a array with filled with 0...amount - 1.
 * @param {number} amount
 * @returns {number[]}
 */
function range(amount) {
  const range = Array(amount);
  for (let i = 0; i < amount; i++) {
    range[i] = i;
  }

  return range;
}

/**
 * Check if the amount of edits between firstString and secondString is <= maxEdits.
 * It uses the Levenshtein distance algorithm with the two matrix rows variant.
 * @param {string} firstString First string to be checked against the other string
 * @param {string} secondString Second string to be checked against the other string
 * @param {number} maxEdit The maximum amount of edits that these 2 string should have.
 * @returns {boolean} indicate if the 2 strings's edits are less or equal to maxEdits
 */
function LevenshteinDistanceWithMax(firstString, secondString, maxEdit) {
  const lenOne = firstString.length;
  const lenTwo = secondString.length;

  const lenDiff = Math.abs(lenOne - lenTwo);
  // Are the difference between 2 lengths greater than
  // maxEdit, we know to bail out early on.
  if (lenDiff > maxEdit) {
    return false;
  }

  let prevRowDistance = range(lenOne + 1);
  let currentRowDistance = Array(lenOne + 1);
  for (let i = 1; i <= lenTwo; i++) {
    // Calculate the current row distances from the previous row.
    currentRowDistance[0] = i;
    let minDistance = i;
    for (let j = 1; j <= lenOne; j++) {
      const editCost = firstString[j - 1] === secondString[i - 1] ? 0 : 1;

      const addCost = prevRowDistance[j] + 1;
      const delCost = currentRowDistance[j - 1] + 1;
      const substitionCost = prevRowDistance[j - 1] + editCost;

      currentRowDistance[j] = Math.min(addCost, delCost, substitionCost);
      if (currentRowDistance[j] < minDistance) {
        minDistance = currentRowDistance[j];
      }
    }

    if (minDistance > maxEdit) {
      return false;
    }

    // Swap the vectors
    const vtemp = currentRowDistance;
    currentRowDistance = prevRowDistance;
    prevRowDistance = vtemp;
  }

  return prevRowDistance[lenOne] <= maxEdit;
}

module.exports = {
  LevenshteinDistanceWithMax
};
