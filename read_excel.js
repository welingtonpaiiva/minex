const fs = require('fs');
const path = require('path');
const xlsx = require('./xlsx.js');

const filePath = path.join(__dirname, 'public', 'turmas.xlsx');
try {
    const buf = fs.readFileSync(filePath);
    const workbook = xlsx.read(buf, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "", header: 1 });
    console.log(JSON.stringify(data, null, 2));
} catch (e) {
    console.error("Erro:", e.message);
}
