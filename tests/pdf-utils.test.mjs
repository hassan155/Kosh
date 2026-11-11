import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, degrees } from 'pdf-lib'
import { applyPdfPageEdits, inspectPdf, mergePdfFiles, selectPdfPages } from '../src/lib/pdf-utils.ts'
async function samplePdf(label,pages=2){const pdf=await PDFDocument.create();for(let i=0;i<pages;i+=1)pdf.addPage([300,240]).drawText(`${label} page ${i+1}`);return new Blob([new Uint8Array(await pdf.save())],{type:'application/pdf'})}
test('inspects PDF page count and local text',async()=>{const info=await inspectPdf(await samplePdf('local meeting'));assert.equal(info.pageCount,2);assert.match(info.searchableText,/local meeting page 1/)})
test('selects and merges PDF pages',async()=>{assert.equal((await inspectPdf(await selectPdfPages(await samplePdf('range'),{start:2,end:2}))).pageCount,1);const merged=await mergePdfFiles([await samplePdf('first',1),await samplePdf('second',2)]);assert.equal((await inspectPdf(merged)).pageCount,3);assert.match((await inspectPdf(merged)).searchableText,/second page 2/)})
test('applies rotation and deletion without changing original',async()=>{const original=await samplePdf('edit',3);const edited=await applyPdfPageEdits(original,[{pageIndex:0,rotation:90},{pageIndex:1,remove:true}]);const document=await PDFDocument.load(await edited.arrayBuffer());assert.equal(document.getPageCount(),2);assert.equal(document.getPage(0).getRotation().angle,degrees(90).angle);assert.equal((await inspectPdf(original)).pageCount,3)})
