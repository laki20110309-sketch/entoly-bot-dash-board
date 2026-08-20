const activities=[{icon:'＋',tone:'blue',title:'Nova Esports がエントリーしました',detail:'SQUAD / チームチャンネルを作成',time:'2分前'},{icon:'◈',tone:'purple',title:'VC参加ロールを更新しました',detail:'@voice-active を対象VCに設定',time:'18分前'},{icon:'✓',tone:'green',title:'Pulse Gaming の認証が完了しました',detail:'代表者ロールを付与',time:'34分前'},{icon:'＋',tone:'blue',title:'Rift Walkers がエントリーしました',detail:'TRIO / チームチャンネルを作成',time:'1時間前'}];
const pageMeta={overview:['OVERVIEW','おかえりなさい、運営さん。','大会の受付状況とボットの状態を確認できます。'],entry:['ENTRY CONFIGURATION','エントリー設定','大会の受付ルールをサーバーごとに管理します。'],roles:['ROLE MANAGEMENT','ロール管理','エントリー時とVC参加時のロール付与をまとめて設定します。'],channels:['CHANNELS & TEAMS','チャンネル管理','ボットが作成した大会用チャンネルだけを安全に確認・削除できます。'],activity:['AUDIT LOG','アクティビティ','設定変更やチーム作成の履歴を確認できます。']};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];let activeGuildId=sessionStorage.getItem('entryBotGuildId')||'';

function showToast(text){const toast=$('#toast');toast.textContent=text;toast.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>toast.classList.remove('show'),2600)}
function renderActivities(){const markup=activities.map(a=>`<div class="activity-item"><span class="activity-icon ${a.tone}">${a.icon}</span><div><strong>${a.title}</strong><small>${a.detail}</small></div><span class="activity-time">${a.time}</span></div>`).join('');$('#activityList').innerHTML=markup;$('#activityTimeline').innerHTML=activities.map(a=>`<div class="timeline-entry"><span class="timeline-mark"></span><div><strong>${a.title}</strong><p>${a.detail}</p></div><time>${a.time}</time></div>`).join('')}
function setView(view){$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));$$('.content-wrap').forEach(s=>s.classList.add('hidden'));$(`#view-${view}`).classList.remove('hidden');const meta=pageMeta[view]||pageMeta.overview;$('#breadcrumbView').textContent=meta[0];$('#pageTitle').textContent=meta[1];$('#pageSubtitle').textContent=meta[2];window.scrollTo({top:0,behavior:'smooth'})}
function openReset(){ $('#resetModal').classList.remove('hidden') }function closeReset(){ $('#resetModal').classList.add('hidden') }

$$('.nav-item').forEach(n=>n.addEventListener('click',()=>setView(n.dataset.view)));
$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.jump)));
$$('[data-action="reset"]').forEach(b=>b.addEventListener('click',openReset));
$$('[data-action="vc"]').forEach(b=>b.addEventListener('click',()=>{setView('roles');showToast('VCロール設定を開きました')}));

$('#cancelReset').addEventListener('click',closeReset);
$('#resetModal').addEventListener('click',e=>{if(e.target.id==='resetModal')closeReset()});
$('#confirmReset').addEventListener('click',async()=>{
    closeReset();
    if(!await ensureConnection())return;
    try{
        await EntryBotApi.request(`/api/guilds/${activeGuildId}/reset`,{method:'POST'});
        showToast('VPS側の設定を初期化しました');
        setTimeout(()=>setView('overview'),300);
    }catch(error){showToast('リセットに失敗しました')}
});

$('#refreshButton').addEventListener('click',async()=>{
    if(!await ensureConnection())return;
    try{
        const data=await EntryBotApi.request(`/api/guilds/${activeGuildId}/settings`);
        const enabled=Boolean(data.settings?.entryEnabled);
        $('#entryToggle').checked=enabled;
        showToast('VPSから最新設定を読み込みました');
        $('#refreshButton').textContent='✓　同期済み';
        setTimeout(()=>$('#refreshButton').textContent='↻　同期する',1800);
    }catch(error){showToast('同期に失敗しました')}
});

$('#saveEntry').addEventListener('click',async()=>{
    if(!await ensureConnection())return;
    const formats=['solo','duo','trio','squad'].filter((_,i)=>$('.format-option:nth-child('+(i+1)+') input')?.checked);
    try{
        await EntryBotApi.request(`/api/guilds/${activeGuildId}/settings`,{method:'PATCH',body:JSON.stringify({entryEnabled:$('#entryToggle').checked,allowedEntryTypes:formats})});
        showToast('エントリー設定をVPSへ保存しました');
    }catch(error){showToast('保存に失敗しました')}
});

