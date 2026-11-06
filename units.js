/* Shared by the UI and dependency-free tests. Search never changes assignments. */
(function(root){
  function filterObjects(objects,units,scope,query){
    const names=new Map(units.map(unit=>[unit.id,unit.name]));
    const q=String(query||'').trim().toLocaleLowerCase('ru');
    return objects.filter(object=>{
      const inScope=scope==='all'||(scope==='unassigned'?!object.fire_unit_id:object.fire_unit_id===scope);
      const text=[object.name,object.address,object.district,names.get(object.fire_unit_id)].filter(Boolean).join(' ').toLocaleLowerCase('ru');
      return inScope&&text.includes(q);
    });
  }
  const api={filterObjects};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.OPTPUnits=api;
})(typeof globalThis!=='undefined'?globalThis:this);
