const { execSync } = require('child_process');

const msg = process.argv[2] || 'update: auto deploy';

function run(cmd) {
  console.log(`👉 ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  run('git add .');
  run(`git commit -m "${msg}"`);
  run('git push');

  console.log('🚀 推送完成，Railway 會自動部署');
} catch (err) {
  console.log('❌ deploy failed');
  console.error(err.message);
}