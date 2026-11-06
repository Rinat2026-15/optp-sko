/* Обработка текстовых сведений из Word DOCX без внешней отправки документов. */
(function(root){
'use strict';
const WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const normalize=t=>String(t||'').replace(/\s+/g,' ').trim();
const max=(value,n)=>normalize(value).slice(0,n);
const fieldOrder=['address','district','floors','height_m','description','water_supply','evacuation','forces_and_means'];
const fieldLabels={address:'Адрес',district:'Район/город',floors:'Этажность',height_m:'Высота, м',description:'Общие сведения',water_supply:'Водоснабжение',evacuation:'Эвакуация',forces_and_means:'Силы и средства'};
function heading(s){
 let t=normalize(s).replace(/^(?:раздел|глава)\s+\d+[.\s:-]*/i,'').replace(/^(?:\d+(?:\.\d+)*[.)]?|[IVX]{1,5}[.)])\s*/i,'').replace(/[:.\s]+$/,'').toLocaleLowerCase('ru');
 if(t.length>120)return null;
 if(/^(?:(?:(?:наружное|внутреннее|противопожарное|пожарное)\s+){0,3}водоснабжени[ея]|источники\s+(?:наружного\s+)?(?:противопожарного\s+)?водоснабжения|пожарные гидранты|водоисточники)(?:\s+(?:объекта|здания))?$/.test(t))return 'water_supply';
 if(/^(?:эвакуац|пути эвакуац|эвакуационные выходы|спасени[ея] людей)/.test(t))return 'evacuation';
 if(/^(?:расч[её]т сил и средств|силы и средства|привлекаем(?:ые|ых) сил|план привлечения|подразделени[яй] привлекаем)/.test(t))return 'forces_and_means';
 if(/^(?:общие сведения|общая характеристика|характеристика объекта|краткая характеристика|оперативно-тактическая характеристика|строительные характеристики|конструктивные особенности|описание объекта|пожарная опасность)/.test(t))return 'description';
 return null;
}
function parseHeight(raw){
 const n=String(raw).replace(',','.').match(/\b(\d{1,3}(?:\.\d{1,2})?)\b/);
 if(!n)return null;const v=Number(n[1]);return v>0&&v<200?v:null;
}
function extractFields(paragraphs){
 const fields={},parts={description:[],water_supply:[],evacuation:[],forces_and_means:[]},warnings=[];
 // Word часто хранит название поля и значение в отдельных ячейках таблицы.
 const source=(paragraphs||[]).map(normalize).filter(Boolean),combined=[];
 const standalone=/^(?:адрес(?:\s+(?:объекта|расположения|местонахождения))?|местонахождение|месторасположение|район|город|насел[её]нный пункт|этажность|количество этажей|число этажей|высота(?:\s+(?:здания|объекта))?(?:\s*,?\s*м)?)[:.]?$/i;
 for(let i=0;i<source.length;i++){
  const line=source[i],next=source[i+1]||'';
  if(standalone.test(line)&&next&&next.length<250&&!heading(next)){
   combined.push(line.replace(/[:.]$/,'')+': '+next);i++;
  }else combined.push(line);
 }
 let section=null;
 for(const raw of combined){
  const line=normalize(raw);if(!line)continue;
  // Прямые строки из разделов, таблиц и карточек.
  const inline=[
   ['address',/^(?:адрес(?:\s+(?:объекта|расположения|местонахождения))?|местонахождение|месторасположение|расположение объекта)\s*[:–—-]\s*(.+)$/i],
   ['district',/^(?:район|город|насел[её]нный пункт|местность)\s*[:–—-]\s*(.+)$/i],
   ['floors',/^(?:этажность|количество этажей|число этажей|этажей)\s*(?:,\s*этажей)?\s*[:–—-]?\s*(\d{1,2})\s*(?:этажа?|этажей)?$/i],
   ['height_m',/^(?:высота(?:\s+(?:здания|объекта))?)(?:\s*,?\s*м)?\s*[:–—-]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*м?\.?$/i]
  ];
  let direct=false;
  for(const [key,rx] of inline){
   const m=line.match(rx);if(!m)continue;
   const v=key==='floors'?Number(m[1]):key==='height_m'?parseHeight(m[1]):max(m[1],300);
   if(v!==null&&v!==''&&fields[key]===undefined)fields[key]=v;
   direct=true;break;
  }
  if(direct)continue;
  const key=heading(line);
  if(key){section=key;continue}
  if(/^\d+(?:\.\d+){0,3}[.)]\s+.{4,}|^(?:содержание|оглавление|приложение|утверждаю|согласовано|подпись|схема\s*\d+)/i.test(line)){
   section=null;continue;
  }
  if(section && parts[section]){
   // Ограничение против присваивания всего содержимого ОПТП одному полю.
   if(parts[section].join('\n').length<5800)parts[section].push(line.slice(0,700));
  }
 }
 for(const [key,list] of Object.entries(parts)){
  const value=list.join('\n').trim();
  if(value)fields[key]=value.slice(0,5500);
 }
 if(Object.keys(fields).length===0)warnings.push('Заголовки разделов не распознаны. Проверьте Word вручную.');
 return {fields,warnings};
}
async function docxParagraphs(file,zipClass){
 if(!zipClass||typeof zipClass.loadAsync!=='function')throw Error('Библиотека DOCX не загружена: проверьте интернет');
 const content=await file.arrayBuffer();
 const zip=await zipClass.loadAsync(content);
 const document=zip.file('word/document.xml');
 if(!document)throw Error('В DOCX отсутствует document.xml');
 const xml=await document.async('string');
 if(typeof DOMParser==='undefined')throw Error('Нет XML-парсера браузера');
 const parsed=new DOMParser().parseFromString(xml,'application/xml');
 if(parsed.querySelector('parsererror'))throw Error('XML повреждён');
 const paras=[...parsed.getElementsByTagNameNS(WNS,'p')];
 return paras.map(p=>[...p.getElementsByTagNameNS(WNS,'t')].map(e=>e.textContent).join('')).filter(t=>normalize(t));
}
async function fromDocx(file,zipClass){
 const paragraphs=await docxParagraphs(file,zipClass);
 if(!paragraphs.length)return {fields:{},warnings:['Документ пуст или состоит из сканов: текст не извлечён']};
 return extractFields(paragraphs);
}
const api={extractFields,fromDocx,docxParagraphs,fieldLabels,fieldOrder,heading};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.OPTPWordExtract=api;
})(typeof globalThis!=='undefined'?globalThis:this);
