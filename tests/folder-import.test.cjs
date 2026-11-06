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
test('изображения из папки объекта доступны во вкладке Схемы',()=>assert.equal(analyze([f('СПЧ-1/Театр/фасад.jpg')]).entries[0].kind,'floor'));
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

test('схема расположения гидрантов при импорте папки отправляется в водоснабжение',()=>{
 const r=analyze([f('ПЧ-3/Театр кукол/Схемы водоснабжения/Схема расположения гидрантов.pdf')]);
 assert.equal(r.entries.length,1);assert.equal(r.entries[0].kind,'water');assert.equal(r.objects[0].water,1);
});
test('схема расположения водоисточников внутри папки одного объекта',()=>{
 const r=analyze([f('Театр кукол/Водоснабжение/Схема расположения гидрантов.jpg'),f('Театр кукол/Поэтажные планы/Этаж 1.png')]);
 assert.equal(r.objects.length,1);assert.equal(r.entries.find(x=>x.kind==='water').objectName,'Театр кукол');assert.equal(r.entries.find(x=>x.kind==='floor').floorNumber,1);
});
test('документ Word о водоснабжении не принимается за изображение схемы',()=>{
 const r=analyze([f('Театр/Водоснабжение/Описание.docx')]);
 assert.equal(r.entries[0].kind,'doc');
});

test('зерносушилка и генплан распределяются в планы объекта',()=>{
 const r=analyze([f('СПЧ-1/Агропредприятие/Зерносушилки/Схема зерносушилки.pdf'),f('СПЧ-1/Агропредприятие/Генплан.png')]);
 assert.equal(r.objects.length,1);assert.equal(r.entries.filter(x=>x.kind==='floor').length,2);
});
test('подвал, чердак и цоколь сохраняются в поэтажных планах',()=>{
 const r=analyze([f('Предприятие/Подвал.pdf'),f('Предприятие/Чердак.jpg'),f('Предприятие/План цоколя.png')]);
 assert.equal(r.objects.length,1);assert.equal(r.entries.length,3);assert.ok(r.entries.every(x=>x.kind==='floor'));
 assert.equal(r.entries[0].floorNumber,-1);
});
test('любая явно названная схема оборудования распознается',()=>{
 const r=analyze([f('Предприятие/Схема установки 3.png'),f('Предприятие/Чертеж силоса.pdf'),f('Предприятие/План эвакуации.pdf')]);
 assert.equal(r.entries.length,3);assert.ok(r.entries.every(x=>x.kind==='floor'));
});
test('схемы водоснабжения остаются в отдельном разделе',()=>{
 const r=analyze([f('Предприятие/Водоснабжение/Гидранты.png'),f('Предприятие/Генплан.png')]);
 assert.equal(r.entries.find(x=>x.title==='Гидранты').kind,'water');
 assert.equal(r.entries.find(x=>x.title==='Генплан').kind,'floor');
});
test('документы Word и обычные фото не превращаются в планы',()=>{
 const r=analyze([f('Предприятие/Описание зерносушилки.docx'),f('Предприятие/Фото фасада.jpg')]);
 assert.equal(r.entries.length,2);assert.equal(r.entries[0].kind,'doc');assert.equal(r.entries[1].kind,'floor');
});

test('вкладка Схемы хранит одинаковые названия в разных зерносушилках',()=>{
 const r=analyze([f('Завод/Зерносушилка №1/Этаж 1.pdf'),f('Завод/Зерносушилка №2/Этаж 1.pdf')]);
 assert.equal(r.objects.length,1);assert.equal(r.entries.length,2);
 assert.deepEqual(r.entries.map(x=>x.title),['Зерносушилка №1 / Этаж 1','Зерносушилка №2 / Этаж 1']);
});
test('водоснабжение не попадает в общие схемы',()=>{
 const r=analyze([f('Завод/Схемы/Генплан.pdf'),f('Завод/Водоснабжение/Гидранты.png')]);
 assert.deepEqual(r.entries.map(x=>x.kind),['floor','water']);
});
test('PDF с явным названием ОПТП остается документом',()=>{
 const r=analyze([f('Завод/ОПТП.pdf'),f('Завод/Документы/Описание.pdf')]);
 assert.deepEqual(r.entries.map(x=>x.kind),['doc','doc']);
});
test('папка схем выбранного объекта распознается без отдельного списка объектов',()=>{
 const {analyzeObjectSchemes}=require('../folder-import.js');
 const r=analyzeObjectSchemes([f('Чертежи/Элеватор №1/Этаж 1.png'),f('Чертежи/Элеватор №2/Этаж 1.png'),f('Чертежи/Водоснабжение/Схема гидрантов.jpg')]);
 assert.equal(r.entries.length,3);assert.deepEqual(r.entries.map(x=>x.kind),['floor','floor','water']);
 assert.equal(r.entries[0].title,'Элеватор №1 / Этаж 1');
});
