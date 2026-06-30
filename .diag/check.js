function deepAssign(target, src) {
  for (const key in src) {
    if (typeof src[key] === 'object' && src[key] !== null) {
      target[key] = target[key] || {};
      deepAssign(target[key], src[key]);
    } else {
      target[key] = src[key];
    }
  }
  return target;
}
try { module.exports = { deepAssign }; } catch (e) {}
