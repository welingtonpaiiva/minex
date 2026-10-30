const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const canvas=require('@napi-rs/canvas');
const zxing=require('@zxing/library');
async function decodeLabelPdf(bytes,{dpi=203,firstPageOnly=false,firstPageImage}={}){
 Object.assign(global,{DOMMatrix:canvas.DOMMatrix,ImageData:canvas.ImageData,Path2D:canvas.Path2D});
 const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}),document=await task.promise,items=[];
 for(let number=1;number<=document.numPages;number++){
  if(firstPageOnly&&number>1)break;
  const page=await document.getPage(number),scale=dpi/72,base=page.getViewport({scale:1}),viewport=page.getViewport({scale});
  const target=canvas.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=target.getContext('2d');
  await page.render({canvas:target,canvasContext:context,viewport}).promise;
  if(number===1&&firstPageImage)fs.writeFileSync(firstPageImage,target.toBuffer('image/png'));
  const marks=(await page.getTextContent()).items.filter(item=>/^TAG: /.test(item.str));
  for(const mark of marks){
   const center=mark.transform[4]+mark.width/2,tag=mark.str.match(/^TAG: (\S+)/)[1];
   const neighbors=marks.map(item=>Math.abs(item.transform[4]+item.width/2-center)).filter(delta=>delta>10);
   const cropWidth=Math.min(530,neighbors.length?Math.min(...neighbors)-5:530,center*2-4,(base.width-center)*2-4);
   const left=Math.max(0,Math.floor((center-cropWidth/2)*scale)),top=Math.floor((base.height-mark.transform[5]+2)*scale);
   const width=Math.min(Math.floor(cropWidth*scale),target.width-left),height=Math.min(Math.floor(78*scale),target.height-top);
   const pixels=context.getImageData(left,top,width,height).data,gray=new Uint8ClampedArray(width*height);
   for(let index=0;index<gray.length;index++)gray[index]=(pixels[index*4]+2*pixels[index*4+1]+pixels[index*4+2])/4;
   const hints=new Map([[zxing.DecodeHintType.POSSIBLE_FORMATS,[zxing.BarcodeFormat.CODE_128]],[zxing.DecodeHintType.TRY_HARDER,true]]);
   try{const result=new zxing.MultiFormatReader().decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(gray,width,height))),hints);items.push({pagina:number,tag,codigo:result.getText()});}
   catch(error){throw new Error('Falha de leitura: '+tag+', página '+number+', '+dpi+' dpi. '+error.message);}
  }
  page.cleanup?.();target.width=1;target.height=1;
 }
 const paginas=document.numPages;await task.destroy?.();return {paginas,dpi,items};
}
module.exports={decodeLabelPdf};
