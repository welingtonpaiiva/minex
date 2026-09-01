const fs = require('fs'); 
const lines = fs.readFileSync('index.html', 'utf8').split('\n'); 
lines.forEach((l, i) => { 
    if (l.includes('body-dashboard')) {
        console.log(`FOUND AT LINE ${i+1}`);
    }
});
