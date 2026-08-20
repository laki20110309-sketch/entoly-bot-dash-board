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
window.EntryBotApi={
    baseUrl:localStorage.getItem('entryBotApiUrl')||'',
    token:'',
    user:null,
    guilds:[],
    configure({baseUrl,token}={}){
        this.baseUrl=(baseUrl||'').replace(/\/$/,'');
        this.token=token||'';
        if(baseUrl)localStorage.setItem('entryBotApiUrl',this.baseUrl);
    },
    async request(path,options={}){
        if(!this.baseUrl)throw new Error('API未接続');
        const res=await fetch(`${this.baseUrl}${path}`,{
            ...options,
            headers:{'Content-Type':'application/json',...(this.token?{Authorization:`Bearer ${this.token}`}:{})}
        });
        if(!res.ok)throw new Error(`API ${res.status}`);
        return res.json();
    },
    async loginWithDiscord(code){
        const res=await fetch(`${this.baseUrl}/api/auth/discord`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({code})
        });
        const data=await res.json();
        if(!data.success)throw new Error(data.error||'Login failed');
        this.token=data.sessionToken;
        this.user=data.user;
        this.guilds=data.guilds;
        return data;
    }
};

async function initOAuth2(){
    const urlParams=new URLSearchParams(window.location.search);
    const code=urlParams.get('code');
    let baseUrl=localStorage.getItem('entryBotApiUrl');
    if(!baseUrl){
        baseUrl=prompt('VPS APIのURLを入力してください（例: http://161.34.33.221:3000）');
        if(baseUrl) localStorage.setItem('entryBotApiUrl',baseUrl.replace(/\/$/,''));
    }
    if(baseUrl) EntryBotApi.configure({baseUrl});

    if(code && baseUrl){
        try{
            showToast('Discord認証中...');
            const data=await EntryBotApi.loginWithDiscord(code);
            sessionStorage.setItem('entryBotAuth',JSON.stringify(data));
            window.history.replaceState({},document.title,window.location.pathname);
            setupUserSession(data);
            showToast('Discordログイン成功！');
        }catch(e){
            showToast('ログインに失敗しました: '+e.message);
        }
    }else{
        const saved=sessionStorage.getItem('entryBotAuth');
        if(saved){
            try{setupUserSession(JSON.parse(saved))}catch(e){}
        }
    }
}

function setupUserSession(data){
    EntryBotApi.user=data.user;
    EntryBotApi.guilds=data.guilds;
    EntryBotApi.token=data.sessionToken;
    if(data.user){
        $('#userInfo').innerHTML=`<strong>${data.user.username}</strong><small>Discordログイン中</small>`;
        if(data.user.avatar){
            $('#userAvatar').innerHTML=`<img src="https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png" style="width:100%;height:100%;border-radius:9px;object-fit:cover;">`;
        }
    }
    if(data.guilds&&data.guilds.length>0){
        const savedGid=sessionStorage.getItem('entryBotGuildId');
        const target=data.guilds.find(g=>g.id===savedGid)||data.guilds[0];
        activeGuildId=target.id;
        sessionStorage.setItem('entryBotGuildId',target.id);
        $('#serverName').textContent=target.name;
    }else{
        $('#serverName').textContent='管理権限のあるサーバーがありません';
    }
}

$('#userButton').addEventListener('click',()=>{
    const baseUrl=EntryBotApi.baseUrl||prompt('VPS APIのURLを入力してください（例: http://161.34.33.221:3000）');
    if(!baseUrl) return;
    EntryBotApi.configure({baseUrl});
    const clientId=prompt('Discord Developer Portalの「Client ID」を入力してください');
    if(!clientId) return;
    const redirectUri=window.location.origin+window.location.pathname;
    const authUrl=`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds`;
    window.location.href=authUrl;
});

$('#serverButton').addEventListener('click',()=>{
    if(!EntryBotApi.guilds||EntryBotApi.guilds.length===0){
        showToast('先に左下のユーザーボタンからDiscordログインしてください');
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
    if(EntryBotApi.baseUrl&&activeGuildId&&EntryBotApi.token) return true;
    showToast('Discordログインとサーバー選択を行ってください');
    return false;
}

initOAuth2();
