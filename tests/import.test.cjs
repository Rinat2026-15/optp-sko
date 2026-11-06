const test=require('node:test');const assert=require('node:assert/strict');
const {parseObjects,parseDelimited}=require('../csv-import.js');
test('semicolon csv and Cyrillic headers',()=>{const a=parseObjects('Название;Адрес;Район/город;Этажность\nТеатр;ул. Ленина, 1;Петропавловск;2','abc',[]);assert.equal(a.payloads[0].fire_unit_id,'abc');assert.equal(a.payloads[0].floors,2)});
test('csv quoted values with semicolon',()=>{const a=parseDelimited('Название;Адрес\n"Театр; детский";"ул. 1"');assert.equal(a[1][0],'Театр; детский')});
test('skip existing object inside same unit',()=>{const a=parseObjects('Название;Адрес\nТеатр;улица 1','abc',[{name:'Театр',address:'улица 1',fire_unit_id:'abc'}]);assert.equal(a.payloads.length,0);assert.equal(a.skipped.length,1)});
test('same name in other unit allowed',()=>{const a=parseObjects('Название;Адрес\nТеатр;улица 1','abc',[{name:'Театр',address:'улица 1',fire_unit_id:'other'}]);assert.equal(a.payloads.length,1)});
test('bad floors excluded',()=>{const a=parseObjects('Название;Этажность\nТеатр;abc','abc',[]);assert.equal(a.payloads.length,0);assert.equal(a.errors.length,1)});
test('missing title excluded',()=>{const a=parseObjects('Название;Адрес\n;улица 1','abc',[]);assert.equal(a.errors.length,1)});
