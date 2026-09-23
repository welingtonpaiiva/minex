const path = require('path');
const sqlite3 = require('sqlite3');
const dbPath = path.resolve(__dirname, '../minex.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Connected to:', dbPath);
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      console.log('Tables:', rows);
      db.close();
    });
  }
});
