/* Загрузка готовых ОПТП и поэтажных планов из папки — только с правами редактора. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s);
 let pending=[],unit=null,busy=false,shownScope=null;
 const text=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
 const mime=ext=>({doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'})[ext]||'application/octet-stream';
 function clear(keepFile=false){
  pending=[];unit=null;$('#folderConsent').checked=false;
  if(!keepFile)$('#folderFiles').value='';
  $('#folderPreview').replaceChildren();$('#folderProgress').textContent='';
  $('#saveFolder').disabled=true;
 }
 function refresh(){
  const eligible=units.some(u=>u.id===activeScope)&&(role==='admin'||role==='editor');
  $('#folderImportBox').classList.toggle('hidden',!eligible);
  if(shownScope!==activeScope&&!busy){shownScope=activeScope;clear()}
 }
 function inspect(){
  if(busy)throw Error('Загрузка уже выполняется');
  if(!units.some(u=>u.id===activeScope))throw Error('Сначала выберите пожарное подразделение');
  const result=OPTPFolderImport.analyze($('#folderFiles').files);
  pending=result.entries;unit=activeScope;
  const docCount=result.entries.filter(f=>f.kind==='doc').length;
  $('#folderPreview').innerHTML='<b>Найдено объектов: '+result.objects.length+
    '; документов: '+docCount+'; поэтажных схем: '+(result.entries.length-docCount)+'</b>'+
    '<p class="hint">Пропущено: '+result.skipped.length+'; ошибок: '+result.errors.length+'. Существующие файлы не перезаписываются.</p>'+
    (result.errors.length?'<p class="error">'+result.errors.slice(0,6).map(safe).join('; ')+'</p>':'')+
    (result.skipped.length?'<p class="hint">Пропущенные файлы: '+result.skipped.slice(0,3).map(safe).join('; ')+'</p>':'')+
    (result.objects.length?'<table><thead><tr><th>Объект</th><th>Документов</th><th>Схем</th></tr></thead><tbody>'+
      result.objects.slice(0,30).map(o=>'<tr><td>'+safe(o.name)+'</td><td>'+o.documents+'</td><td>'+o.floors+'</td></tr>').join('')+
      '</tbody></table>':'');
  $('#saveFolder').disabled=!pending.length||!$('#folderConsent').checked;
 }
 async function upload(){
  if(busy)throw Error('Загрузка уже выполняется');
  if(!pending.length||unit!==activeScope||!units.some(u=>u.id===activeScope))throw Error('Выберите и проверьте папку для подразделения');
  if(role!=='admin'&&role!=='editor')throw Error('Требуются права администратора или редактора');
  if(!$('#folderConsent').checked)throw Error('Подтвердите, что проверили доступ к служебным файлам');
  busy=true;$('#saveFolder').disabled=true;$('#folderFiles').disabled=true;$('#previewFolder').disabled=true;
  $('#backToUnits').disabled=true;
  const files=pending.slice(),u=unit,progress=$('#folderProgress');
  let created=0,saved=0,skipped=0,failure=null;
  try{
   const current=check(await client.from('optp_objects').select('id,name,fire_unit_id').eq('fire_unit_id',u));
   const exists=new Map();
   for(const o of current){
    const key=text(o.name);
    if(exists.has(key))throw Error('Найдены дубли объектов: '+o.name+'. Требуется уточнить объект перед загрузкой.');
    exists.set(key,o.id);
   }
   const groups=new Map();
   for(const f of files){
    const key=text(f.objectName);
    if(!groups.has(key))groups.set(key,{name:f.objectName,files:[]});
    groups.get(key).files.push(f);
   }
   for(const [key,group] of groups){
    progress.textContent='Объект: '+group.name+'; загружено '+saved+'/'+files.length;
    let id=exists.get(key);
    if(!id){
     id=check(await client.from('optp_objects').insert({name:group.name,fire_unit_id:u}).select('id').single()).id;
     exists.set(key,id);created++;
    }
    const stored={};
    for(const type of ['doc','floor']){
     const table=type==='floor'?'optp_floor_plans':'optp_documents';
     const records=check(await client.from(table).select('title,file_path').eq('object_id',id));
     stored[type]=new Set(records.map(f=>text(f.title)+'|'+String(f.file_path||'').split('.').pop().toLowerCase()));
    }
    for(const f of group.files){
     const keyName=text(f.title)+'|'+f.extension;
     if(stored[f.kind].has(keyName)){skipped++;continue}
     progress.textContent='Объект: '+group.name+'\nФайл: '+f.file.name+'\nЗагружено: '+saved+' из '+files.length;
     const table=f.kind==='floor'?'optp_floor_plans':'optp_documents';
     const path=id+'/'+f.kind+'/'+crypto.randomUUID()+'.'+f.extension;
     check(await client.storage.from('optp-files').upload(path,f.file,{upsert:false,contentType:mime(f.extension)}));
     const record={object_id:id,title:f.title,file_path:path};
     if(f.kind==='floor')record.floor_number=f.floorNumber;
     try{check(await client.from(table).insert(record))}
     catch(err){try{await client.storage.from('optp-files').remove([path])}catch(_){}throw err}
     stored[f.kind].add(keyName);saved++;
    }
   }
  }catch(err){failure=err}
  finally{
   busy=false;pending=[];unit=null;
   $('#backToUnits').disabled=false;$('#folderFiles').disabled=false;$('#previewFolder').disabled=false;$('#saveFolder').disabled=true;
   try{await loadObjects()}catch(err){failure=failure||err}
   progress.textContent='Создано объектов: '+created+'; добавлено файлов: '+saved+'; пропущено повторов: '+skipped+
     (failure?'\nОшибка: '+failure.message+'. Выберите папку повторно, чтобы продолжить.':'\nГотово.');
   status(failure?'Папка загружена частично':'Файлы папки загружены',!!failure);
  }
 }
 $('#folderFiles').addEventListener('change',()=>clear(true));
 $('#folderConsent').addEventListener('change',()=>{$('#saveFolder').disabled=busy||!pending.length||!$('#folderConsent').checked});
 $('#previewFolder').addEventListener('click',()=>{try{inspect()}catch(e){pending=[];unit=null;$('#folderPreview').textContent=e.message;$('#saveFolder').disabled=true}});
 $('#saveFolder').addEventListener('click',()=>{upload().catch(e=>{status('Ошибка: '+e.message,true);$('#folderProgress').textContent=e.message})});
 window.OPTPFolderUI={refresh};
 refresh();
})();
