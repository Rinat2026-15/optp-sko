/* ОПТП СКО: маршрутизация файлов из папки объекта. Без сетевых вызовов. */
(function(root){
 'use strict';
 const IMAGE=/\.(?:jpe?g|png)$/i, PDF=/\.pdf$/i, WORD=/\.(?:docx?|DOCX?)$/i;
 const ALLOWED=/\.(?:docx?|pdf|jpe?g|png)$/i;
 const waterHint=/(?:водоснабжен|гидрант|водоисточник|водозабор|пожарн.{0,14}водо[её]м|расположен.{0,30}\bпг\b|пг[-_\s]*\d+)/i;
 const industrialHint=/(?:генплан|генеральн|ситуационн|зерносушил|сушильн|элеватор|силос|конвейер|транспорт[её]р|цех|производственн|установк|оборудовани|котельн|бункер|галере|чердак|чердачн|мансард|подвал|подвальн|цокол|подземн|кровл|техподполь|антресол)/i;
 const planHint=/(?:поэтаж|схем|этаж|floor|черт[её]ж|план[-_\s]*(?:этаж|помещен|цокол|здани)|генплан)/i;
 const docHint=/(?:^оптп$|оперативн.{0,30}план|план\s+тушения\s+пожара|инструкция|описание|пояснительн|характеристика|ведомость|справка)/i;
 const docDir=/^(?:документы|оперативные документы|текстовые документы|отчеты|отчёты|описания)$/i;
 const norm=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
 const partsFor=file=>String(file.webkitRelativePath||file.relativePath||'').replace(/\\/g,'/').split('/').filter(Boolean);
 const baseName=name=>String(name||'').replace(/\.[^.]+$/,'').trim();
 function floorNumber(name){
  const s=String(name||'').toLocaleLowerCase('ru').replace(/[–—]/g,'-');
  const match=s.match(/(?:этаж|эт\.?|floor)\s*[№# ]*?(-?\d{1,2})|(-?\d{1,2})\s*(?:-?й|-?го|-?ый)?\s*(?:этаж|эт\.?|floor)/i);
  if(match)return Number(match[1]??match[2]);
  return /подвал|цокол|техподполь/.test(s)?-1:null;
 }
 function classify(name,folders){
  if(WORD.test(name))return 'doc';
  const base=baseName(name);
  const path=folders.join(' ');
  if(waterHint.test(path+' '+base))return 'water';
  if(PDF.test(name)&&!planHint.test(base)&&!industrialHint.test(base)&&
   (docHint.test(base)||folders.some(folder=>docDir.test(folder))))return 'doc';
  // Остальные PDF и изображения относятся к схемам; их можно проверить перед сохранением.
  return 'floor';
 }
 function analyze(files){
  const all=Array.from(files||[]);
  if(!all.length)throw Error('Выберите папку с объектами');
  if(all.length>200)throw Error('Не более 200 файлов за один раз. Разделите папку на части.');
  const entries=[],skipped=[],errors=[],seen=new Set();
  const paths=all.map(partsFor);
  const sections=/^(?:поэтажные планы|поэтажные схемы|планы этажей|схемы|этажи|этажные планы|документы|оптп|планы|чертежи|водоснабжение|наружное водоснабжение|схемы водоснабжения|гидранты|схемы гидрантов|схемы расположения гидрантов)$/i;
  const atRoot=paths.some(parts=>parts.length===2&&ALLOWED.test(parts[1]||''));
  const subdirs=[...new Set(paths.filter(parts=>parts.length>=3).map(parts=>parts[1]))];
  const oneObject=atRoot||(subdirs.length>0&&subdirs.every(name=>sections.test(name)||industrialHint.test(name)));
  for(const file of all){
   const parts=partsFor(file),rel=parts.join('/');
   if(parts.length<(oneObject?2:3)){skipped.push(rel+' (не определена папка объекта)');continue}
   if(parts.some(x=>x==='.'||x==='..')){errors.push(rel+': некорректный путь');continue}
   const objectName=(oneObject?parts[0]:parts[1]).trim(),name=parts.at(-1);
   if(!objectName||objectName.length>150){errors.push(rel+': некорректное название объекта');continue}
   if(/^~\$|^thumbs\.db$|^\.ds_store$/i.test(name))continue;
   const ext=(name.match(/\.([a-z0-9]+)$/i)?.[1]||'').toLowerCase();
   if(!ALLOWED.test(name)){skipped.push(rel+' (неподдерживаемый формат)');continue}
   if(!file.size||file.size>20*1024*1024){errors.push(rel+': файл пуст или больше 20 МБ');continue}
   const folders=parts.slice(oneObject?1:2,-1);
   const titleParts=[...folders,baseName(name)].filter(Boolean);
   const fullTitle=titleParts.join(' / ');
   if(!fullTitle){errors.push(rel+': пустое название файла');continue}
   if(fullTitle.length>180){errors.push(rel+': слишком длинный путь внутри объекта (больше 180 символов)');continue}
   const kind=classify(name,folders);
   const key=[norm(objectName),kind,norm(fullTitle),ext].join('|');
   if(seen.has(key)){skipped.push(rel+' (повтор пути)');continue}
   seen.add(key);
   const num=floorNumber(baseName(name));
   entries.push({objectName,kind,title:fullTitle,floorNumber:kind==='floor'?(num??floorNumber(folders.at(-1))):null,file,relativePath:rel,extension:ext});
  }
  const objects=new Map();
  for(const item of entries){
   const key=norm(item.objectName);
   if(!objects.has(key))objects.set(key,{name:item.objectName,documents:0,floors:0,water:0});
   objects.get(key)[item.kind==='floor'?'floors':item.kind==='water'?'water':'documents']++;
  }
  return {entries,objects:[...objects.values()],skipped,errors};
 }
 function analyzeObjectSchemes(files){
  const all=Array.from(files||[]);
  if(!all.length)throw Error('Выберите папку со схемами');
  if(all.length>200)throw Error('Не более 200 файлов за одну загрузку');
  const entries=[],skipped=[],errors=[],seen=new Set();
  for(const file of all){
   const parts=partsFor(file),rel=parts.join('/'),name=parts.at(-1)||file.name;
   if(parts.some(x=>x==='.'||x==='..')){errors.push(rel+': некорректный путь');continue}
   if(!/\.(?:pdf|jpe?g|png)$/i.test(name)){skipped.push(rel+' (не графический PDF/JPG/PNG)');continue}
   if(!file.size||file.size>20*1024*1024){errors.push(rel+': пустой файл или больше 20 МБ');continue}
   const ext=name.split('.').at(-1).toLowerCase(),folders=parts.slice(1,-1);
   const title=[...folders,baseName(name)].filter(Boolean).join(' / ');
   if(!title||title.length>180){errors.push(rel+': название слишком длинное или отсутствует');continue}
   const kind=waterHint.test(parts.slice(1).join(' '))?'water':'floor';
   const key=[kind,norm(title),ext].join('|');
   if(seen.has(key)){skipped.push(rel+' (повтор схемы)');continue}
   seen.add(key);
   entries.push({kind,title,floorNumber:kind==='floor'?(floorNumber(baseName(name))??floorNumber(folders.at(-1))):null,file,relativePath:rel,extension:ext});
  }
  return {entries,skipped,errors};
 }
 const api={analyze,analyzeObjectSchemes,floorNumber,classify};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.OPTPFolderImport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
