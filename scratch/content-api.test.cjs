const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.CONTENT_TEST_BASE || 'http://127.0.0.1:8081/content-api.php';
let cookie = '', state;
async function call(path='', body, authenticated=true) {
  const response = await fetch(base+path, {method:body?'POST':'GET',headers:{...(authenticated&&cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const set = response.headers.get('set-cookie'); if(set)cookie=set.split(';')[0];
  return {code:response.status,...await response.json()};
}
async function reload(){const result=await call('?admin=1');assert.equal(result.status,'success');state=result;return result.data;}
async function mutate(payload){return call('',{csrf:state.csrf,version:state.version,...payload});}
(async()=>{
  assert.equal((await call('?admin=1',undefined,false)).code,401);
  assert.equal((await call('',{action:'save',group:'products',item:{name:'No auth'}},false)).code,401);
  const publicData=await call();assert.equal(publicData.data.news.length,3);
  const login=await call('?action=login',{email:'cms-test@localhost',password:'local-integration-test-only'});assert.equal(login.status,'success');
  await reload();
  assert.equal((await call('',{action:'save',group:'products',item:{name:'No CSRF'}})).code,403);
  for(const group of ['products','experts','merchants','news','hero']){
    const item={id:'integration-'+group,name:'Integration test',description:'Test description',accent:'Blue headline',image:'',url:'https://example.com',date:'2026-11-06',order:99,published:false};
    assert.equal((await mutate({action:'save',group,item})).status,'success');
    let admin=await reload();assert.ok(admin[group].some(row=>row.id===item.id));if(group==='hero')assert.equal(admin[group].find(row=>row.id===item.id).accent,'Blue headline');
    assert.ok(!(await call()).data[group].some(row=>row.id===item.id));
    const stale=state.version;
    item.published=true;item.name='Updated '+group;
    assert.equal((await mutate({action:'save',group,item})).status,'success');
    assert.equal((await call('',{csrf:state.csrf,version:stale,action:'save',group,item})).code,409);
    await reload();assert.ok((await call()).data[group].some(row=>row.name===item.name));
    assert.equal((await mutate({action:'save',group,item:{...item,url:'javascript:alert(1)'}})).code,400);
    assert.equal((await mutate({action:'delete',group,item:{id:item.id}})).status,'success');await reload();
  }
  assert.equal((await mutate({action:'save',group:'news',item:{name:'Bad date',date:'2026-02-31'}})).code,400);
  assert.equal((await mutate({action:'save',group:'products',item:{name:'Bad upload'},file:{base64:Buffer.from('<?php echo 1;').toString('base64')}})).code,400);
  const image=fs.readFileSync('asset/logo/favicon-16x16.png').toString('base64');
  assert.equal((await mutate({action:'save',group:'products',item:{id:'integration-image',name:'Image test',published:true},file:{base64:image}})).status,'success');
  const uploaded=(await reload()).products.find(row=>row.id==='integration-image').image;
  assert.ok(uploaded.startsWith('uploads/content/'));assert.ok(fs.existsSync(uploaded));
  await mutate({action:'delete',group:'products',item:{id:'integration-image'}});await reload();fs.unlinkSync(uploaded);
  assert.equal((await fetch(new URL('content-data/store.json',base))).status,403);
  assert.equal((await mutate({action:'logout'})).status,'success');
  assert.equal((await call('?admin=1')).code,401);
  console.log('Passed: authentication, CSRF, five-group CRUD including Hero, drafts, publication, conflict prevention, URL/date/upload validation, image upload, protected storage, logout.');
})().catch(error=>{console.error(error);process.exitCode=1;});