$('#saveRoles').addEventListener('click',()=>showToast('ロール設定を保存しました'));
$('#deleteTeams').addEventListener('click',async()=>{
    if(!confirm('このサーバーでボットが作成したチームチャンネルだけを削除します。続行しますか？'))return;
    if(!await ensureConnection())return;
    try{
        const result=await EntryBotApi.request(`/api/guilds/${activeGuildId}/delete-teams`,{method:'POST'});
        showToast(`${result.deletedCount||0}個のチーム関連アイテムを削除しました`);
    }catch(error){showToast('一括削除に失敗しました')}
});

$('#clearActivity').addEventListener('click',()=>{activities.length=0;renderActivities();showToast('アクティビティログをクリアしました')});
$('#entryToggle').addEventListener('change',e=>{
    const label=document.querySelector('#view-entry .view-heading .status-badge');
    label.textContent=e.target.checked?'受付中':'終了';
    label.classList.toggle('on',e.target.checked);
    showToast(e.target.checked?'エントリー受付を開始しました':'エントリー受付を終了しました');
});
$$('.format-option input').forEach(input=>input.addEventListener('change',e=>e.target.closest('.format-option').classList.toggle('selected',e.target.checked)));
$$('.tag button').forEach(b=>b.addEventListener('click',()=>b.closest('.tag').remove()));
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeReset()});
renderActivities();

// ---------------------------------------------------------------------------
// Discord OAuth2 & VPS API Client
// ---------------------------------------------------------------------------
const OAUTH_STATE_KEY='entryBotOAuthState';

