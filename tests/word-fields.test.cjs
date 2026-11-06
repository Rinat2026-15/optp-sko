const test=require('node:test');const assert=require('node:assert/strict');
const {extractFields,heading}=require('../word-fields.js');
test('разделы Word распределяются по вкладкам',()=>{
const {fields}=extractFields(['Адрес объекта: ул. Ленина, 1','Этажность: 3','Высота здания, м: 12,5','Общие сведения','Кирпичное здание','Водоснабжение','Пожарный гидрант на улице','Силы и средства','ПЧ-3, автоцистерна','Эвакуация','Два выхода']);assert.equal(fields.address,'ул. Ленина, 1');assert.equal(fields.floors,3);assert.equal(fields.height_m,12.5);assert.match(fields.water_supply,/гидрант/);assert.match(fields.forces_and_means,/ПЧ-3/);assert.match(fields.evacuation,/Два выхода/);});
test('различаем нумерованные разделы',()=>{assert.equal(heading('4.2 Наружное противопожарное водоснабжение'),'water_supply');assert.equal(heading('3. Расчёт сил и средств'),'forces_and_means')});
test('не считаем обычный текст разделом',()=>{const x=extractFields(['Некоторый неструктурированный абзац']);assert.deepEqual(x.fields,{});assert.equal(x.warnings.length,1)});
test('разделы ограничены по длине',()=>{const x=extractFields(['Общие сведения',...'A'.repeat(12000).match(/.{1,600}/g)]);assert.ok(x.fields.description.length<=5500)});

test('метаданные из соседних ячеек таблицы DOCX',()=>{
 const {fields}=extractFields(['Адрес объекта','ул. Абая, 15','Этажность','3','Высота здания, м','11,5']);
 assert.equal(fields.address,'ул. Абая, 15');assert.equal(fields.floors,3);assert.equal(fields.height_m,11.5);
});
