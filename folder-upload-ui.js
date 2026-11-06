/* Подразделение -> папки объектов -> документы, схемы и распознанные сведения DOCX. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
let pending=[],unit=null,busy=false,shownScope=null,extracted=new Map();
const text=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
const mime=ext=>({doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'})[ext]||'application/octet-stream';
const fields=OPTPWordExtract.fieldOrder,labels=OPTPWordExtract.fieldLabels;
function clear(keepFile=false){
 pending=[];unit=null;extracted=new Map();$('#folderConsent').checked=false;
 if(!keepFile)$('#folderFiles').value='';
 $('#folderPreview').replaceChildren();$('#folderProgress').textContent='';
 $('#saveFolder').disabled=true;
}
function refresh(){
 const eligible=units.some(u=>u.id===activeScope)&&(role==='admin'||role==='editor');
 $('#folderImportBox').classList.toggle('hidden',!eligible);
 if(shownScope!==activeScope&&!busy){shownScope=activeScope;clear()}
}
async function inspect(){
 if(busy)throw Error('Загрузка уже выполняется');
 if(!units.some(u=>u.id===activeScope))throw Error('Сначала выберите пожарное подразделение');
 $('#previewFolder').disabled=true;
 $('#folderPreview').textContent='Анализирую папку и текст Word...';
 pending=[];unit=null;extracted=new Map();$('#saveFolder').disabled=true;
 try{
  const result=OPTPFolderImport.analyze($('#folderFiles').files);
  const byObject=new Map();
  for(const item of result.entries){
    const k=text(item.objectName);
    if(!byObject.has(k))byObject.set(k,[]);
    if(item.kind==='doc'&&item.extension==='docx')byObject.get(k).push(item);
  }
  const warnings=[];
  for(const [key,items] of byObject){
    items.sort((a,b)=>Number(/оптп|оперативн.*план/i.test(b.title))-Number(/оптп|оперативн.*план/i.test(a.title)));
    const record={};
    for(const item of items.slice(0,3)){
      try{
        const res=await OPTPWordExtract.fromDocx(item.file,window.JSZip);
        for(const name of fields){
          if(res.fields[name]===undefined)continue;
          if(record[name]===undefined)record[name]=res.fields[name];
          else if(record[name]!==res.fields[name])warnings.push(item.relativePath+': неоднозначные сведения о поле «'+labels[name]+'». Использован первый документ.');
        }
        warnings.push(...res.warnings.map(w=>item.relativePath+': '+w));
      }catch(err){warnings.push(item.relativePath+': текст не извлечён ('+err.message+'); файл будет прикреплён.')}
    }
    extracted.set(key,record);
    if(items.length>3)warnings.push(key+': проверены только первые три DOCX');
  }
  for(const item of result.entries){
    if(item.kind==='doc' && item.extension==='doc')warnings.push(item.relativePath+': формат DOC нельзя разобрать автоматически. Сохранится исходный файл; для извлечения сведений нужен DOCX.');
  }
  pending=result.entries;unit=activeScope;
  const docs=pending.filter(f=>f.kind==='doc').length;
  const plans=pending.filter(f=>f.kind==='floor').length;
  const water=pending.filter(f=>f.kind==='water').length;
  const parsed=[...extracted.values()].filter(o=>fields.some(f=>o[f]!==undefined)).length;
  const tableRows=result.objects.slice(0,30).map(o=>{
    const values=extracted.get(text(o.name))||{};
    const preview=fields.filter(f=>values[f]!==undefined).map(f=>'<div><b>'+safe(labels[f])+':</b> '+safe(String(values[f]).slice(0,450))+(String(values[f]).length>450?'…':'')+'</div>').join('');
    return '<tr><td>'+safe(o.name)+'</td><td>'+o.documents+'</td><td>'+o.floors+'</td><td>'+o.water+'</td><td><details><summary>'+Object.keys(values).length+' полей</summary>'+(preview||'Сведения не извлечены')+'</details></td></tr>';
  }).join('');
  $('#folderPreview').innerHTML='<b>Объектов: '+result.objects.length+'; документов: '+docs+'; схем объекта: '+plans+'; схем водоснабжения: '+water+'.</b>'+
    '<p class="hint">Сведения DOCX распознаны для '+parsed+' объектов. Перед загрузкой раскройте предпросмотр и проверьте значения. Уже заполненные поля не перезаписываются.</p>'+
 +'<p class="hint">Подпапки зерносушилок, этажей и других сооружений сохраняются в названиях схем. Водоснабжение находится в отдельной вкладке.</p>'+
    '<p class="hint">Пропущено файлов: '+result.skipped.length+'; ошибок файлов: '+result.errors.length+'; предупреждений по Word: '+warnings.length+'.</p>'+
    (result.errors.length?'<p class="error">'+result.errors.slice(0,5).map(safe).join('; ')+'</p>':'')+
    (result.skipped.length?'<p class="hint">Пропущены: '+result.skipped.slice(0,3).map(safe).join('; ')+'</p>':'')+
    (warnings.length?'<details><summary>Предупреждения о распознавании ('+warnings.length+')</summary><p class="hint">'+warnings.slice(0,12).map(safe).join('; ')+'</p></details>':'')+
    (tableRows?'<table><thead><tr><th>Объект</th><th>Документы</th><th>Схемы</th><th>Водоснабжение</th><th>Сведения из Word</th></tr></thead><tbody>'+tableRows+'</tbody></table>':'');
  $('#saveFolder').disabled=!pending.length||!$('#folderConsent').checked;
 }finally{$('#previewFolder').disabled=false;}
}
async function upload(){
 if(busy)throw Error('Загрузка уже выполняется');
 if(!pending.length||unit!==activeScope||!units.some(u=>u.id===activeScope))throw Error('Сначала выберите и проверьте папку');
 if(role!=='admin'&&role!=='editor')throw Error('Требуется вход администратора или редактора');
 if(!$('#folderConsent').checked)throw Error('Подтвердите проверку прав доступа к документам');
 busy=true;
 $('#saveFolder').disabled=true;$('#folderFiles').disabled=true;$('#previewFolder').disabled=true;$('#backToUnits').disabled=true;
 const files=pending.slice(),u=unit,parsed=new Map(extracted);
 const progress=$('#folderProgress');
 let created=0,saved=0,skipped=0,fieldsSaved=0,failure=null,forcesEnabled=false;
 try{
  const forcesProbe=await client.from('optp_objects').select('forces_and_means').limit(1);
  forcesEnabled=!forcesProbe.error;
  const current=check(await client.from('optp_objects').select('*').eq('fire_unit_id',u));
  const known=new Map();
  for(const row of current){
   const k=text(row.name);
   if(known.has(k))throw Error('В подразделении два объекта с названием '+row.name+'. Уточните названия перед импортом.');
   known.set(k,row);
  }
  const groups=new Map();
  for(const item of files){
   const k=text(item.objectName);
   if(!groups.has(k))groups.set(k,{name:item.objectName,files:[]});
   groups.get(k).files.push(item);
  }
  for(const [key,group] of groups){
   const values=parsed.get(key)||{},patch={};
   for(const f of fields){
    if(values[f]===undefined||(f==='forces_and_means'&&!forcesEnabled))continue;
    const currentValue=known.get(key)?.[f];
    if(currentValue===null||currentValue===undefined||currentValue==='')patch[f]=values[f];
   }
   let row=known.get(key);
   progress.textContent='Объект: '+group.name+'; документов загружено '+saved+'/'+files.length;
   if(!row){
     row=check(await client.from('optp_objects').insert({name:group.name,fire_unit_id:u,...patch}).select('*').single());
     known.set(key,row);created++;fieldsSaved+=Object.keys(patch).length;
   }else if(Object.keys(patch).length){
     check(await client.from('optp_objects').update(patch).eq('id',row.id));
     Object.assign(row,patch);fieldsSaved+=Object.keys(patch).length;
   }
   const id=row.id,stored={};
   for(const kind of ['doc','floor','water']){
    const table=kind==='floor'?'optp_floor_plans':'optp_documents';
    const list=check(await client.from(table).select('title,file_path').eq('object_id',id));
    const scoped=kind==='water'?list.filter(f=>String(f.file_path||'').startsWith(id+'/water/'))
        :kind==='doc'?list.filter(f=>!String(f.file_path||'').startsWith(id+'/water/')):list;
    stored[kind]=new Set(scoped.map(f=>text(f.title)+'|'+String(f.file_path||'').split('.').pop().toLowerCase()));
   }
   for(const item of group.files){
    const label=text(item.title)+'|'+item.extension;
    if(stored[item.kind].has(label)){skipped++;continue}
    progress.textContent='Объект: '+group.name+'\nФайл: '+item.file.name+'\nЗагружено '+saved+' из '+files.length;
    const table=item.kind==='floor'?'optp_floor_plans':'optp_documents';
    const path=id+'/'+item.kind+'/'+crypto.randomUUID()+'.'+item.extension;
    check(await client.storage.from('optp-files').upload(path,item.file,{upsert:false,contentType:mime(item.extension)}));
    const doc={object_id:id,title:item.title,file_path:path};
    if(item.kind==='floor')doc.floor_number=item.floorNumber;
    try{check(await client.from(table).insert(doc))}
    catch(err){try{await client.storage.from('optp-files').remove([path])}catch(_){}throw err}
    saved++;stored[item.kind].add(label);
   }
  }
 }catch(err){failure=err}
 finally{
  busy=false;pending=[];unit=null;extracted=new Map();
  $('#backToUnits').disabled=false;$('#folderFiles').disabled=false;$('#previewFolder').disabled=false;$('#saveFolder').disabled=true;
  try{await loadObjects()}catch(err){failure=failure||err}
  progress.textContent='Создано объектов: '+created+'; прикреплено файлов: '+saved+'; заполнено полей: '+fieldsSaved+'; пропущено повторов: '+skipped+
    (forcesEnabled?'':'\nДля заполнения поля «Силы и средства» необходима миграция Supabase; Word сохранён целиком.')+
    (failure?'\nОшибка: '+failure.message+'. Для продолжения выберите папку повторно.':'\nГотово.');
  status(failure?'Папка загружена частично':'Данные из папки добавлены',!!failure);
 }
}
$('#folderFiles').addEventListener('change',()=>clear(true));
$('#folderConsent').addEventListener('change',()=>{$('#saveFolder').disabled=busy||!pending.length||!$('#folderConsent').checked});
$('#previewFolder').addEventListener('click',()=>inspect().catch(err=>{pending=[];unit=null;$('#folderPreview').textContent=err.message;$('#saveFolder').disabled=true;$('#previewFolder').disabled=false}));
$('#saveFolder').addEventListener('click',()=>upload().catch(err=>{status('Ошибка импорта: '+err.message,true);$('#folderProgress').textContent=err.message}));
window.OPTPFolderUI={refresh};
refresh();
})();