const test = require('node:test');
const assert = require('node:assert/strict');
const {loadTypeScript, player} = require('./load-typescript.cjs');

function harness(client = null, persisted) {
  const slots = [], effects = [];
  const listeners = new Map();
  const navigator={onLine:true};
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
      navigator,window:{
        addEventListener:(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]),
        removeEventListener(){},
      },setInterval:()=>0,clearInterval:()=>{}});
  const render=()=>{cursor=0;const api=store.StoreProvider({children:null}).props.value;first=false;return api;};
  render();
  return {render,emit:async(name)=>{
    navigator.onLine=name!=='offline';
    (listeners.get(name)||[]).forEach(fn=>fn());
    await new Promise(resolve=>setTimeout(resolve,20));
  },hydrate:async()=>{effects.forEach(fn=>fn());await new Promise(resolve=>setTimeout(resolve,20));}};
}
function builder(response) {
  const result={then:(resolve,reject)=>Promise.resolve(response).then(resolve,reject)};
  for(const name of ['select','order','range','returns','single','maybeSingle'])result[name]=()=>result;
  return result;
}
function row(p) {
  return {id:p.id,name:p.name,avatar:p.avatar,bio:p.bio||'',email:p.email,year_joined:p.yearJoined,
    is_external:p.isExternal ?? false,
    level:p.level,xp:p.xp,xp_next_level:p.xpNextLevel,elo_1v1:p.elo1v1,elo_2v2:p.elo2v2,
    elo_total:p.eloTotal,league_points:p.leaguePoints,wins_1v1:p.wins1v1,losses_1v1:p.losses1v1,
    wins_2v2:p.wins2v2,losses_2v2:p.losses2v2,current_streak:p.currentStreak,best_rank:p.bestRank,
    role:p.role,is_suspended:Boolean(p.isSuspended),is_deleted:Boolean(p.isDeleted),badges:[],elo_history:[]};
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
test('offline match submission rejects scores above the UI limit', async()=>{
  const h=harness(null,{players:[player('a'),player('b')],matches:[],tournaments:[],currentUserId:'a'});
  await h.hydrate();
  const result=await h.render().submitMatch({mode:'1v1',teamA:['a'],teamB:['b'],scoreA:11,scoreB:5});
  assert.equal(result.success,false);
  assert.match(result.message,/0 und 10/);
  assert.equal(h.render().matches.length,0);
});
test('offline player deletion allows owner and co-owner but protects self and owners', async()=>{
  for(const role of ['owner','co_owner','admin','organiser','player']){
    const h=harness(null,{players:[player('actor',role),player('target'),player('owner','owner')],
      matches:[],tournaments:[],currentUserId:'actor'});
    await h.hydrate();
    assert.equal((await h.render().deletePlayer('actor')).success,false);
    assert.equal((await h.render().deletePlayer('owner')).success,false);
    const result=await h.render().deletePlayer('target');
    const allowed=['owner','co_owner'].includes(role);
    assert.equal(result.success,allowed);
    assert.equal(Boolean(h.render().players.find(p=>p.id==='target').isDeleted),allowed);
    assert.equal(h.render().currentUser.id,'actor');
  }
});
test('offline player deletion anonymizes historical players without changing results', async()=>{
  const match={id:'game',mode:'1v1',teamA:['actor'],teamB:['target'],scoreA:10,scoreB:5,
    creatorId:'actor',confirmedBy:[],status:'cancelled',resultApplied:false,date:'2026-11-03'};
  for(const data of [
    {matches:[match],tournaments:[]},
    {matches:[],tournaments:[{id:'t',participants:['target'],matches:[]}]},
    {matches:[],tournaments:[{id:'t',participants:[],teams:[{id:'team',playerIds:['target']}],matches:[]}]},
  ]){
    const h=harness(null,{players:[player('actor','co_owner'),player('target')],currentUserId:'actor',...data});
    await h.hydrate();
    const result=await h.render().deletePlayer('target');
    assert.equal(result.success,true);
    const deleted=h.render().players.find(p=>p.id==='target');
    assert.equal(deleted.isDeleted,true);
    assert.equal(deleted.isSuspended,true);
    assert.equal(deleted.email,'');
    assert.equal(deleted.bio,'');
    assert.match(deleted.name,/Gelöschter Spieler/);
    assert.equal(h.render().players.length,2);
    assert.equal(h.render().matches.length,data.matches.length);
    assert.equal(h.render().tournaments.length,data.tournaments.length);
    assert.equal((await h.render().setPlayerSuspension('target',false)).success,false);
    assert.equal(h.render().loginPlayer(deleted.name).success,false);
  }
});
test('connected player deletion uses the authorized RPC and retains state on failure', async()=>{
  for(const denied of [false,true]){
    const actor=row(player('actor','co_owner')),target=row(player('target'));
    const calls=[];
    const client={
      auth:{getSession:async()=>({data:{session:{user:{id:'actor'}}},error:null}),
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
      rpc:(name,params)=>{
        if(name==='get_my_profile')return builder({data:actor,error:null});
        calls.push({name,params});
        if(!denied){target.is_deleted=true;target.is_suspended=true;target.name='Gelöschter Spieler target';}
        return builder({data:null,error:denied?{message:'Deletion denied'}:null});
      },
      from:(table)=>builder({data:table==='profiles'?[actor,target]:[],error:null}),
    };
    const h=harness(client);await h.hydrate();
    const result=await h.render().deletePlayer('target');
    assert.equal(result.success,!denied);
    assert.equal(calls.length,1);
    assert.equal(calls[0].name,'delete_player');
    assert.equal(calls[0].params.p_player_id,'target');
    assert.equal(h.render().players.find(p=>p.id==='target').isDeleted,!denied);
    if(denied)assert.match(result.message,/keine Berechtigung/);
  }
});
test('deleting a scored opponent preserves replay and removes them from the current ranking', async()=>{
  const h=harness(null,{players:[player('actor','owner'),player('target')],matches:[],
    tournaments:[],currentUserId:'actor'});
  await h.hydrate();
  for(let i=0;i<3;i++){
    assert.equal((await h.render().submitMatch({mode:'1v1',teamA:['actor'],teamB:['target'],scoreA:10,scoreB:5})).success,true);
  }
  const before=h.render().players.find(p=>p.id==='actor');
  assert.equal((await h.render().deletePlayer('target')).success,true);
  const api=h.render();
  assert.equal(api.matches.length,3);
  assert.equal(api.players.find(p=>p.id==='actor').eloTotal,before.eloTotal);
  const {getQualifiedByElo}=loadTypeScript('src/lib/matchViews.ts',{'@/lib/store':{useStore:()=>api}});
  assert.deepEqual(Array.from(getQualifiedByElo(api.players),p=>p.id),['actor']);
  assert.equal((await api.acknowledgeMatch(api.matches[0].id)).success,true);
  assert.equal(h.render().players.find(p=>p.id==='actor').eloTotal,before.eloTotal);
  assert.equal(h.render().players.find(p=>p.id==='target').isDeleted,true);
});
test('admin deletion controls are limited to owner and co-owner and require confirmation', async()=>{
  for(const role of ['owner','co_owner','admin']){
    const actor=player('actor',role),target=player('target'),owner=player('owner','owner');
    const elements=[],deleted=[];
    let confirmed=false;
    const react={
      createElement:(type,props,...children)=>{
        const element={type,props:props||{},children};elements.push(element);return element;
      },
      useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{},
    };
    const {AdminView}=loadTypeScript('src/components/AdminView.tsx',{
      './AuditLog':{AuditLog:()=>null},
      react,'@/lib/store':{useStore:()=>({
        currentUser:actor,players:[actor,target,owner,{...player('deleted'),isDeleted:true,isSuspended:true}],matches:[],inviteCodes:[],whitelist:[],
        deletePlayer:async id=>{deleted.push(id);return {success:true,message:'Gelöscht'};},
      })},
    },{window:{confirm:()=>confirmed},setTimeout:()=>0,clearTimeout:()=>{}});
    AdminView();
    const buttons=elements.filter(e=>e.type==='button'&&e.props['aria-label']?.endsWith(' löschen'));
    assert.equal(buttons.length,role==='admin'?0:1);
    if(buttons.length){
      assert.equal(buttons[0].props['aria-label'],'target löschen');
      buttons[0].props.onClick();
      assert.equal(deleted.length,0);
      confirmed=true;
      buttons[0].props.onClick();
      await new Promise(resolve=>setTimeout(resolve,0));
      assert.deepEqual(deleted,['target']);
    }
  }
});
test('connected state paginates public profiles without private identity columns',async()=>{
  const data=Array.from({length:1001},(_,i)=>row(player(`p${i}`)));
  data[0].is_external=true;
  data[0].year_joined=null;
  let pages=0;
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:'p0'}}},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    rpc:()=>builder({data:data[0],error:null}),
    from:(table)=>{
      let start=0,end=249;const query=builder({data:[],error:null});
      query.select=(columns)=>{if(table==='profiles')assert.ok(!columns.includes('email')&&!columns.includes('auth_user_id')&&columns.includes('is_external')&&columns.includes('bio'));return query;};
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
  assert.equal(h.render().currentUser.isExternal,true);assert.equal(h.render().currentUser.yearJoined,null);
});
test('new authenticated users without a profile do not become null-name players',async()=>{
  const existing=row(player('existing'));
  const session={user:{id:'new',email:'new@example.com'}};
  for(const missing of [null,Object.fromEntries(Object.keys(existing).map(key=>[key,null]))]){
    const client={
      auth:{
        getSession:async()=>({data:{session},error:null}),
        verifyOtp:async()=>({data:{session},error:null}),
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
      },
      rpc:(name,params)=>{
        if(name==='create_player_profile'){
          assert.equal(params.p_year_joined,null);
          assert.equal('p_is_external' in params,false);
          own=row({...player('new'),isExternal:true,yearJoined:null});
          return builder({data:own,error:null});
        }
        return builder({data:own,error:null});
      },
      from:(table)=>builder({data:table==='profiles'?[existing]:[],error:null}),
    };
    let own=missing;
    const h=harness(client);await h.hydrate();
    assert.equal(h.render().currentUser,null);
    assert.equal(h.render().players.length,1);
    assert.equal(h.render().players[0].name.toLowerCase(),existing.name.toLowerCase());
    assert.equal(h.render().syncError,null);
    const result=await h.render().verifyCode(session.user.email,'123456');
    assert.equal(result.success,true);
    assert.equal(result.isExistingPlayer,false);
    assert.match(result.message,/erstelle dein Spielerprofil/);
    assert.equal(h.render().players.length,1);
    assert.equal(h.render().currentUser,null);
    const created=await h.render().completeProfileCreation({
      email:session.user.email,name:'new',avatar:'x',yearJoined:null,isExternal:true,
    });
    assert.equal(created.success,true);
    assert.equal(h.render().currentUser.id,'new');
    assert.equal(h.render().currentUser.isExternal,true);
    assert.equal(h.render().players.length,2);
  }
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
  assert.equal(result.success,false);assert.match(result.message,/keine Berechtigung/);assert.equal(h.render().tournaments.length,0);
});
test('players can update their own name and avatar locally with validation',async()=>{
  const h=harness(null,{players:[player('actor'),player('other')],matches:[],tournaments:[],currentUserId:'actor'});
  await h.hydrate();
  assert.equal((await h.render().updateOwnProfile({name:'  New Name  ',avatar:'🦁',bio:'  Hier für den Spaß  '})).success,true);
  assert.equal(h.render().currentUser.name,'New Name');
  assert.equal(h.render().currentUser.avatar,'🦁');
  assert.equal(h.render().currentUser.bio,'Hier für den Spaß');
  assert.equal((await h.render().updateOwnProfile({name:'Other',avatar:'⚽',bio:''})).success,false);
  assert.equal((await h.render().updateOwnProfile({name:'Valid',avatar:'not-an-avatar',bio:''})).success,false);
  assert.equal((await h.render().updateOwnProfile({name:'Valid',avatar:'⚽',bio:'x'.repeat(161)})).success,false);
  assert.equal(h.render().currentUser.name,'New Name');
});
test('connected profile updates use the own profile row and retain state on failure',async()=>{
  for(const denied of [false,true]){
    const own=row(player('actor')),calls=[];
    const client={
      auth:{getSession:async()=>({data:{session:{user:{id:'actor'}}},error:null}),
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
      rpc:(name)=>builder({data:own,error:null}),
      from:(table)=>{
        const query=builder({data:table==='profiles'?[own]:[],error:null});
        query.update=(values)=>{calls.push({table,values});if(!denied){own.name=values.name;own.avatar=values.avatar;own.bio=values.bio;}return query;};
        query.eq=(column,value)=>{calls.push({column,value});return builder({data:null,error:denied?{message:'Update denied'}:null});};
        return query;
      },
    };
    const h=harness(client);await h.hydrate();
    const result=await h.render().updateOwnProfile({name:'New Name',avatar:'🦁',bio:'Here to play'});
    assert.equal(result.success,!denied);
    assert.equal(calls.length,2);
    assert.equal(calls[0].table,'profiles');
    assert.equal(calls[0].values.name,'New Name');
    assert.equal(calls[0].values.avatar,'🦁');
    assert.equal(calls[0].values.bio,'Here to play');
    assert.equal(calls[1].column,'id');
    assert.equal(calls[1].value,'actor');
    assert.equal(h.render().currentUser.name,denied?'actor':'New Name');
    assert.equal(h.render().currentUser.avatar,denied?'x':'🦁');
    assert.equal(h.render().currentUser.bio||'',denied?'':'Here to play');
  }
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
test('sync timestamps only advance on successful loads and offline state is explicit',async()=>{
  const p=row(player('a'));
  let fail=false;
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:'a'}}},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    rpc:()=>builder({data:p,error:null}),
    from:table=>builder(fail&&table==='profiles'?{data:null,error:{message:'Failed to fetch'}}
      :{data:table==='profiles'?[p]:[],error:null}),
  };
  const h=harness(client);await h.hydrate();
  const first=h.render().lastSyncedAt;
  assert.ok(first);
  assert.equal(h.render().isRefreshing,false);
  fail=true;await h.render().refreshState();
  assert.equal(h.render().lastSyncedAt,first);
  assert.equal(h.render().players.length,1);
  assert.match(h.render().syncError,/Internetverbindung/);
  assert.equal(h.render().isRefreshing,false);
  await h.emit('offline');assert.equal(h.render().isOnline,false);
  fail=false;await h.emit('online');
  assert.equal(h.render().isOnline,true);
  assert.equal(h.render().syncError,null);
  assert.ok(h.render().lastSyncedAt>=first);
});
test('audit entries load only for administrators and recent reads are bounded',async()=>{
  for(const role of ['owner','co_owner','admin','player','organiser']){
    const p=row(player('a',role)),reads=[];
    const entry={id:'audit',created_at:'2026-11-03T10:00:00Z',actor_id:'a',actor_name:'a',
      action:'player_deleted',target_id:'b',before:{is_deleted:false},after:{is_deleted:true}};
    const client={
      auth:{getSession:async()=>({data:{session:{user:{id:'a'}}},error:null}),
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
      rpc:()=>builder({data:p,error:null}),
      from:table=>{
        const query=builder({data:table==='profiles'?[p]:table==='audit_log'?[entry]:[],error:null});
        if(table==='audit_log')query.range=(start,end)=>{reads.push({start,end});return query;};
        return query;
      },
    };
    const h=harness(client);await h.hydrate();
    const admin=['owner','co_owner','admin'].includes(role);
    assert.equal(h.render().auditEntries.length,admin?1:0);
    assert.equal(reads.length,admin?1:0);
    if(admin)assert.deepEqual(reads,[{start:0,end:99}]);
  }
});
test('local corrections, annulments and deletions record actor without phantom replay events',async()=>{
  const h=harness(null,{players:[player('actor','owner'),player('target')],matches:[],
    tournaments:[],currentUserId:'actor'});
  await h.hydrate();
  const {matchId}=await h.render().submitMatch({mode:'1v1',teamA:['actor'],teamB:['target'],scoreA:10,scoreB:5});
  assert.equal(h.render().auditEntries.length,0);
  await h.render().adminResolveDispute(matchId,'confirm',5,10);
  await h.render().adminResolveDispute(matchId,'confirm',5,10);
  await h.render().adminResolveDispute(matchId,'cancel');
  await h.render().deletePlayer('target');
  const entries=h.render().auditEntries;
  assert.equal(entries.length,3);
  assert.deepEqual(Array.from(entries,e=>e.action),['player_deleted','match_cancelled','score_corrected']);
  assert.ok(entries.every(e=>e.actorId==='actor'));
  assert.equal(entries[2].before.score_a,10);
  assert.equal(entries[2].after.score_a,5);
  h.render().switchUser('target');
  assert.equal(h.render().auditEntries.length,0);
});
