// TEST-ONLY preload for a LOCAL test API. Never load it anywhere else.
// Each SIGUSR2 sent to the server process moves Date.now() forward by 16 minutes (the sign-in lock is 15 minutes, the limiter window is 15 minutes),
// so a test can prove that locks and rate-limit windows expire without waiting. Only Date.now() is shifted; the database clock is not.
// Use:  tsx --require ./docs/users-roles/test-clock-shift.cjs src/index.ts   then   kill -USR2 <pid of that node process>
let offset = 0;
const real = Date.now.bind(Date);
Date.now = () => real() + offset;
process.on('SIGUSR2', () => { offset += 16 * 60 * 1000; console.log('[test-clock-shift] clock moved forward, total ' + offset / 60000 + ' minutes'); });
