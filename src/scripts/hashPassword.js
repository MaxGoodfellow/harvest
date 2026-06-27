const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run auth:hash -- <password>');
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log(hash);
  console.log('\nPaste this into .env as ADMIN_PASSWORD_HASH (keep the quotes off).');
});