function escapeHtml(value=''){
    return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function createOAuthState(){
    const bytes=new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function getAvatarUrl(user){
    if(user?.avatar&&user?.id){
        return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=128`;
    }
    const index=user?.id?Number(BigInt(user.id)%5n):0;
    return `https://cdn.discordapp.com/embed/avatars/${Number.isFinite(index)?index:0}.png`;
}

function renderLoggedOutUser(){
    $('#userAvatar').textContent='D';
    $('#userInfo').innerHTML='<strong>Discordでログイン</strong><small>管理画面へ接続</small>';
    if($('#topUserAvatar')){$('#topUserAvatar').textContent='D';$('#topUserAvatar').classList.remove('has-image')}
    if($('#topUserName'))$('#topUserName').textContent='Discordでログイン';
    if($('#topUserTag'))$('#topUserTag').textContent='管理画面へ接続';
}

function renderAvatar(element, user){
    if(!element)return;
    const url=getAvatarUrl(user);
    element.innerHTML=`<img src="${url}" alt="" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`;
    element.classList.add('has-image');
}

function renderAuthenticatedUser(user){
    const displayName=user?.globalName||user?.username||'Discordユーザー';
    const tag=user?.username?`@${user.username}`:'Discordログイン中';
    $('#userInfo').innerHTML=`<strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(tag)}</small>`;
    renderAvatar($('#userAvatar'),user);
    if($('#topUserName'))$('#topUserName').textContent=displayName;
    if($('#topUserTag'))$('#topUserTag').textContent=tag;
    renderAvatar($('#topUserAvatar'),user);
}

window.EntryBotApi={
    baseUrl:localStorage.getItem('entryBotApiUrl')||'',
    token:'',
    user:null,
    guilds:[],
    configure({baseUrl,token}={}){
        this.baseUrl=(baseUrl||'').trim().replace(/\/$/,'');
        this.token=token||'';
        if(baseUrl)localStorage.setItem('entryBotApiUrl',this.baseUrl);
    },
    async request(path,options={}){
        if(!this.baseUrl)throw new Error('API未接続');
        const res=await fetch(`${this.baseUrl}${path}`,{
            ...options,
            headers:{
                'Content-Type':'application/json',
                'bypass-tunnel-reminder':'true',
                ...(this.token?{Authorization:`Bearer ${this.token}`}:{})
            }
        });
        if(!res.ok)throw new Error(`API ${res.status}`);
        return res.json();
    },
    async getOAuthConfig(){
        const data=await this.request('/api/auth/config');
        if(!data.clientId)throw new Error('VPS側にDiscord Client IDが設定されていません');
        return data;
    },
    async loginWithDiscord(code){
        const res=await fetch(`${this.baseUrl}/api/auth/discord`,{
            method:'POST',
            headers:{
                'Content-Type':'application/json',
                'bypass-tunnel-reminder':'true'
            },
            body:JSON.stringify({code})
        });
        const data=await res.json();
        if(!res.ok||!data.success)throw new Error(data.error||`API ${res.status}`);
        this.token=data.sessionToken;
        this.user=data.user;
        this.guilds=data.guilds||[];
        return data;
    }
};

async function getApiBaseUrl(){
    let baseUrl=EntryBotApi.baseUrl||localStorage.getItem('entryBotApiUrl')||'';
    if(!baseUrl){
        baseUrl=prompt('最初の1回だけ、VPS APIのURLを入力してください（例: https://xxxx.loca.lt）');
    }
    if(!baseUrl)return '';
    EntryBotApi.configure({baseUrl});
    return EntryBotApi.baseUrl;
}

async function startDiscordLogin(){
    try{
        if(!await getApiBaseUrl())return;
        showToast('Discordログインを準備中...');
        const config=await EntryBotApi.getOAuthConfig();
        const redirectUri=config.redirectUri||`${window.location.origin}${window.location.pathname}`;
        const state=createOAuthState();
        sessionStorage.setItem(OAUTH_STATE_KEY,state);
        const authUrl=new URL('https://discord.com/oauth2/authorize');
        authUrl.searchParams.set('client_id',config.clientId);
        authUrl.searchParams.set('redirect_uri',redirectUri);
        authUrl.searchParams.set('response_type','code');
        authUrl.searchParams.set('scope','identify guilds');
        authUrl.searchParams.set('state',state);
        window.location.assign(authUrl.toString());
    }catch(error){
        console.error(error);
        showToast(`ログイン準備に失敗しました: ${error.message}`);
    }
}

async function initOAuth2(){
    renderLoggedOutUser();
    const urlParams=new URLSearchParams(window.location.search);
    const code=urlParams.get('code');
    const returnedState=urlParams.get('state');
    const savedAuth=sessionStorage.getItem('entryBotAuth');
    const baseUrl=await getApiBaseUrlForCallback(code);

    if(code&&baseUrl){
        try{
            const expectedState=sessionStorage.getItem(OAUTH_STATE_KEY);
            if(expectedState&&returnedState!==expectedState)throw new Error('OAuth stateが一致しません');
            sessionStorage.removeItem(OAUTH_STATE_KEY);
            showToast('Discord認証中...');
            const data=await EntryBotApi.loginWithDiscord(code);
            sessionStorage.setItem('entryBotAuth',JSON.stringify(data));
            window.history.replaceState({},document.title,window.location.pathname);
            setupUserSession(data);
            showToast('Discordログイン成功！');
        }catch(error){
            console.error(error);
            showToast(`ログインに失敗しました: ${error.message}`);
        }
    }else if(savedAuth){
        try{setupUserSession(JSON.parse(savedAuth))}catch(error){sessionStorage.removeItem('entryBotAuth')}
    }
}

async function getApiBaseUrlForCallback(code){
    if(EntryBotApi.baseUrl)return EntryBotApi.baseUrl;
    if(!code)return '';
    return getApiBaseUrl();
}

function setupUserSession(data){
    EntryBotApi.user=data.user||null;
    EntryBotApi.guilds=data.guilds||[];
    EntryBotApi.token=data.sessionToken||'';
    if(data.user)renderAuthenticatedUser(data.user);
    if(EntryBotApi.guilds.length>0){
        const savedGid=sessionStorage.getItem('entryBotGuildId');
        const target=EntryBotApi.guilds.find(g=>g.id===savedGid)||EntryBotApi.guilds[0];
        activeGuildId=target.id;
        sessionStorage.setItem('entryBotGuildId',target.id);
        $('#serverName').textContent=target.name;
    }else{
        $('#serverName').textContent='管理権限のあるサーバーがありません';
    }
}

async function handleUserButtonClick(){
    if(EntryBotApi.token){
        if(confirm('Discordからログアウトしますか？')){
            EntryBotApi.token='';EntryBotApi.user=null;EntryBotApi.guilds=[];activeGuildId='';
            sessionStorage.removeItem('entryBotAuth');sessionStorage.removeItem('entryBotGuildId');
            $('#serverName').textContent='サーバーを選択';
            renderLoggedOutUser();
            showToast('ログアウトしました');
        }
        return;
    }
    await startDiscordLogin();
}

$('#userButton').addEventListener('click',handleUserButtonClick);
$('#topUser')?.addEventListener('click',handleUserButtonClick);

$('#serverButton').addEventListener('click',()=>{
    if(!EntryBotApi.guilds||EntryBotApi.guilds.length===0){
        showToast('先にDiscordでログインしてください');
        return;
    }
    const names=EntryBotApi.guilds.map((g,i)=>`${i+1}: ${g.name}`).join('\n');
    const sel=prompt(`管理するサーバーを選んでください（番号を入力）:\n${names}`);
    const idx=parseInt(sel)-1;
    if(EntryBotApi.guilds[idx]){
        const chosen=EntryBotApi.guilds[idx];
        activeGuildId=chosen.id;
        sessionStorage.setItem('entryBotGuildId',chosen.id);
        $('#serverName').textContent=chosen.name;
        showToast(`${chosen.name} に切り替えました`);
        $('#refreshButton').click();
    }
});

async function ensureConnection(){
    if(EntryBotApi.baseUrl&&activeGuildId&&EntryBotApi.token)return true;
    showToast('Discordでログインして、管理するサーバーを選択してください');
    return false;
}

initOAuth2();
