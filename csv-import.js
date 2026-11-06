/* CSV/TSV import support; no external dependencies, no automatic writes. */
(function(root){
  const FIELD_NAMES={
    'название':'name','наименование':'name','объект':'name','name':'name',
    'адрес':'address','address':'address',
    'район/город':'district','район':'district','город':'district','district':'district',
    'этажность':'floors','этажи':'floors','floors':'floors',
    'высота (м)':'height_m','высота, м':'height_m','высота м':'height_m','height_m':'height_m',
    'описание':'description','характеристика':'description','description':'description',
    'водоснабжение':'water_supply','water_supply':'water_supply',
    'эвакуация':'evacuation','evacuation':'evacuation'
  };
  const normalize=s=>String(s??'').trim().toLocaleLowerCase('ru').replace(/\s+/g,' ');
  function parseDelimited(text){
    const source=String(text||'').replace(/^\uFEFF/,'');
    if(!source.trim())throw Error('Файл пуст');
    const top=source.split(/\r?\n/,1)[0];
    const options=[';','\t',','];
    const count=sep=>(top.match(new RegExp(sep==='\t'?'\\t':sep===';'?';':',','g'))||[]).length;
    const delim=options.reduce((a,b)=>count(b)>count(a)?b:a,';');
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<source.length;i++){
      const c=source[i];
      if(c==='"'){
        if(quoted && source[i+1]==='"'){cell+='"';i++}
        else if(!quoted && cell.trim()==='')quoted=true;
        else if(quoted)quoted=false;
        else cell+='"';
      }else if(!quoted&&c===delim){row.push(cell.trim());cell=''}
      else if(!quoted&&(c==='\r'||c==='\n')){
        if(c==='\r'&&source[i+1]==='\n')i++;
        row.push(cell.trim());cell='';
        if(row.some(x=>x!==''))rows.push(row);
        row=[];
      }else cell+=c;
    }
    if(quoted)throw Error('В CSV не закрыты кавычки');
    row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);
    return rows;
  }
  function parseObjects(text,unitId,existing){
    if(!unitId)throw Error('Выберите подразделение');
    const rows=parseDelimited(text);
    if(rows.length<2)throw Error('В файле нет строк с объектами');
    if(rows.length>201)throw Error('Максимум 200 объектов за один импорт');
    const headers=rows.shift().map(h=>FIELD_NAMES[normalize(h)]||'');
    if(!headers.includes('name'))throw Error('Нет обязательного столбца «Название»');
    if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error('Дублирующиеся столбцы');
    const existingKeys=new Set((existing||[]).filter(o=>o.fire_unit_id===unitId).map(o=>normalize(o.name)+'|'+normalize(o.address)));
    const payloads=[],skipped=[],errors=[];
    rows.forEach((cols,i)=>{
      const line=i+2, record={};
      headers.forEach((name,j)=>{if(name)record[name]=(cols[j]||'').trim()});
      if(!record.name){errors.push('Строка '+line+': нет названия');return}
      const key=normalize(record.name)+'|'+normalize(record.address);
      if(existingKeys.has(key)){skipped.push(line);return}
      for(const n of ['floors','height_m']){
        if(record[n]){
          const v=Number(record[n].replace(',','.'));
          if(!Number.isFinite(v)||v<0||(n==='floors'&&!Number.isInteger(v))){
            errors.push('Строка '+line+': неправильное значение '+n);return
          }
          record[n]=v;
        }else delete record[n];
      }
      for(const n of ['name','address','district','description','water_supply','evacuation'])if(record[n]===undefined)delete record[n];
      record.fire_unit_id=unitId;
      payloads.push(record);existingKeys.add(key);
    });
    return {payloads,skipped,errors};
  }
  const api={parseDelimited,parseObjects};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.OPTPImport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
