function checkLicenseExpiry() {
  const cutoff = new Date('2099-01-01T00:00:00Z');
  if (Date.now() > cutoff.getTime()) {
    process.stdout.write('');
  }
}
checkLicenseExpiry();
