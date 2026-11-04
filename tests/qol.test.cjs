const test = require('node:test');
const assert = require('node:assert/strict');
const {loadTypeScript,player} = require('./load-typescript.cjs');
const {friendlyError} = loadTypeScript('src/lib/feedback.ts');
const {suggestedPlayers} = loadTypeScript('src/lib/playerSuggestions.ts');
const {getMatchCardTone} = loadTypeScript('src/lib/matchCardTone.ts');

test('backend errors become explanations without raw SQL details',()=>{
  assert.match(friendlyError({message:'DELETE requires a WHERE clause'}),/Schutz der Daten/);
  assert.match(friendlyError(new Error('Failed to fetch')),/Internetverbindung/);
  assert.match(friendlyError({message:'permission denied for table profiles'}),/keine Berechtigung/);
  assert.match(friendlyError({message:'JWT expired'}),/erneut anmelden/);
  assert.match(friendlyError({message:'Invalid player details'}),/Profildaten sind ungültig/);
  assert.match(friendlyError('violates foreign key constraint'),/verknüpft/);
  assert.equal(friendlyError('syntax error at or near secret_table','Speichern fehlgeschlagen.'),'Speichern fehlgeschlagen.');
  assert.equal(friendlyError('Der eigene Account und Owner-Profile dürfen nicht gelöscht werden.'),
    'Der eigene Account und Owner-Profile dürfen nicht gelöscht werden.');
});
test('suggestions distinguish partners/opponents and prioritize recent play deterministically',()=>{
  const players=['old','new','partner','unused'].map(id=>player(id));
  const game=(date,teamA,teamB,status='confirmed')=>({date,teamA,teamB,status});
  const matches=[
    game('2026-10-01',['me'],['old']),game('2026-10-02',['me'],['old']),
    game('2026-11-01',['new'],['me']),
    game('2026-11-02',['me','partner'],['new','old']),
    game('2026-11-03',['me'],['unused'],'cancelled'),
    game('2026-11-04',['unused'],['old']),
  ];
  const opponents=suggestedPlayers(players,matches,'me',false);
  assert.deepEqual(Array.from(opponents,e=>e.player.id),['old','new','partner','unused']);
  assert.equal(opponents[0].count,3);
  assert.equal(opponents[1].count,2);
  assert.deepEqual(Array.from(suggestedPlayers(players,matches,'me',true),e=>e.player.id),
    ['partner','new','old','unused']);
  assert.deepEqual(Array.from(suggestedPlayers([...players].reverse(),[...matches].reverse(),'me',false),e=>e.player.id),
    Array.from(opponents,e=>e.player.id));
});
test('match card colors reflect confirmation, problems and cancellation states',()=>{
  const base={status:'pending'};
  assert.equal(getMatchCardTone({...base,status:'confirmed'}),'match-card-confirmed');
  assert.equal(getMatchCardTone({...base,status:'disputed'}),'match-card-problem');
  assert.equal(getMatchCardTone({...base,cancellationRequestedBy:'opponent'}),'match-card-problem');
  assert.equal(getMatchCardTone({...base,status:'cancelled',cancellationRequestedBy:undefined}),'match-card-cancelled');
  assert.equal(getMatchCardTone(base),'match-card-pending');
});
function component(file,store) {
  const elements=[];
  const react={createElement:(type,props,...children)=>{
    const result={type,props:props||{},children};elements.push(result);return result;
  }};
  const loaded=loadTypeScript(file,{react,'@/lib/store':{useStore:()=>store}});
  Object.values(loaded)[0]({onOpen:()=>{store.opened=true;}});
  const text=elements.flatMap(e=>e.children.filter(c=>typeof c==='string')).join(' ');
  return {elements,text};
}
test('sync status distinguishes offline, last successful refresh and demo mode',()=>{
  const offline=component('src/components/SyncStatus.tsx',{isConnected:true,isOnline:false});
  assert.match(offline.text,/Offline/);
  assert.equal(offline.elements.find(e=>e.type==='button').props.disabled,true);
  const connected=component('src/components/SyncStatus.tsx',{
    isConnected:true,isOnline:true,isRefreshing:false,lastSyncedAt:'2026-11-03T10:00:00Z',refreshState:()=>{},
  });
  assert.match(connected.text,/Zuletzt aktualisiert/);
  assert.equal(connected.elements.find(e=>e.type==='button').props.disabled,false);
  const demo=component('src/components/SyncStatus.tsx',{isConnected:false,isOnline:true});
  assert.match(demo.text,/Demomodus/);
  assert.equal(demo.elements.some(e=>e.type==='button'),false);
});
test('reminders count actionable opponent proposals and unseen results, not own proposals',()=>{
  const base={id:'a',teamA:['me'],teamB:['other'],confirmedBy:[],status:'confirmed'};
  const store={currentUser:player('me'),matches:[
    base,{...base,id:'b',status:'disputed',disputeProposedBy:'other',disputeProposedScoreA:10,disputeProposedScoreB:5},
    {...base,id:'c',status:'disputed',disputeProposedBy:'me',disputeProposedScoreA:10,disputeProposedScoreB:5},
    {...base,id:'d',status:'cancelled'},
    {...base,id:'e',confirmedBy:['me'],cancellationRequestedBy:'other'},
    {...base,id:'f',tournamentId:'t'},
  ]};
  const result=component('src/components/ClarificationReminder.tsx',store);
  assert.match(result.text,/1 ungesehene Ergebnisse/);
  assert.match(result.text,/1 Gegenvorschläge zur Annahme/);
  assert.match(result.text,/1 Streichungsanfragen/);
  result.elements.find(e=>e.type==='button').props.onClick();
  assert.equal(store.opened,true);
});
test('failed admin actions show a translated error and retry the same action explicitly',async()=>{
  const slots=[],elements=[];
  let cursor=0,calls=0;
  const react={
    createElement:(type,props,...children)=>{const e={type,props:props||{},children};elements.push(e);return e;},
    useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=initial;
      return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},
    useRef:initial=>{const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useEffect:()=>{cursor++;},
  };
  const {AdminView}=loadTypeScript('src/components/AdminView.tsx',{
    react,'./AuditLog':{AuditLog:()=>null},
    '@/lib/store':{useStore:()=>({
      currentUser:player('owner','owner'),players:[player('owner','owner'),player('target')],
      matches:[],inviteCodes:[],whitelist:[],
      deletePlayer:async()=>{
        calls++;
        return calls===1?{success:false,message:'DELETE requires a WHERE clause'}:{success:true,message:'Spieler gelöscht.'};
      },
    })},
  },{window:{confirm:()=>true},setTimeout:()=>0,clearTimeout:()=>{}});
  const render=()=>{cursor=0;elements.length=0;AdminView();};
  render();
  elements.find(e=>e.type==='button'&&e.props['aria-label']==='target löschen').props.onClick();
  await new Promise(resolve=>setTimeout(resolve,0));
  render();
  const text=elements.flatMap(e=>e.children.filter(c=>typeof c==='string')).join(' ');
  assert.match(text,/Schutz der Daten/);
  assert.doesNotMatch(text,/DELETE requires/);
  const retry=elements.find(e=>e.type==='button'&&e.children.includes('Erneut versuchen'));
  assert.ok(retry);
  retry.props.onClick();
  await new Promise(resolve=>setTimeout(resolve,0));
  render();
  assert.equal(calls,2);
  assert.equal(elements.some(e=>e.type==='button'&&e.children.includes('Erneut versuchen')),false);
});
