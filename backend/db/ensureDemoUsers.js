
import bcrypt from 'bcryptjs';
import { db } from './database.js';

const demoUsers = [
  { username: 'viewer', password: 'viewer123', fullName: 'Victoria Viewer', role: 'viewer' },
  { username: 'reporter', password: 'reporter123', fullName: 'Riley Reporter', role: 'reporter' },
  { username: 'tech', password: 'tech123', fullName: 'Taylor Technician', role: 'technician' },
  { username: 'admin', password: 'admin123', fullName: 'Alex Admin', role: 'admin' }
];

for (const user of demoUsers) {
  const existing = db.get(
    'SELECT id FROM users WHERE username = ?',
    [user.username]
  );

  if (!existing) {
    const hash = bcrypt.hashSync(user.password, 10);

    db.run(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [user.username, hash, user.fullName, user.role]
    );

    console.log(`Created missing demo user: ${user.username}`);
  } else {
    console.log(`Demo user already exists: ${user.username}`);
  }
}

db.close();
console.log('Demo-user check complete.');
