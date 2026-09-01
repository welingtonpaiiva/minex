const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('minex.db');
db.serialize(() => {
    db.each("PRAGMA table_info(usuarios)", (err, row) => {
        console.log(row.name);
    });
});
