(() => {
  const config = window.YUNQUE_SUPABASE_CONFIG || {};
  const configured = Boolean(config.url && config.anonKey && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  window.yunqueAuth = { client, ready: configured };
  Object.defineProperties(window, {
    activities:{get:()=>activities}, branches:{get:()=>branches}, staffSessions:{get:()=>staffSessions},
    blockedSlots:{get:()=>blockedSlots}, memberReservations:{get:()=>memberReservations}, gymAccounts:{get:()=>gymAccounts},
    accountData:{get:()=>accountData}, roleMode:{get:()=>roleMode,set:value=>{roleMode=value}}
  });

  const style = document.createElement('style');
  style.textContent = `
    .auth-modal{position:fixed;inset:0;z-index:120;background:#10251cbb;display:none;place-items:center;padding:18px}
    .auth-modal.open{display:grid}.auth-card{background:#fff;color:var(--ink);border-radius:20px;padding:26px;width:min(440px,100%);box-shadow:0 28px 90px #0005}
    .auth-card h2{margin:0 0 8px;font-size:26px;letter-spacing:-.05em}.auth-card p{color:var(--muted);font-size:13px;line-height:1.5}
    .auth-card label{display:block;font-size:12px;font-weight:800;margin:14px 0 6px}.auth-card input{width:100%;border:1px solid var(--line);border-radius:10px;padding:12px;color:var(--ink);background:#fff}
    .auth-card .auth-error{min-height:20px;color:#b44739;font-size:12px;margin:10px 0}.auth-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:18px}.auth-links{display:flex;justify-content:space-between;gap:12px;margin-top:16px}
    .auth-link{border:0;background:transparent;color:var(--green);font-weight:800;padding:4px;text-decoration:underline;text-underline-offset:3px}
    .gate-create{margin:16px auto 0;background:transparent;color:#d7e4d9;border:1px solid #66806d;border-radius:10px;padding:10px 16px;font-weight:700}
    .teacher-footer-link{margin-left:14px;border:0;background:transparent;color:#c8f36a;font:inherit;font-weight:800;text-decoration:underline;text-underline-offset:3px}
    .auth-logout{background:transparent;color:var(--muted);font-size:12px;font-weight:800;padding:8px}.role-grid.auth-single{grid-template-columns:minmax(250px,360px);justify-content:center}
    @media(max-width:650px){.auth-card{padding:21px}.teacher-footer-link{display:inline-block;margin:8px 0 0}.auth-logout{font-size:11px}}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'auth-modal';
  modal.id = 'auth-modal';
  modal.innerHTML = '<section class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title"><h2 id="auth-title"></h2><p id="auth-description"></p><div id="auth-fields"></div><div class="auth-error" id="auth-error" role="status"></div><div class="auth-actions"><button class="ghost" id="auth-cancel">Cancelar</button><button class="primary" id="auth-submit">Continuar</button></div><div class="auth-links" id="auth-links"></div></section>';
  document.body.appendChild(modal);
  const $ = (selector) => modal.querySelector(selector);
  let formMode = 'login';
  let currentProfile = null;

  function openForm(mode) {
    formMode = mode;
    const titles = { login:'Entrar como Gymbro', signup:'Crear cuenta de Gymbro', staff:'Acceso de profesor' };
    const descriptions = { login:'Ingresá con el mail y la contraseña de tu cuenta.', signup:'Usá el mismo correo y contraseña para entrar desde otros dispositivos.', staff:'Ingresá la contraseña del panel de profesor.' };
    $('#auth-title').textContent = titles[mode];
    $('#auth-description').textContent = descriptions[mode];
    $('#auth-error').textContent = configured ? '' : 'Falta conectar la base de datos de Yunque para habilitar cuentas entre dispositivos.';
    $('#auth-fields').innerHTML = mode === 'signup'
      ? '<label for="auth-name">Nombre</label><input id="auth-name" autocomplete="name" required><label for="auth-email">Mail</label><input id="auth-email" type="email" autocomplete="email" required><label for="auth-password">Contraseña</label><input id="auth-password" type="password" autocomplete="new-password" minlength="6" required>'
      : mode === 'login'
        ? '<label for="auth-email">Mail</label><input id="auth-email" type="email" autocomplete="email" required><label for="auth-password">Contraseña</label><input id="auth-password" type="password" autocomplete="current-password" required>'
        : '<label for="auth-password">Contraseña</label><input id="auth-password" type="password" inputmode="numeric" autocomplete="current-password" required>';
    $('#auth-submit').textContent = mode === 'signup' ? 'Crear cuenta' : mode === 'staff' ? 'Entrar al panel' : 'Entrar';
    $('#auth-submit').disabled = !configured;
    $('#auth-links').innerHTML = mode === 'login'
      ? '<button type="button" class="auth-link" id="auth-switch">Crear cuenta de Gymbro</button><span></span>'
      : mode === 'signup'
        ? '<button type="button" class="auth-link" id="auth-switch">Ya tengo cuenta</button><span></span>'
        : '<span></span><span></span>';
    const switcher = $('#auth-switch');
    if (switcher) switcher.onclick = () => openForm(mode === 'login' ? 'signup' : 'login');
    $('#auth-fields').querySelectorAll('input').forEach(input => input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !$('#auth-submit').disabled) $('#auth-submit').click();
    }));
    modal.classList.add('open');
    const first = $('#auth-fields input');
    first?.focus();
  }
  function closeForm() { modal.classList.remove('open'); }
  $('#auth-cancel').onclick = closeForm;
  modal.addEventListener('click', (event) => { if (event.target === modal) closeForm(); });

  function gateSetup() {
    const gate = document.getElementById('roleGate');
    if (!gate) return;
    gate.style.display = 'grid';
    const cards = [...gate.querySelectorAll('.role-card')];
    const grid = gate.querySelector('.role-grid');
    if (grid) grid.classList.add('auth-single');
    if (cards[0]) {
      cards[0].onclick = () => openForm('login');
      const title = cards[0].querySelector('h3');
      if (title) title.setAttribute('aria-label','Entrar como Gymbro');
    }
    cards.slice(1).forEach(card => { card.hidden = true; card.setAttribute('aria-hidden','true'); });
    let create = gate.querySelector('.gate-create');
    if (!create) {
      create = document.createElement('button');
      create.className = 'gate-create';
      create.textContent = 'Crear cuenta de Gymbro';
      create.onclick = () => openForm('signup');
      grid?.after(create);
    }
  }

  function installTeacherFooter() {
    const footer = document.getElementById('infomark-footer');
    if (!footer || footer.querySelector('.teacher-footer-link')) return;
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'teacher-footer-link';
    link.textContent = 'Profesor';
    link.onclick = () => openForm('staff');
    footer.append(link);
  }

  function errorText(error) {
    const message = error?.message || 'No se pudo completar el acceso.';
    return message.replace(/<[^>]*>/g, '').slice(0,240);
  }
  function todayIso() { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
  function replaceArray(target, values) { target.splice(0, target.length, ...(Array.isArray(values) ? values : [])); }

  async function loadSharedData(profile) {
    if (!client) return;
    const { data: configRow, error: configError } = await client.from('gym_config').select('data').eq('id',1).maybeSingle();
    if (configError) throw configError;
    const saved = configRow?.data;
    if (saved && (saved.initialized || profile.role !== 'staff')) {
      replaceArray(window.activities, saved.activities);
      replaceArray(window.branches, saved.branches);
      replaceArray(window.staffSessions, saved.sessions);
      Object.keys(window.blockedSlots).forEach(k => delete window.blockedSlots[k]);
      Object.assign(window.blockedSlots, saved.blockedSlots || {});
    } else if (profile.role === 'staff') {
      const { error } = await client.rpc('save_gym_config',{p_data:{initialized:true,activities:window.activities,branches:window.branches,sessions:window.staffSessions,blockedSlots:window.blockedSlots}});
      if (error) throw error;
    }
    let reservationsQuery = client.from('gym_reservations').select('*').order('class_date',{ascending:false}).order('created_at',{ascending:false});
    if (profile.role !== 'staff') reservationsQuery = reservationsQuery.eq('user_id',profile.id);
    const {data: reservationRows,error: reservationError} = await reservationsQuery;
    if (reservationError) throw reservationError;
    const profilesQuery = profile.role === 'staff'
      ? client.from('gym_profiles').select('id,full_name,email,credits,created_at,role')
      : Promise.resolve({data:[profile],error:null});
    const ledgerQuery = client.from('gym_credit_ledger').select('*').order('created_at',{ascending:false});
    const [{data: profiles,error: profilesError},{data: ledger,error: ledgerError}] = await Promise.all([profilesQuery,ledgerQuery]);
    if (profilesError) throw profilesError;
    if (ledgerError) throw ledgerError;
    const byUser = new Map((profiles||[]).map(p => [p.id,p]));
    const creditRows = ledger||[];
    replaceArray(window.memberReservations, (reservationRows||[]).map(row => {
      const s=row.session_data||{};
      return {id:row.id,user_id:row.user_id,memberId:row.user_id,date:row.class_date,day:row.class_date,time:s[0]||'',activity:s[1]||'',branch:String(s[2]||'').split(' · ')[0],place:s[2]||'',coach:s[3]||'',attendance:row.attendance,memberName:byUser.get(row.user_id)?.full_name||'',memberEmail:byUser.get(row.user_id)?.email||''};
    }));
    replaceArray(window.gymAccounts, (profiles||[]).map(p => ({id:p.id,name:p.full_name||'Gymbro',email:p.email||'',credits:p.credits||0,created_at:p.created_at,ledger:creditRows.filter(m=>m.user_id===p.id).map(m=>({date:m.created_at.slice(0,10),label:m.description,amount:m.amount}))})));
    window.accountData.name=profile.full_name||profile.user_metadata?.full_name||'';
    window.accountData.email=profile.email||'';
    window.accountData.id=profile.id;
    window.accountData.created_at=profile.created_at;
    window.roleMode=profile.role==='staff'?'staff':'gymbro';
    window.persistNow?.();
  }

  async function finishAuth(user) {
    let {data: profile,error} = await client.from('gym_profiles').select('id,full_name,email,role,credits,created_at').eq('id',user.id).single();
    if (error) throw error;
    currentProfile = profile;
    await loadSharedData(profile);
    closeForm();
    window.enterRole(profile.role==='staff'?'staff':'gymbro');
    window.render?.();
    installTeacherFooter();
  }

  $('#auth-submit').onclick = async () => {
    if (!client) return;
    $('#auth-submit').disabled = true;
    $('#auth-error').textContent = '';
    try {
      const email = $('#auth-email')?.value.trim();
      const password = $('#auth-password')?.value || '';
      if (formMode === 'signup') {
        const full_name = $('#auth-name')?.value.trim();
        if (!full_name || !email || password.length < 6) throw new Error('Completá tu nombre, un mail válido y una contraseña de al menos 6 caracteres.');
        const {data,error} = await client.auth.signUp({email,password,options:{data:{full_name}}});
        if (error) throw error;
        if (data.session) await finishAuth(data.user);
        else $('#auth-error').textContent = 'Cuenta creada. Revisá tu correo para confirmar el mail y después iniciá sesión.';
      } else if (formMode === 'login') {
        if (!email || !password) throw new Error('Ingresá el mail y la contraseña.');
        const {data,error} = await client.auth.signInWithPassword({email,password});
        if (error) throw error;
        await finishAuth(data.user);
      } else {
        let {data:{session}} = await client.auth.getSession();
        if (session?.user && !session.user.is_anonymous) {
          const {data:existing}=await client.from('gym_profiles').select('role').eq('id',session.user.id).maybeSingle();
          if (existing?.role !== 'staff') {
            const {error:signOutError}=await client.auth.signOut();
            if (signOutError) throw signOutError;
            session=null;
          }
        }
        if (!session) {
          const {data,error} = await client.auth.signInAnonymously();
          if (error) throw error;
          session=data.session;
        }
        const {data:authorized,error} = await client.rpc('authorize_gym_staff',{p_pin:password});
        if (error) throw error;
        if (!authorized) throw new Error('No se pudo habilitar el panel. Esperá una hora si hubo varios intentos fallidos.');
        const {data:{user}} = await client.auth.getUser();
        await finishAuth(user);
      }
    } catch(error) {
      $('#auth-error').textContent = errorText(error);
    } finally {
      $('#auth-submit').disabled = false;
    }
  };

  const oldPersist = window.persistNow;
  let saveTimer;
  window.persistNow = function() {
    oldPersist?.();
    if (!client || window.roleMode !== 'staff' || !window.accountData?.id) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const data={initialized:true,activities:window.activities,branches:window.branches,sessions:window.staffSessions,blockedSlots:window.blockedSlots};
      const {error}=await client.rpc('save_gym_config',{p_data:data});
      if (error) console.error('No se pudo sincronizar la agenda',error.message);
    },350);
  };

  const oldBooking = window.confirmBooking;
  window.confirmBooking = async function() {
    if (!client || !window.accountData?.id) return oldBooking?.();
    try {
      const {data,error}=await client.rpc('book_gym_class',{p_session:bookingTarget,p_class_date:todayIso()});
      if (error) throw error;
      window.closeModal?.();
      await loadSharedData(await client.from('gym_profiles').select('id,full_name,email,role,credits,created_at').eq('id',window.accountData.id).single().then(r=>r.data));
      window.render?.();
      alert('Reserva confirmada. Se guardó en tu cuenta.');
    } catch(error) { alert(errorText(error)); }
  };

  const oldAttendance = window.setAttendance;
  window.setAttendance = async function(index,value) {
    const reservation=window.memberReservations[index];
    if (!client || !reservation?.id) return oldAttendance?.(index,value);
    const {error}=await client.from('gym_reservations').update({attendance:value}).eq('id',reservation.id);
    if (error) { alert(errorText(error)); return; }
    reservation.attendance=value;
    window.persistNow?.();
    window.renderMemberReservations?.();
    window.renderStats?.();
  };

  const oldCreditPrompt=window.creditPrompt;
  window.creditPrompt=function(id) {
    if (!client || !window.accountData?.id || window.roleMode!=='staff') return oldCreditPrompt?.(id);
    const account=window.gymAccounts.find(a=>a.id===id);
    if (!account) return;
    window.showWebForm('Agregar créditos a '+account.name,[{name:'amount',label:'Cantidad de créditos',type:'number'}],async values=>{
      const amount=Math.floor(Number(values.amount));
      if (!Number.isFinite(amount)||amount<1) return false;
      const {error}=await client.rpc('grant_gym_credits',{p_user_id:account.id,p_amount:amount});
      if (error) { alert(errorText(error)); return false; }
      await loadSharedData(await client.from('gym_profiles').select('id,full_name,email,role,credits,created_at').eq('id',window.accountData.id).single().then(r=>r.data));
      window.render?.();
      return true;
    });
  };

  const oldWebForm=window.showWebForm;
  window.showWebForm=function(title,fields,onSave) {
    return oldWebForm(title,fields,data=>{
      const result=onSave(data);
      if(client && title.toLowerCase().includes('datos de cuenta')) {
        const updates={data:{full_name:(data.name||'').trim()}};
        if(data.email && data.email.trim()!==accountData.email) updates.email=data.email.trim();
        if(data.password) updates.password=data.password;
        client.auth.updateUser(updates).then(async({error})=>{
          if(error) alert(errorText(error));
          else { const {data:{user}}=await client.auth.getUser(); if(user)await finishAuth(user); }
        });
      }
      return result;
    });
  };

  function installFooterAndGate() {
    gateSetup();
    const baseRender=window.render;
    if (!baseRender.__yunqueAuthWrapped) {
      const wrapped=function(){baseRender();installTeacherFooter()};
      wrapped.__yunqueAuthWrapped=true;
      window.render=wrapped;
    }
    installTeacherFooter();
    const top=document.querySelector('.top-actions');
    if(top&&!top.querySelector('.auth-logout')){
      const out=document.createElement('button');out.className='auth-logout';out.textContent='Cerrar sesión';out.onclick=async()=>{if(client)await client.auth.signOut();window.location.reload()};top.append(out);
    }
  }

  installFooterAndGate();
  if (client) {
    client.auth.getSession().then(async ({data,error})=>{
      if (error) throw error;
      if (data.session?.user) await finishAuth(data.session.user);
    }).catch(error=>console.error('No se pudo restaurar la sesión',errorText(error)));
    setInterval(async()=>{
      if (client && currentProfile) {
        try { await loadSharedData(currentProfile); window.render?.(); }
        catch(error){console.warn('No se pudo actualizar la agenda',error.message)}
      }
    },30000);
  }
})();
