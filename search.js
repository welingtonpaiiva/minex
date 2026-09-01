const fs = require('fs'); 
const lines = fs.readFileSync('index.html', 'utf8').split('\n'); 
lines.forEach((l, i) => { 
    if (l.toLowerCase().includes('matricula') || l.toLowerCase().includes('matrícula') || l.toLowerCase().includes('usuarios') || l.toLowerCase().includes('<th>')) {
        console.log(`${i+1}: ${l.trim().substring(0, 100)}`); 
    }
});
