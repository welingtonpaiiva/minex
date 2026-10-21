const {EmprestimoService}=require('../dist/services/EmprestimoService');
const {closeDatabase}=require('../dist/config/db');
EmprestimoService.realizarSaida(JSON.parse(process.argv[2])).then(()=>console.log(JSON.stringify({ok:true}))).catch(error=>console.log(JSON.stringify({ok:false,error:error.message}))).finally(closeDatabase);
