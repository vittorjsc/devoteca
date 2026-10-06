import assert from 'node:assert/strict';
const origin=process.env.DEVOTECA_TEST_URL||'http://127.0.0.1:8787';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Tests may only mutate a local preview.');
const users={alice:{'oai-authenticated-user-id':'test_alice','oai-authenticated-user-email':'alice@example.test'},bob:{'oai-authenticated-user-id':'test_bob','oai-authenticated-user-email':'bob@example.test'},admin:{'oai-authenticated-user-id':'test_admin','oai-authenticated-user-email':'seedy@sites.test'}};
async function call(path,options={},user='alice',status=200){const r=await fetch(origin+path,{...options,headers:{Origin:origin,...users[user],...options.headers}});const raw=await r.text();let d;try{d=JSON.parse(raw);}catch{throw new Error(`${path} status ${r.status}: ${raw}`);}assert.equal(r.status,status,path+' '+JSON.stringify(d));return d;}
const json=(x,method='POST')=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(x)});
function form(x){const f=new FormData();for(const [k,v]of Object.entries(x))f.set(k,v);return {method:'POST',body:f};}
const ids=[],cats=[];
try{
 const anon=await fetch(origin+'/api/library');assert.equal(anon.status,401);
 await call('/api/library');await call('/api/library',{},'bob');
 const c=await call('/api/categories',json({name:'Teste '+Date.now(),color:'purple'}),'alice',201);cats.push(c.id);
 const draft={title:'Referência de teste',description:'Persistência e permissões',url:'https://example.com/devoteca-'+Date.now(),type:'site',category:c.id,tags:'test, devoteca'};
 const r=await call('/api/library',form(draft),'alice',201);ids.push(r.id);
 await call('/api/library',form(draft),'alice',409);
 await call('/api/library',form({...draft,url:'javascript:alert(1)'}),'alice',400);
 await call('/api/library',form({...draft,id:r.id,title:'Alterado pelo Bob'}),'bob',403);
 await call('/api/library',form({...draft,id:r.id,title:'Atualizado pelo autor'}),'alice');
 await call('/api/library',json({id:r.id,action:'favorite',value:true},'PATCH'));
 await call('/api/library',json({id:r.id,action:'reading',value:'reading'},'PATCH'));
 let a=await call('/api/library'),b=await call('/api/library',{},'bob');
 assert.equal(a.resources.find(x=>x.id===r.id).favorite,1);assert.equal(b.resources.find(x=>x.id===r.id).favorite,0);assert.equal(a.resources.find(x=>x.id===r.id).reading,'reading');assert.equal(b.resources.find(x=>x.id===r.id).reading,'unread');
 await call('/api/comments',json({id:r.id,body:'Comentário do grupo'}),'bob',201);
 const comments=await call('/api/comments?id='+r.id);assert.equal(comments.length,1);
 await call('/api/comments?id='+comments[0].id,{method:'DELETE'},'alice',403);
 await call('/api/library?id='+r.id,{method:'DELETE'},'bob',403);
 await call('/api/library', {method:'POST',headers:{Origin:'https://foreign.test'}},'alice',403);
 const upload=new FormData();upload.set('title','Arquivo de teste');upload.set('type','document');upload.set('file',new File(['Arquivo persistido na Devoteca.'],'teste.txt',{type:'text/plain'}));
 const f=await call('/api/files',{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-Devoteca-Metadata':encodeURIComponent(JSON.stringify({title:'Arquivo de teste',type:'document',fileName:'teste.txt',fileType:'text/plain'}))},body:'Arquivo persistido na Devoteca.'},'alice',201);ids.push(f.id);
 const download=await fetch(origin+'/api/files?id='+f.id,{headers:users.bob});assert.equal(download.status,200);assert.equal(await download.text(),'Arquivo persistido na Devoteca.');assert.match(download.headers.get('content-disposition'),/attachment/);
 const invalid=new FormData();invalid.set('title','HTML bloqueado');invalid.set('type','document');invalid.set('file',new File(['<script></script>'],'arquivo.html'));await call('/api/files',{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-Devoteca-Metadata':encodeURIComponent(JSON.stringify({title:'HTML bloqueado',type:'document',fileName:'arquivo.html'}))},body:'<script></script>'},'alice',400);
 await call('/api/categories?id='+c.id,{method:'DELETE'},'admin',400);
 await call('/api/library?id='+r.id,{method:'DELETE'});ids.splice(ids.indexOf(r.id),1);
 assert.equal((await call('/api/comments?id='+r.id)).length,0);
 await call('/api/library',json({id:r.id,action:'favorite',value:true},'PATCH'),'alice',404);
 console.log('PASS: login, persistent CRUD, duplicates, URL validation, author permissions, private favorites/progress, comments, cascade deletion, origin protection, upload/download and blocked file formats.');
}finally{
 for(const id of ids)await call('/api/library?id='+id,{method:'DELETE'},'admin').catch(e=>console.error('cleanup resource',e.message));
 for(const id of cats)await call('/api/categories?id='+id,{method:'DELETE'},'admin').catch(e=>console.error('cleanup category',e.message));
}
