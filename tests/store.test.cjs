const test = require('node:test');
const assert = require('node:assert/strict');
const {loadTypeScript, player} = require('./load-typescript.cjs');

function harness(client = null, persisted) {
  const slots = [], effects = [];
  let cursor = 0, first = true;
  const react = {
    createContext: () => ({Provider:'provider'}), useContext:()=>null,
    createElement: (_type, props) => ({props}),
    useState: (initial) => {const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
    useRef: (value) => {const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];},
    useCallback: (fn) => {const i=cursor++;if(!(i in slots))slots[i]=fn;return slots[i];},
    useEffect: (fn) => {cursor++;if(first)effects.push(fn);},
  };
  const storage = {getItem:()=>persisted?JSON.stringify(persisted):null,setItem:()=>{},removeItem:()=>{}};
  const store=loadTypeScript('src/lib/store.tsx',{react,'./supabaseClient':{supabase:client}},
    {localStorage:storage,document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},
      window:{addEventListener(){},removeEventListener(){}},setInterval:()=>0,clearInterval:()=>{}});
  const render=()=>{cursor=0;const api=store.StoreProvider({children:null}).props.value;first=false;return api;};
  render();
  return {render,hydrate:async()=>{effects.forEach(fn=>fn());await new Promise(resolve=>setTimeout(resolve,20));}};
}
function builder(response) {
  const result={then:(resolve,reject)=>Promise.resolve(response).then(resolve,reject)};
  for(const name of ['select','order','range','returns','single','maybeSingle'])result[name]=()=>result;
  return result;
}
function row(p) {
  return {id:p.id,name:p.name,avatar:p.avatar,email:p.email,year_joined:p.yearJoined,
    level:p.level,xp:p.xp,xp_next_level:p.xpNextLevel,elo_1v1:p.elo1v1,elo_2v2:p.elo2v2,
    elo_total:p.eloTotal,league_points:p.leaguePoints,wins_1v1:p.wins1v1,losses_1v1:p.losses1v1,
    wins_2v2:p.wins2v2,losses_2v2:p.losses2v2,current_streak:p.currentStreak,best_rank:p.bestRank,
    role:p.role,is_suspended:false,badges:[],elo_history:[]};
}
test('offline mutual cancellation requires opponent and rebuilds final statistics', async()=>{
  const h=harness(null,{players:[player('a'),player('b')],matches:[],tournaments:[],currentUserId:'a'});
  await h.hydrate();let api=h.render();
  const result=await api.submitMatch({mode:'1v1',teamA:['a'],teamB:['b'],scoreA:10,scoreB:5});
  assert.ok(result.success);api=h.render();
  assert.ok((await api.cancelMatchByMutualAgreement(result.matchId)).success);
  api=h.render();assert.equal(api.players[0].wins1v1,1);
  assert.equal(api.matches[0].cancellationRequestedBy,'a');
  api.switchUser('b');api=h.render();assert.ok((await api.cancelMatchByMutualAgreement(result.matchId)).success);
  api=h.render();assert.equal(api.players[0].wins1v1,0);assert.equal(api.players[0].xp,0);
  assert.equal(api.matches[0].status,'cancelled');
});
test('connected state paginates public profiles without private identity columns',async()=>{
  const data=Array.from({length:1001},(_,i)=>row(player(`p${i}`)));
  let pages=0;
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:'p0'}}},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    rpc:()=>builder({data:data[0],error:null}),
    from:(table)=>{
      let start=0,end=249;const query=builder({data:[],error:null});
      query.select=(columns)=>{if(table==='profiles')assert.ok(!columns.includes('email')&&!columns.includes('auth_user_id'));return query;};
      query.range=(a,b)=>{start=a;end=b;return query;};
      query.then=(resolve,reject)=>{
        if(table==='profiles')pages++;
        return Promise.resolve({data:table==='profiles'?data.slice(start,end+1):[],error:null}).then(resolve,reject);
      };
      return query;
    },
  };
  const h=harness(client);await h.hydrate();
  assert.equal(h.render().players.length,1001);assert.equal(pages,5);assert.equal(h.render().currentUser.id,'p0');
});
test('server mutation failures are returned and do not fabricate local tournaments',async()=>{
  const p=row(player('admin','admin'));
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:'admin'}}},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    rpc:(name)=>builder(name==='get_my_profile'?{data:p,error:null}:{data:null,error:{message:'Synthetic denied'}}),
    from:(table)=>builder({data:table==='profiles'?[p]:[],error:null}),
  };
  const h=harness(client);await h.hydrate();
  const result=await h.render().createTournament({name:'Doubles',description:'',mode:'2v2',type:'ko',teams:[]});
  assert.equal(result.success,false);assert.match(result.message,/denied/);assert.equal(h.render().tournaments.length,0);
});
test('admin corrections use the correct RPC action and block duplicate concurrent writes',async()=>{
  const p=row(player('admin','admin'));
  const calls=[];
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:'admin'}}},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    rpc:(name,params)=>{
      if(name==='get_my_profile')return builder({data:p,error:null});
      calls.push({name,params});
      const response=builder({});
      response.then=(resolve,reject)=>pending.then(resolve,reject);
      return response;
    },
    from:(table)=>builder({data:table==='profiles'?[p]:[],error:null}),
  };
  const h=harness(client);await h.hydrate();const api=h.render();
  const first=api.adminResolveDispute('game','confirm',5,10);
  const duplicate=await api.adminResolveDispute('game','confirm',5,10);
  assert.equal(duplicate.success,false);
  assert.equal(calls.length,1);
  assert.equal(calls[0].params.p_action,'correct');
  assert.equal(calls[0].params.p_score_a,5);
  release({data:null,error:null});assert.equal((await first).success,true);
});
test('logout prevents an in-flight refresh from restoring another session data',async()=>{
  const p=row(player('a'));
  let block=false,release;
  const pending=new Promise(resolve=>{release=resolve;});
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:'a'}}},error:null}),
      signOut:async()=>({error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    rpc:()=>builder({data:p,error:null}),
    from:(table)=>{
      const query=builder({data:table==='profiles'?[p]:[],error:null});
      if(table==='profiles'&&block)query.then=(resolve,reject)=>pending.then(resolve,reject);
      return query;
    },
  };
  const h=harness(client);await h.hydrate();const api=h.render();
  assert.equal(api.currentUser.id,'a');
  block=true;const refresh=api.refreshState();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal((await api.logout()).success,true);
  release({data:[p],error:null});await refresh;
  assert.equal(h.render().currentUser,null);
  assert.equal(h.render().players.length,0);
  assert.equal(h.render().matches.length,0);
});
