/**
 * Calculates the next servo angle to follow the first detected person.
 * 
 * @param {string} deviceId ID of the device (MAC address or similar)
 * @param {number} currentAngle Current servo angle (0 - 180)
 * @param {Array} boxCoordinates Array of detected box coordinates (from AI)
 * @param {number} defaultAngle Fallback/default angle
 * @returns {object|null} { newAngle, offset } or null if no adjustment needed or no person detected
 */
function calculateNextFollowerAngle(deviceId, currentAngle, boxCoordinates, defaultAngle = 90) {
  if (!boxCoordinates || boxCoordinates.length === 0) {
    return null;
  }

  let leftmostCenterX = Infinity;
  let rightmostCenterX = -Infinity;
  let validPersonFound = false;

  boxCoordinates.forEach(box => {
    if (box && box.posisi) {
      const [x1, y1, x2, y2] = box.posisi;
      const personCenterX = (x1 + x2) / 2;
      validPersonFound = true;
      if (personCenterX < leftmostCenterX) {
        leftmostCenterX = personCenterX;
      }
      if (personCenterX > rightmostCenterX) {
        rightmostCenterX = personCenterX;
      }
    }
  });

  if (!validPersonFound) {
    return null;
  }

  // Calculate the average center of the leftmost and rightmost detected person
  const averageCenterX = (leftmostCenterX + rightmostCenterX) / 2;
  const offset = averageCenterX - 0.5; // range: -0.5 to 0.5

  // Only adjust if the offset is significant (deadband 0.10 for active centering)
  if (Math.abs(offset) > 0.10) {
    const angleValue = currentAngle !== undefined ? currentAngle : defaultAngle;

    // Constant for Proportional (P) Controller
    const Kp = 45;

    // Map offset to angle adjustment. Left pan increases angle, Right pan decreases angle.
    const deltaAngle = offset * Kp;
    let newAngle = Math.round(angleValue + deltaAngle);
    newAngle = Math.max(0, Math.min(180, newAngle));

    if (newAngle !== angleValue) {
      return { newAngle, offset };
    }
  }

  return null;
}

module.exports = {
  calculateNextFollowerAngle
};
