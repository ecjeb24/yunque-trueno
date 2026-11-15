/* Mobile navigation, compact booking categories, teacher attendance and shared profile photos. */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    @media (hover: none) {
      .nav button:hover:not(.active) { background: transparent; color: #aac0b1; }
    }
    .avatar img, .account-photo { width:100%; height:100%; object-fit:cover; border-radius:50%; }
    .account-avatar { width:34px; height:34px; flex:0 0 34px; display:inline-grid; place-items:center; overflow:hidden; margin-right:9px; vertical-align:middle; border-radius:50%; background:#dcead8; color:#183126; font-size:11px; font-weight:800; }
    .attendance-person { display:flex; align-items:center; gap:11px; }
    .attendance-person .account-avatar { margin:0; }
    .attendance-actions { display:flex; flex-wrap:wrap; gap:6px; }
    .attendance-choice { padding:7px 10px; border:1px solid var(--line); border-radius:9px; background:#fff; color:var(--ink); font-size:11px; font-weight:700; }
    .attendance-choice.selected { background:var(--green); border-color:var(--green); color:#fff; }
    .attendance-class-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
    .attendance-class { width:100%; text-align:left; }
    .attendance-back { margin-bottom:14px; }
    @media(max-width:700px) {
      html { scroll-padding-bottom:calc(112px + env(safe-area-inset-bottom, 0px)); }
      .sidebar { padding-bottom:0!important; }
      .sidebar .nav {
        position:fixed!important; left:50%; right:auto; bottom:calc(34px + env(safe-area-inset-bottom, 0px)); z-index:100;
        display:flex!important; align-items:stretch; justify-content:space-around; gap:3px;
        width:calc(100% - 36px); max-width:460px; margin:0; padding:6px!important; transform:translateX(-50%);
        min-height:64px; background:#10251cf2; border:1px solid #42634f;
        border-radius:9999px; box-shadow:0 8px 28px #10241955, inset 0 1px #ffffff12;
      }
      .sidebar .nav button {
        flex:1 1 0; min-width:0; min-height:54px; margin:0; padding:6px 2px!important;
        border-radius:12px; text-align:center; white-space:normal; line-height:1.1;
        font-size:10px!important; color:#aac0b1;
      }
      .sidebar .nav button span {
        display:block!important; margin:0 0 3px!important; font-size:19px!important; line-height:1;
      }
      .sidebar .nav button.active { background:#2d503e!important; color:#fff!important; }
      .content { padding-bottom:calc(112px + env(safe-area-inset-bottom, 0px)); }
      .sidebar .nav button.active { background:#2d503e!important; color:#fff!important; }
      .sidebar .nav button:hover:not(.active) { background:transparent!important; color:#aac0b1!important; }
      .booking-layout { grid-template-columns:minmax(0,1fr)!important; }
      .booking-layout .categories { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr)); overflow:visible!important; gap:7px; padding:0 0 4px; }
      .booking-layout .cat { display:flex; align-items:center; justify-content:space-between; gap:7px; min-width:0!important; min-height:39px; padding:8px 10px!important; border-radius:10px; font-size:12px; }
      .booking-layout .cat small { display:none!important; }
      .booking-layout .cat .branch { flex:0 0 auto; margin:0; padding:0; background:transparent; font-size:0; }
      .booking-layout .cat .branch i { display:block; width:9px; height:9px; border-radius:50%; }
      .booking-layout .cat.active { box-shadow:inset 3px 0 var(--red); }
      .booking-layout .session { grid-template-columns:55px minmax(0,1fr)!important; }
      .booking-layout .session .tag, .booking-layout .session .ghost { display:inline-flex!important; grid-column:2!important; justify-self:start; align-items:center; }
      .attendance-class-list { grid-template-columns:1fr; }
      .attendance-actions { grid-column:1/-1; }
    }
  `;
  document.head.appendChild(style);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function initials(name) {
    return String(name || 'Gymbro').trim().split(/\s+/).map(part => part[0]).join('').slice(0,2).toUpperCase();
  }
  window.accountPhotoMarkup = function(account, extraClass='') {
    const name = escapeHtml(account?.name || 'Gymbro');
    const photo = account?.photo;
    return '<span class="account-avatar '+extraClass+'">'+(photo?'<img class="account-photo" src="'+escapeHtml(photo)+'" alt="">':escapeHtml(initials(name)))+'</span>';
  };
  const oldApplyAccount = window.applyAccountEverywhere;
  if (oldApplyAccount) window.applyAccountEverywhere = function() {
    oldApplyAccount();
    document.querySelectorAll('.avatar').forEach(avatar => {
      if (accountData.photo) avatar.innerHTML='<img src="'+escapeHtml(accountData.photo)+'" alt="Foto de perfil" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      avatar.style.cursor='pointer';
      avatar.title='Cambiar foto de perfil';
      avatar.onclick=()=>document.getElementById('profilePhotoInput')?.click();
    });
  };

  const nav = document.querySelector('.nav');
  if (nav && !nav.querySelector('[data-page="asistencias"]')) {
    const item = document.createElement('button');
    item.dataset.page = 'asistencias';
    item.innerHTML = '<span>✓</span>Asistencias';
    item.style.display = 'none';
    item.onclick = () => window.go('asistencias');
    nav.append(item);
  }

  window.setRoleNavigation = function(role) {
    const mobile=window.matchMedia('(max-width:700px)').matches;
    const allowed = role === 'staff'
      ? ['turnos','reservas','creditos','asistencias']
      : ['inicio','turnos','reservas','creditos','estadisticas'];
    document.querySelectorAll('.nav button').forEach(button => {
      const page = button.dataset.page;
      button.style.setProperty('display', allowed.includes(page) ? (mobile?'flex':'block') : 'none', 'important');
      button.classList.toggle('active', page === current);
      if (page === 'reservas') button.innerHTML = '<span>✓</span>'+(role === 'staff'?'Reservados':'Mis reservas');
    });
  };
  window.applyRoleVisibility = function() {
    document.body.classList.toggle('staff-mode', roleMode === 'staff');
    window.setRoleNavigation(window.roleMode);
  };
  window.addEventListener('resize',()=>window.setRoleNavigation(roleMode));

  let chosenActivity = '';
  let chosenSession = -1;
  function memberFor(reservation) {
    return window.gymAccounts.find(account => account.id === (reservation.user_id || reservation.memberId)) || {
      name:reservation.memberName || window.accountData?.name || 'Gymbro',
      email:reservation.memberEmail || window.accountData?.email || '',
      photo:reservation.profile_photo || window.accountData?.photo || ''
    };
  }
  function sessionKey(session) {
    return [session[0],session[1],String(session[2]||'').split(' · ')[0],session[3],session[6]||''].join('|');
  }
  function reservationMatches(reservation, session) {
    return reservation.time === session[0] && reservation.activity === session[1] &&
      String(reservation.branch || reservation.place || '').split(' · ')[0] === String(session[2]||'').split(' · ')[0] &&
      (!reservation.coach || reservation.coach === session[3]);
  }
  function renderAttendancePage() {
    const app = document.getElementById('app');
    if (!app || roleMode !== 'staff' || current !== 'asistencias') return false;
    const activities = window.activities || [];
    const sessions = window.validBranchSessions ? window.validBranchSessions() : window.staffSessions;
    if (!activities.includes(chosenActivity)) { chosenActivity = ''; chosenSession = -1; }
    const activityButtons = activities.map(activity => '<button class="ghost attendance-class attendance-activity" data-activity="'+escapeHtml(activity)+'">'+escapeHtml(activity)+'</button>').join('');
    let details = '<div class="notice">Elegí una actividad para ver sus turnos y las personas reservadas.</div>';
    if (chosenActivity) {
      const matching = sessions.map((session,index)=>({session,index})).filter(item=>item.session[1]===chosenActivity);
      if (chosenSession < 0) {
        details = '<button class="ghost attendance-back" data-att-back>← Todas las actividades</button><div class="attendance-class-list">'+matching.map(({session,index})=>{
          const count=window.memberReservations.filter(r=>reservationMatches(r,session)).length;
          return '<button class="ghost attendance-class attendance-session" data-session="'+index+'"><strong>'+escapeHtml(session[0])+' · '+escapeHtml(session[1])+'</strong><br><small>'+escapeHtml(session[2]||'')+' · '+escapeHtml(session[3]||'')+' · '+count+' reservados</small></button>';
        }).join('')+'</div>'+(matching.length?'':'<div class="notice">Esta actividad todavía no tiene turnos programados.</div>');
      } else {
        const session=sessions[chosenSession];
        if (!session || session[1] !== chosenActivity) { chosenSession=-1; return renderAttendancePage(); }
        const reservations=window.memberReservations.map((r,index)=>({r,index})).filter(item=>reservationMatches(item.r,session));
        details = '<button class="ghost attendance-back" data-att-back>← Volver a turnos de '+escapeHtml(chosenActivity)+'</button><div class="card card-pad"><div class="section-title"><h3>'+escapeHtml(session[1])+' · '+escapeHtml(session[0])+'</h3><span class="pill">'+reservations.length+' reservados</span></div><p style="color:var(--muted);font-size:12px">'+escapeHtml(session[2]||'')+' · '+escapeHtml(session[3]||'')+'</p>'+
          (reservations.length ? '<div class="schedule">'+reservations.map(({r,index})=>{
            const account=memberFor(r),date=r.date?new Date(r.date+'T12:00:00').toLocaleDateString('es-AR'):(r.day||'');
            return '<div class="session"><div class="attendance-person">'+window.accountPhotoMarkup(account)+'<div><strong>'+escapeHtml(account.name)+'</strong><br><small>'+escapeHtml(date)+'</small></div></div><div class="attendance-actions"><button class="attendance-choice '+(r.attendance===true?'selected':'')+'" onclick="setAttendance('+index+',true)">Asistió</button><button class="attendance-choice '+(r.attendance===false?'selected':'')+'" onclick="setAttendance('+index+',false)">No asistió</button></div></div>';
          }).join('')+'</div>' : '<div class="notice">Todavía no hay reservas para este turno.</div>')+'</div>';
      }
    }
    document.getElementById('crumb').textContent='Asistencias';
    app.innerHTML='<div class="page-head"><div><div class="eyebrow">Panel de profesor</div><h1>Asistencias</h1><p>Elegí una actividad y un turno para revisar la lista de personas.</p></div></div><div class="card card-pad"><div class="attendance-class-list">'+activityButtons+'</div><div style="margin-top:16px">'+details+'</div></div>';
    app.querySelectorAll('[data-activity]').forEach(button=>button.onclick=()=>{chosenActivity=button.dataset.activity;chosenSession=-1;renderAttendancePage()});
    app.querySelectorAll('[data-session]').forEach(button=>button.onclick=()=>{chosenSession=Number(button.dataset.session);renderAttendancePage()});
    app.querySelector('[data-att-back]')?.addEventListener('click',()=>{if(chosenSession>=0)chosenSession=-1;else chosenActivity='';renderAttendancePage()});
    return true;
  }

  const previousRender=window.render;
  window.render=function() {
    if (!renderAttendancePage()) previousRender();
    window.setRoleNavigation(window.roleMode);
    window.persistNow?.();
  };
  const previousEnterRole=window.enterRole;
  window.enterRole=function(role) {
    previousEnterRole(role);
    window.setRoleNavigation(window.roleMode);
  };
  const previousGo=window.go;
  window.go=function(page) {
    previousGo(page);
    window.setRoleNavigation(window.roleMode);
  };
  const previousAttendance=window.setAttendance;
  window.setAttendance=function(index,value) {
    const result=previousAttendance(index,value);
    if(roleMode==='staff'&&current==='asistencias') renderAttendancePage();
    return result;
  };
})();
