"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PhotoStorage_1 = require("../services/PhotoStorage");
const db_1 = require("../config/db");
if (require.main === module) {
    (0, PhotoStorage_1.importPhotoFiles)().then(count => console.log(count + ' foto(s) importada(s) e conferida(s).'))
        .catch(error => { console.error(error.message); process.exitCode = 1; })
        .finally(db_1.closeDatabase);
}
