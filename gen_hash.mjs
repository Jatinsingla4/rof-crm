import bcryptjs from 'bcryptjs';

const password = 'password123';
const hash = await bcryptjs.hash(password, 12);
console.log('Hash:', hash);

const isValid = await bcryptjs.compare(password, hash);
console.log('Valid:', isValid);
