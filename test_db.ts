import Database from 'better-sqlite3';
const db = new Database('swifttype.db');
const user = db.prepare("SELECT * FROM users WHERE username = 'wasmer'").get();
console.log(user);
