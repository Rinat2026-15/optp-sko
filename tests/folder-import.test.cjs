const test=require('node:test'),assert=require('node:assert/strict');
const {analyze,floorNumber}=require('../folder-import.js');
const f=(path,size=120)=>({webkitRelativePath:path,name:path.split('/').pop(),size,type:'application/octet-stream'});
test('один объект: Word и планы двух этажей',()=>{
 const r=analyze([f('СПЧ-1/Театр/ОПТП.docx'),f('СПЧ-1/Театр/Поэтажные планы/Этаж 1.jpg'),f('СПЧ-1/Театр/Поэтажные планы/Этаж 2.pdf')]);
 assert.equal(r.objects.length,1);assert.equal(r.objects[0].documents,1);assert.equal(r.objects[0].floors,2);assert.equal(r.entries[2].floorNumber,2);
});
test('несколько объектов разделяются по каталогам',()=>{
 const r=analyze([f('СПЧ-1/Театр/План.docx'),f('СПЧ-1/Школа/ОПТП.doc')]);
 assert.equal(r.objects.length,2);assert.equal(r.entries[1].objectName,'Школа');
});
test('обычный PDF без признаков этажа — документ',()=>assert.equal(analyze([f('СПЧ-1/Театр/ОПТП.pdf')]).entries[0].kind,'doc'));
test('поэтажный PDF внутри папки — план',()=>assert.equal(analyze([f('СПЧ-1/Театр/Схемы/01.pdf')]).entries[0].kind,'floor'));
test('неопознанные изображения пропускаются',()=>assert.equal(analyze([f('СПЧ-1/Театр/фасад.jpg')]).entries.length,0));
test('повторы одного документа в одном объекте пропускаются',()=>{
 const r=analyze([f('СПЧ-1/Театр/ОПТП.docx'),f('СПЧ-1/Театр/Документы/ОПТП.docx')]);assert.equal(r.entries.length,1);assert.equal(r.skipped.length,1);
});
test('нет названия объекта — не загружаем файл',()=>assert.equal(analyze([f('СПЧ-1/ОПТП.docx')]).entries.length,0));
test('превышение 20 МБ отклоняется',()=>assert.equal(analyze([f('СПЧ-1/Школа/план.docx',21*1024*1024)]).errors.length,1));
test('читаем этаж по имени файла',()=>{assert.equal(floorNumber('2 этаж'),2);assert.equal(floorNumber('Этаж 3'),3);assert.equal(floorNumber('Подвал'),-1)});

test('папка одного объекта: Word прямо в корне и поэтажные планы',()=>{
 const r=analyze([f('Театр кукол/ОПТП.docx'),f('Театр кукол/Поэтажные планы/Этаж 1.jpg'),f('Театр кукол/Поэтажные планы/Этаж 2.pdf')]);
 assert.equal(r.objects.length,1);assert.equal(r.objects[0].name,'Театр кукол');assert.equal(r.entries.filter(x=>x.kind==='floor').length,2);
});
test('папка объекта с одними поэтажными планами',()=>{
 const r=analyze([f('Школа/Поэтажные планы/Этаж 1.png')]);
 assert.equal(r.objects[0].name,'Школа');assert.equal(r.entries[0].kind,'floor');
});
test('папка подразделения: разные объекты не объединяются',()=>{
 const r=analyze([f('СПЧ-1/Школа/ОПТП.docx'),f('СПЧ-1/Театр/ОПТП.docx')]);
 assert.equal(r.objects.length,2);
});
