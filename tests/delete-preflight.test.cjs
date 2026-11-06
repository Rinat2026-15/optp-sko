const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('async function deleteCurrentObject(){');
const stop=html.indexOf('\n}\n',start);
assert.ok(start>=0&&stop>start,'deleteCurrentObject must exist');
const functionText=html.slice(start,stop+2);
function makeHarness(mode){
 const state={deleteBusy:false,role:'admin',selected:'object-uuid',objs:[{id:'object-uuid',name:'Школа'}],
 calls:[],messages:[],files:[],loads:0};
 state.$=key=>{
  if(key==='#deleteObjectName')return {value:mode==='mismatch'?'Другой объект':'Школа'};
  if(key==='#deleteObjectAcknowledge')return {checked:mode!=='unchecked'};
  return {disabled:false};
 };
 state.showDeleteFeedback=(...args)=>state.messages.push(args);
 state.deleteErrorText=e=>'Ошибка Supabase: '+(e.code||e.message);
 state.document={body:{classList:{remove:()=>{}}}};
 state.show=()=>{};
 state.loadObjects=async()=>{state.loads++};
 state.check=r=>{if(r.error)throw r.error;return r.data};
 state.client={
  rpc:async(_name,args)=>{
   state.calls.push(args.p_object_id);
   if(mode==='missing')return {data:null,error:{code:'PGRST202',message:'Could not find the function'}};
   if(args.p_object_id===null)return {data:null,error:{code:'P0001',message:'Не указан объект'}};
   return {data:['object-uuid/floor/first.pdf'],error:null};
  },
  storage:{from:()=>({remove:async files=>{state.files.push(...files);return {error:null}}})}
 };
 state.invoke=new Function('s','with(s){'+functionText+';return deleteCurrentObject;}')(state);
 return state;
}
test('missing delete RPC shows error but never deletes',async()=>{
 const s=makeHarness('missing');await s.invoke();
 assert.deepEqual(s.calls,[null]);assert.equal(s.files.length,0);
 assert.equal(s.deleteBusy,false);assert.match(s.messages.at(-1)[0],/Supabase/);
});
test('wrong typed object name blocks all RPC calls',async()=>{
 const s=makeHarness('mismatch');await s.invoke();
 assert.deepEqual(s.calls,[]);assert.equal(s.files.length,0);
});
test('not acknowledging irreversible deletion blocks requests',async()=>{
 const s=makeHarness('unchecked');await s.invoke();
 assert.deepEqual(s.calls,[]);assert.equal(s.files.length,0);
});
test('successful confirmation deletes once and cleans storage',async()=>{
 const s=makeHarness('success');await s.invoke();
 assert.deepEqual(s.calls,[null,'object-uuid']);
 assert.deepEqual(s.files,['object-uuid/floor/first.pdf']);
 assert.equal(s.loads,1);assert.equal(s.deleteBusy,false);
});
test('inline confirmation panel and button handlers are present',()=>{
 for(const id of ['deleteConfirmPanel','deleteObjectName','deleteObjectAcknowledge','confirmDeleteObject','cancelDeleteObject']){
  assert.ok(html.includes('id="'+id+'"'),id+' missing');
 }
 assert.match(html,/else if\(e\.target\.id==='confirmDeleteObject'\)deleteCurrentObject\(\)/);
});
