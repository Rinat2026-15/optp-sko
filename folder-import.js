/* ОПТП СКО: разбор папки объектов. Без сетевых вызовов, повторной записи и удаления данных. */
(function(root){
 'use strict';
 const WORD=/\.(doc|docx)$/i, PDF=/\.pdf$/i, IMAGE=/\.(jpe?g|png)$/i;
 const waterHint=/(?:водоснабжен|гидрант|водоисточник|водозабор|пожарн.{0,14}водо[её]м|схем.{0,30}водо[её]м|расположен.{0,30}пг(?:\\b|\\d))/i;
 const industrialHint=/(?:генплан|генеральн(?:ый|ого)\s+план|ситуационн(?:ый|ого)\s+план|план\s+(?:территори|размещени|расположени|эвакуац|подъезд)|черт[её]ж|технологическ|зерносушил|сушильн|элеватор|силос|зернохранилищ|нори[яи]|конвейер|транспортер|транспорт[её]р|цех|производственн|установк|оборудовани|котельн|топливохранилищ|бункер|галере|чердак|чердачн|мансард|подвал|подвальн|цоколь|подземн|кровл|крыш[аеи]|антресол)/i;
 const floorHint=/(?:поэтаж|схем[аы]?|этаж[иаи]?|floor|план[ы]?\s+этаж|plans?\s*floor)/i;
 const fileFloor=/(?:^|[\s._(-])(?:-?\d{1,2}\s*[-–— ]*?(?:-?й|-?го|-?ый)?\s*(?:эт\.?|этаж|floor)|(?:эт\.?|этаж|floor)\s*[№# ]*\-?\d{1,2}|поэтажн(?:ый|ая|ое))/i;
 const norm=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
 function floorNumber(name){
  const s=String(name||'').toLocaleLowerCase('ru').replace(/[–—]/g,'-');
  const match=s.match(/(?:этаж|эт\.?|floor)\s*[№# ]*?(-?\d{1,2})|(-?\d{1,2})\s*(?:-?й|-?го|-?ый)?\s*(?:этаж|эт\.?|floor)/i);
  if(match)return Number(match[1]??match[2]);
  return /подвал|цоколь/.test(s)?-1:null;
 }
 function analyze(files){
  const all=Array.from(files||[]);
  if(!all.length)throw Error('Выберите папку с объектами');
  if(all.length>200)throw Error('Не более 200 файлов за один раз. Разделите папку на части.');
  const entries=[],skipped=[],errors=[],seen=new Set();
  // webkitdirectory: корневая папка входит в webkitRelativePath.
  // Поддерживаем как папку с объектами, так и папку одного объекта
  // со вложенными "Поэтажные планы", "Документы" и т.п.
  const paths=all.map(file=>String(file.webkitRelativePath||file.relativePath||'').replace(/\\/g,'/').split('/').filter(Boolean));
  const support=/\.(doc|docx|pdf|jpe?g|png)$/i;
  const auxiliary=/^(?:поэтажн(?:ые|ые\s+планы|ые\s+схемы)?|поэтажные планы|поэтажные схемы|планы этажей|схемы|этажи|этажные планы|документы|оптп|планы|чертежи|водоснабжение|наружное водоснабжение|схемы водоснабжения|гидранты|схемы гидрантов|схемы расположения гидрантов)$/i;
  const atRoot=paths.some(parts=>parts.length===2&&support.test(parts[1]||''));
  const rootSubdirs=[...new Set(paths.filter(parts=>parts.length>=3).map(parts=>parts[1]))];
  const looksLikeSingleObject=rootSubdirs.length>0&&rootSubdirs.every(name=>auxiliary.test(name)||industrialHint.test(name));
  const singleObject=atRoot||looksLikeSingleObject;
  for(const file of all){
   const rel=String(file.webkitRelativePath||file.relativePath||'').replace(/\\/g,'/');
   const parts=rel.split('/').filter(Boolean);
   if(parts.length<(singleObject?2:3)){skipped.push(rel||file.name+' (файл вне папки объекта)');continue}
   if(parts.some(part=>part==='.'||part==='..')){errors.push(rel+': некорректный путь');continue}
   const objectName=(singleObject?parts[0]:parts[1]).trim(), name=parts[parts.length-1].trim();
   if(!objectName||objectName.length>150||!name){errors.push(rel+': проверьте название папки объекта');continue}
   if(/^~\$|^thumbs\.db$|^\.ds_store$/i.test(name))continue;
   const ext=(name.match(/\.([a-z0-9]+)$/i)?.[1]||'').toLowerCase();
   if(!['doc','docx','pdf','jpg','jpeg','png'].includes(ext)){skipped.push(rel+' (неподдерживаемый тип)');continue}
   if(!file.size || file.size>20*1024*1024){errors.push(rel+': файл пуст или превышает 20 МБ');continue}
   const base=name.replace(/\.[^.]+$/,'').trim();
   const nested=parts.slice(singleObject?1:2,-1).join(' ');
   const isWater=(PDF.test(name)||IMAGE.test(name))&&waterHint.test(nested+' '+base);
   const isFloor=!isWater&&(PDF.test(name)||IMAGE.test(name))&&(floorHint.test(nested)||floorHint.test(base)||industrialHint.test(nested)||industrialHint.test(base)||fileFloor.test(base));
   if(IMAGE.test(name)&&!isFloor&&!isWater){skipped.push(rel+' (изображение не обозначено как схема)');continue}
   const kind=isWater?'water':isFloor?'floor':'doc';
   const key=[norm(objectName),kind,norm(base)].join('|');
   if(seen.has(key)){skipped.push(rel+' (повтор имени файла)');continue}
   seen.add(key);
   entries.push({objectName,kind,title:base.slice(0,180),floorNumber:kind==='floor'?floorNumber(base):null,file,relativePath:rel,extension:ext});
  }
  const map=new Map();
  for(const item of entries){
   const key=norm(item.objectName);if(!map.has(key))map.set(key,{name:item.objectName,documents:0,floors:0,water:0});
   map.get(key)[item.kind==='floor'?'floors':item.kind==='water'?'water':'documents']++;
  }
  return {entries,objects:[...map.values()],skipped,errors};
 }
 const api={analyze,floorNumber};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.OPTPFolderImport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
