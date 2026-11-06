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
 calls:[],messages:[],prompts:0,confirmations:0,files:[],loads:0};
 state.$=()=>({disabled:false});
 state.showDeleteFeedback=(...args)=>state.messages.push(args);
 state.deleteErrorText=e=>'Ошибка Supabase: '+(e.code||e.message);
 state.window={
  prompt:()=>{state.prompts++;return mode==='mismatch'?'Другое название':'Школа'},
  confirm:()=>{state.confirmations++;return mode!=='abort'}
 };
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
test('missing delete RPC shows error and never prompts or deletes',async()=>{
 const s=makeHarness('missing');await s.invoke();
 assert.deepEqual(s.calls,[null]);assert.equal(s.prompts,0);
 assert.equal(s.files.length,0);assert.equal(s.deleteBusy,false);
 assert.match(s.messages.at(-1)[0],/Supabase/);
});
test('wrong name prevents destructive RPC',async()=>{
 const s=makeHarness('mismatch');await s.invoke();
 assert.deepEqual(s.calls,[null]);assert.equal(s.confirmations,0);
 assert.equal(s.files.length,0);assert.equal(s.deleteBusy,false);
});
test('rejected confirmation prevents deletion',async()=>{
 const s=makeHarness('abort');await s.invoke();
 assert.deepEqual(s.calls,[null]);assert.equal(s.files.length,0);
});
test('successful confirmation deletes once and cleans storage',async()=>{
 const s=makeHarness('success');await s.invoke();
 assert.deepEqual(s.calls,[null,'object-uuid']);
 assert.deepEqual(s.files,['object-uuid/floor/first.pdf']);
 assert.equal(s.loads,1);assert.equal(s.deleteBusy,false);
});
