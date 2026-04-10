// ==========================================
// 定数・汎用関数
// ==========================================
const W_LIST = ['月', '火', '水', '木', '金', '土', '日'];
const T_LIST = ['朝', '昼', '夕'];
const LABELS = [];
W_LIST.forEach(day => { T_LIST.forEach(time => { LABELS.push(day + ' ' + time); }); });

function dbSave(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } 
    catch (e) { console.error(e); alert('保存失敗'); }
}
function dbLoad(key, def) {
    const d = localStorage.getItem(key);
    if (d === null) return def;
    try { return JSON.parse(d); } catch (e) { return def; }
}

// 休日判定関数
function isHoliday(memberId, dateObj, settingsArray) {
    if (!Array.isArray(settingsArray)) return false;
    const mySettings = settingsArray.filter(s => s.memberId === memberId);
    return mySettings.some(s => {
        if (s.type === 'date') {
            if (!s.start || !s.end) return false;
            const start = new Date(s.start).getTime();
            const end = new Date(s.end).getTime();
            const target = dateObj.getTime();
            return target >= start && target <= end;
        } 
        else if (s.type === 'period') {
            const m = dateObj.getMonth() + 1;
            const d = dateObj.getDate();
            if (m !== s.month) return false;
            if (s.part === 'early') return d <= 10;
            if (s.part === 'mid') return d >= 11 && d <= 20;
            if (s.part === 'late') return d >= 21;
        }
        return false;
    });
}

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 初期化処理
    // ==========================================
    (function migrateHolidaySettings(){
        let settings = dbLoad('holiday_settings', []);
        if (!Array.isArray(settings)) {
            const arr = [];
            Object.keys(settings).forEach(key => {
                const s = settings[key];
                s.memberId = parseInt(key);
                arr.push(s);
            });
            dbSave('holiday_settings', arr);
        }
    })();

    // スマホメニュー＆タブ切り替え
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mainNav = document.getElementById('main-nav');
    const navLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    hamburgerBtn.addEventListener('click', () => {
        mainNav.classList.toggle('open');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            const tabId = link.getAttribute('data-tab');
            link.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            mainNav.classList.remove('open');

            if (tabId === 'tab-manage') { renderAvailabilityGrid(); renderHolidaySettings(); }
            if (tabId === 'tab-create') { renderGeneratedShift(); updateNameSuggestions(); }
            if (tabId === 'tab-data') { renderDataView(); }
        });
    });

    // スクロールトップボタン
    const scrollBtn = document.getElementById('scroll-to-top-btn');
    window.addEventListener('scroll', () => {
        if (window.scrollY > window.innerHeight * 0.5) {
            scrollBtn.style.opacity = '1'; scrollBtn.style.visibility = 'visible'; scrollBtn.style.transform = 'translateY(0)';
        } else {
            scrollBtn.style.opacity = '0'; scrollBtn.style.visibility = 'hidden'; scrollBtn.style.transform = 'translateY(20px)';
        }
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));


    // ==========================================
    // タブ1: シフト管理
    // ==========================================
    const gridContainer = document.getElementById('availability-grid-container');
    const dayFilter = document.getElementById('day-filter');
    const timeFilter = document.getElementById('time-filter');

    function applyGridFilters() {
        const sDay = dayFilter.value;
        const sTime = timeFilter.value;
        const table = gridContainer.querySelector('.grid-table');
        if (!table) return;

        const toggle = (list, isHead) => {
            list.forEach(row => {
                const cells = row.querySelectorAll(isHead ? 'th' : 'td');
                for(let i=2; i<cells.length; i++){
                    const col = i-2;
                    const d = Math.floor(col/3), t = col%3;
                    const match = (sDay==='all'||sDay==d) && (sTime==='all'||sTime==t);
                    if(match) cells[i].classList.remove('hidden-col');
                    else cells[i].classList.add('hidden-col');
                }
            });
        };
        toggle(table.querySelectorAll('thead tr'), true);
        toggle(table.querySelectorAll('tbody tr'), false);
    }
    dayFilter.addEventListener('change', applyGridFilters);
    timeFilter.addEventListener('change', applyGridFilters);
    
    function renderAvailabilityGrid() {
        const members = dbLoad('members', []);
        const availability = dbLoad('availability', {});
        if (members.length === 0) {
            gridContainer.innerHTML = '<p style="padding:10px;">メンバーがいません。</p>';
            return;
        }
        
        let displayM = [...members];
        displayM.sort((a,b)=>a.id-b.id);

        let h = '<table class="grid-table"><thead><tr><th>名前</th><th>学年</th>';
        LABELS.forEach(l => h+=`<th>${l.replace(' ','<br>')}</th>`);
        h+='</tr></thead><tbody>';

        displayM.forEach(m => {
            const av = availability[m.id] || Array(21).fill(0);
            let gs = `<select class="grade-select" data-mid="${m.id}">`;
            [{v:'1',l:'1年'},{v:'2',l:'2年'},{v:'3',l:'3年'},{v:'4',l:'4年'},{v:'other',l:'他'}].forEach(o=>{
                gs+=`<option value="${o.v}" ${m.grade==o.v?'selected':''}>${o.l}</option>`;
            });
            gs+='</select>';
            
            let nameCell = `<div style="display:flex;justify-content:space-between;align-items:center;">
                <span>${m.name}</span>
                <div style="display:flex;">
                    <button type="button" class="row-holiday-btn" data-mid="${m.id}" title="長期休暇設定">休</button>
                    <button type="button" class="row-fill-btn" data-mid="${m.id}" title="表示セルを全て〇に">〇</button>
                    <button type="button" class="row-reset-btn" data-mid="${m.id}" title="全てのチェックを外す">×</button>
                </div>
            </div>`;

            h+=`<tr><td>${nameCell}</td><td style="padding:0;">${gs}</td>`;
            for(let i=0; i<21; i++){
                h+=`<td><input type="checkbox" data-mid="${m.id}" data-idx="${i}" ${av[i]===1?'checked':''}></td>`;
            }
            h+='</tr>';
        });
        h+='</tbody></table>';
        gridContainer.innerHTML = h;
        applyGridFilters();
    }

    gridContainer.addEventListener('change', e => {
        if(e.target.classList.contains('grade-select')){
            const mid = parseInt(e.target.dataset.mid);
            const members = dbLoad('members', []);
            const m = members.find(x=>x.id===mid);
            if(m){ m.grade = e.target.value; dbSave('members', members); }
        }
    });

    gridContainer.addEventListener('click', e => {
        const mid = parseInt(e.target.dataset.mid);
        if(e.target.classList.contains('row-reset-btn')){
            if(!confirm('この行をクリアしますか？')) return;
            gridContainer.querySelectorAll(`input[data-mid="${mid}"]`).forEach(c=>c.checked=false);
        }
        if(e.target.classList.contains('row-fill-btn')){
            e.preventDefault();
            const checkboxes = gridContainer.querySelectorAll(`input[data-mid="${mid}"]`);
            checkboxes.forEach(cb => {
                const cell = cb.closest('td');
                if (cell && !cell.classList.contains('hidden-col')) cb.checked = true;
            });
        }
        if(e.target.classList.contains('row-holiday-btn')){
            e.preventDefault();
            addHolidayRow(mid);
        }
    });

    document.getElementById('add-member-form').addEventListener('submit', e => {
        e.preventDefault();
        const nameIn = document.getElementById('member-name');
        const nm = nameIn.value.trim();
        if(!nm) return;
        const members = dbLoad('members', []);
        const newId = members.length > 0 ? Math.max(...members.map(x=>x.id)) + 1 : 1;
        members.push({ id: newId, name: nm, grade: document.getElementById('member-grade').value });
        dbSave('members', members);
        nameIn.value='';
        renderAvailabilityGrid();
        alert('追加しました');
    });

    document.getElementById('reset-all-availability').addEventListener('click', ()=>{
        if(confirm('全員分クリアしますか？')) document.querySelectorAll('#availability-grid-container input[type=checkbox]').forEach(c=>c.checked=false);
    });
    
    document.getElementById('save-availability').addEventListener('click', ()=>{
        const members = dbLoad('members', []);
        if(!members.length) return alert('メンバーがいません');
        const newAv = {};
        members.forEach(m=>newAv[m.id]=Array(21).fill(0));
        document.querySelectorAll('#availability-grid-container input[type=checkbox]').forEach(c=>{
            if(c.checked) newAv[c.dataset.mid][parseInt(c.dataset.idx)] = 1;
        });
        dbSave('availability', newAv);
        alert('保存しました');
    });

    // 長期休暇設定
    const holidayContainer = document.getElementById('holiday-settings-container');
    function createHolidayRow(memberId, initialData = null) {
        const members = dbLoad('members', []);
        const m = members.find(x => x.id === memberId);
        if(!m) return;

        const data = initialData || { type: 'date' };
        const div = document.createElement('div');
        div.className = 'holiday-list-item';
        div.dataset.mid = memberId;
        
        div.innerHTML = `
            <div class="holiday-member-info">
                <span>${m.name}</span>
                <button type="button" class="remove-holiday-btn" title="削除">×</button>
            </div>
            <div class="holiday-controls">
                <div class="mode-switch-wrapper">
                    <span class="mode-label label-date ${data.type==='date'?'active':''}">日付</span>
                    <label class="switch">
                        <input type="checkbox" class="mode-toggle" ${data.type==='period'?'checked':''}>
                        <span class="slider"></span>
                    </label>
                    <span class="mode-label label-period ${data.type==='period'?'active':''}">時期</span>
                </div>
                
                <div class="holiday-input-group type-date ${data.type==='date'?'active':''}">
                    <input type="date" class="h-start" value="${data.start||''}">
                    <span>～</span>
                    <input type="date" class="h-end" value="${data.end||''}">
                </div>
                
                <div class="holiday-input-group type-period ${data.type==='period'?'active':''}">
                    <select class="h-month">
                        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(num => `<option value="${num}" ${data.month==num?'selected':''}>${num}月</option>`).join('')}
                    </select>
                    <select class="h-part">
                        <option value="early" ${data.part==='early'?'selected':''}>上旬 (1-10)</option>
                        <option value="mid" ${data.part==='mid'?'selected':''}>中旬 (11-20)</option>
                        <option value="late" ${data.part==='late'?'selected':''}>下旬 (21-)</option>
                    </select>
                </div>
            </div>
        `;
        holidayContainer.appendChild(div);
        
        const toggle = div.querySelector('.mode-toggle');
        const dateGroup = div.querySelector('.type-date');
        const periodGroup = div.querySelector('.type-period');
        const labelDate = div.querySelector('.label-date');
        const labelPeriod = div.querySelector('.label-period');

        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                dateGroup.classList.remove('active');
                periodGroup.classList.add('active');
                labelDate.classList.remove('active');
                labelPeriod.classList.add('active');
            } else {
                periodGroup.classList.remove('active');
                dateGroup.classList.add('active');
                labelPeriod.classList.remove('active');
                labelDate.classList.add('active');
            }
        });

        div.querySelector('.remove-holiday-btn').addEventListener('click', () => div.remove());
        if(!initialData) div.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    window.addHolidayRow = createHolidayRow;

    function renderHolidaySettings() {
        let settings = dbLoad('holiday_settings', []);
        holidayContainer.innerHTML = '';
        if (!Array.isArray(settings)) settings = [];
        settings.forEach(s => createHolidayRow(s.memberId, s));
    }

    document.getElementById('add-all-members-holiday').addEventListener('click', () => {
        const members = dbLoad('members', []);
        members.forEach(m => createHolidayRow(m.id));
    });

    document.getElementById('clear-all-holidays').addEventListener('click', () => {
        if(confirm('設定された休暇期間をすべて削除しますか？')) holidayContainer.innerHTML = '';
    });

    document.getElementById('save-holiday-settings').addEventListener('click', () => {
        const newSettingsList = [];
        holidayContainer.querySelectorAll('.holiday-list-item').forEach(row => {
            const mid = parseInt(row.dataset.mid);
            const toggle = row.querySelector('.mode-toggle');
            const type = toggle.checked ? 'period' : 'date';
            const setting = { memberId: mid, type: type };

            if (type === 'date') {
                setting.start = row.querySelector('.h-start').value;
                setting.end = row.querySelector('.h-end').value;
            } else {
                setting.month = parseInt(row.querySelector('.h-month').value);
                setting.part = row.querySelector('.h-part').value;
            }
            newSettingsList.push(setting);
        });
        dbSave('holiday_settings', newSettingsList);
        alert('長期休暇設定を保存しました。');
    });


    // ==========================================
    // タブ2: シフト作成
    // ==========================================
    function updateNameSuggestions() {
        const members = dbLoad('members', []);
        const datalist = document.getElementById('member-list-suggestions');
        if(datalist){
            datalist.innerHTML = ''; 
            members.forEach(m => {
                const option = document.createElement('option');
                option.value = m.name;
                datalist.appendChild(option);
            });
        }
    }

    document.getElementById('create-shift-form').addEventListener('submit', e => {
        e.preventDefault();
        try {
            const members = dbLoad('members', []);
            const availability = dbLoad('availability', {});
            const chanceExclusion = dbLoad('chance_exclusion', []);
            const method = document.getElementById('creation-method').value;
            
            let holidaySettings = dbLoad('holiday_settings', []);
            if (!Array.isArray(holidaySettings)) holidaySettings = [];

            if(!members.length) return alert('メンバーがいません');

            dbSave('members_last_order', members);

            const startDateVal = document.getElementById('start-date').value;
            const endDateVal = document.getElementById('end-date').value;

            if (!startDateVal || !endDateVal) { alert("開始日と終了日を入力してください"); return; }

            const startD = new Date(startDateVal);
            const endD = new Date(endDateVal);
            const diffTime = endD - startD;
            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

            if (days <= 0) { alert("終了日は開始日より後の日付にしてください"); return; }

            let startW = (startD.getDay()+6)%7;
            const results = [];
            let currD = new Date(startD);
            let currW = startW;

            let memberShiftCounts = {};
            members.forEach(m => memberShiftCounts[m.id] = 0);

            for(let i=0; i<days; i++){
                if(i>0) currD.setDate(currD.getDate()+1);
                const dStr = `${currD.getFullYear()}-${String(currD.getMonth()+1).padStart(2,0)}-${String(currD.getDate()).padStart(2,0)}`;
                
                let assignedTodayIds = [];
                let shifts = {asa:'',hiru:'',yuu:'',chance:''};
                
                let slots = [
                    {k:'asa', type: 0}, {k:'hiru', type: 1}, {k:'yuu', type: 2}
                ];

                if (!chanceExclusion.includes(currW)) {
                    slots.push({k:'chance', type: 'chance'});
                } else {
                    shifts.chance = '-';
                }

                slots.forEach(s => {
                    s.candidates = members.filter(m => {
                        if (isHoliday(m.id, currD, holidaySettings)) return false;
                        const av = availability[m.id] || [];
                        if (s.type === 'chance') {
                            return m.grade == '1' && (av[currW*3] || av[currW*3+1] || av[currW*3+2]);
                        } else {
                            return av[currW*3 + s.type] === 1;
                        }
                    });
                    s.count = s.candidates.length;
                });
                
                slots.sort((a,b)=>a.count - b.count);

                slots.forEach(s => {
                    let validCandidates = s.candidates.filter(m => !assignedTodayIds.includes(m.id));

                    if(validCandidates.length > 0) {
                        validCandidates.forEach(m => {
                            m.score = 100;
                            if (method === 'standard') {
                                m.score -= memberShiftCounts[m.id] * 10;
                                let penalty = 0;
                                for (let k = 1; k < 30; k++) {
                                    if (i - k >= 0) {
                                        const pastShift = results[i - k];
                                        if(!pastShift || !pastShift.shifts) continue;
                                        const isAssignedAny = Object.values(pastShift.shifts).includes(m.name);
                                        const isAssignedSame = (pastShift.shifts[s.k] === m.name);
                                        if (isAssignedAny) {
                                            if (k === 7 || k === 14) penalty += 3000;
                                            if (isAssignedSame) { penalty += 1000 * Math.pow(0.79, k - 1); } 
                                            else { if (k < 10) penalty += 1000 * Math.pow(0.47, k - 1); }
                                        }
                                    }
                                }
                                m.score -= penalty;
                                m.score += Math.random();
                            } 
                            else if (method === 'count') {
                                m.score -= memberShiftCounts[m.id] * 100; 
                                m.score += Math.random();
                            } 
                            else if (method === 'random') {
                                m.score += Math.random() * 100;
                            }
                        });

                        validCandidates.sort((a, b) => b.score - a.score);
                        const picked = validCandidates[0];
                        shifts[s.k] = picked.name;
                        assignedTodayIds.push(picked.id);
                        memberShiftCounts[picked.id]++;
                    } else {
                        shifts[s.k] = '(担当不可)';
                    }
                });

                results.push({ date:dStr, dayOfWeek:W_LIST[currW], shifts:shifts, dayOfWeekIndex:currW });
                currW = (currW+1)%7;
            }

            dbSave('created_shift', results);
            renderGeneratedShift();
            alert(`作成しました\n期間: ${days}日間`);
        } catch(err) {
            console.error(err);
            alert("シフト作成中にエラーが発生しました。\n" + err.message);
        }
    });

    document.getElementById('reset-order-button').addEventListener('click', ()=>{
        const bk = dbLoad('members_last_order', []);
        if(bk.length){ 
            dbSave('members', bk); 
            alert('シフト作成前のメンバー順（バックアップ）に戻しました。'); 
        } else {
            alert('履歴がありません。');
        }
    });

    function renderGeneratedShift(){
        const res = dbLoad('created_shift', []);
        const cal = document.getElementById('generated-shift-calendar');
        if(!cal) return;
        if(!res.length){ cal.innerHTML='<p class="muted-text">まだシフトが作成されていません。</p>'; return; }
        
        let h='';
        const firstD = new Date(res[0].date);
        const empty = (firstD.getDay()+6)%7;
        for(let i=0; i<empty; i++) {
            h+='<div class="calendar-cell empty"></div>';
        }

        res.forEach(r => {
            const s = r.shifts;
            const isError = Object.values(s).includes('(担当不可)');
            
            h+=`<div class="calendar-cell ${isError ? 'has-error' : ''}" data-json='${JSON.stringify(r)}'>
                <div class="cell-date">${r.date} (${r.dayOfWeek})</div>
                <div>
                    <ul class="cell-shifts-ul">
                        <li class="cell-shifts-li">
                            <span class="shift-label">朝</span>
                            <span class="shift-member">${s.asa}</span>
                        </li>
                        <li class="cell-shifts-li">
                            <span class="shift-label">昼</span>
                            <span class="shift-member">${s.hiru}</span>
                        </li>
                        <li class="cell-shifts-li">
                            <span class="shift-label">夕</span>
                            <span class="shift-member">${s.yuu}</span>
                        </li>
                        <li class="cell-shifts-li">
                            <span class="shift-label">ち</span>
                            <span class="shift-member">${s.chance}</span>
                        </li>
                    </ul>
                </div>
            </div>`;
        });
        cal.innerHTML = h;
    }

    const genCal = document.getElementById('generated-shift-calendar');
    if(genCal) {
        genCal.addEventListener('click', e => {
            const cell = e.target.closest('.calendar-cell');
            if (!cell || cell.classList.contains('empty')) return;
            
            const data = JSON.parse(cell.dataset.json);
            const s = data.shifts;
            const dayIndex = data.dayOfWeekIndex;
            const targetDate = new Date(data.date);

            const members = dbLoad('members', []);
            const availability = dbLoad('availability', {});
            const createdShifts = dbLoad('created_shift', []);
            let holidaySettings = dbLoad('holiday_settings', []);

            if (members.length === 0) return;

            const getLastDate = (mName, typeKey) => {
                let lastDate = -1;
                for (const shift of createdShifts) {
                    if (shift.shifts && shift.shifts[typeKey] === mName) {
                        const d = new Date(shift.date).getTime();
                        if (d > lastDate) lastDate = d;
                    }
                }
                return lastDate;
            };

            const getCandidates = (typeKey, currentName) => {
                let cands = members.filter(m => {
                    if (isHoliday(m.id, targetDate, holidaySettings)) return false;
                    const av = availability[m.id] || [];
                    const idx = (typeKey === 'chance') ? -1 : (typeKey === 'asa' ? 0 : (typeKey === 'hiru' ? 1 : 2));
                    let isOk = false;
                    if (typeKey === 'chance') {
                        if (m.grade != '1') return false;
                        isOk = (av[dayIndex*3]===1 || av[dayIndex*3+1]===1 || av[dayIndex*3+2]===1);
                    } else { 
                        isOk = (av[dayIndex*3 + idx] === 1); 
                    }
                    return isOk && m.name !== currentName;
                });
                
                cands.sort((a, b) => {
                    const dateA = getLastDate(a.name, typeKey);
                    const dateB = getLastDate(b.name, typeKey);
                    return dateA - dateB;
                });
                return cands.map(m => m.name);
            };

            const subAsa = getCandidates('asa', s.asa);
            const subHiru = getCandidates('hiru', s.hiru);
            const subYuu = getCandidates('yuu', s.yuu);
            const subChance = getCandidates('chance', s.chance);

            document.getElementById('modal-title').textContent = `${data.date} の代打候補`;
            document.getElementById('modal-body-asa').innerHTML = `<span style="color:var(--accent-color);">${s.asa}</span> → ${subAsa.length ? subAsa.join(', ') : 'なし'}`;
            document.getElementById('modal-body-hiru').innerHTML = `<span style="color:var(--accent-color);">${s.hiru}</span> → ${subHiru.length ? subHiru.join(', ') : 'なし'}`;
            document.getElementById('modal-body-yuu').innerHTML = `<span style="color:var(--accent-color);">${s.yuu}</span> → ${subYuu.length ? subYuu.join(', ') : 'なし'}`;
            document.getElementById('modal-body-chance').innerHTML = `<span style="color:var(--accent-color);">${s.chance}</span> → ${subChance.length ? subChance.join(', ') : 'なし'}`;
            
            document.getElementById('modal-overlay').classList.add('visible');
        });
    }
    const modalClose = document.getElementById('modal-close-button');
    if(modalClose) modalClose.addEventListener('click', ()=>document.getElementById('modal-overlay').classList.remove('visible'));

    // 検索ロジック
    const innerTabLinks = document.querySelectorAll('.inner-tab-link');
    const searchContents = document.querySelectorAll('.search-mode-content');
    innerTabLinks.forEach(link => {
        link.addEventListener('click', () => {
            innerTabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const targetId = link.getAttribute('data-target');
            searchContents.forEach(content => {
                if (content.id === targetId) content.classList.add('active');
                else content.classList.remove('active');
            });
        });
    });

    const searchModalOverlay = document.getElementById('search-modal-overlay');
    const searchShiftForm = document.getElementById('search-shift-form');
    if(searchShiftForm){
        searchShiftForm.addEventListener('submit', e => {
            e.preventDefault();
            const members = dbLoad('members', []);
            const av = dbLoad('availability', {});
            const day = parseInt(document.getElementById('search-day').value);
            const time = document.getElementById('search-time').value;
            if(!members.length) return alert('メンバーがいません');
            
            let out = `【${W_LIST[day]}曜日】に入れる人\n-------------------------\n`;
            const targets = (time==='all') ? [0,1,2] : [parseInt(time)];
            targets.forEach(t => {
                out += `[${T_LIST[t]}] : \n`;
                const hits = members.filter(m => (av[m.id]||[])[day * 3 + t]===1).map(m=>m.name);
                out += hits.length ? hits.join(', ') + '\n' : 'なし\n';
                out += '\n';
            });
            document.getElementById('search-modal-title').textContent = "検索結果 (曜日・時間)";
            document.getElementById('search-modal-body').textContent = out;
            searchModalOverlay.classList.add('visible');
        });
    }

    const searchNameForm = document.getElementById('search-name-form');
    if(searchNameForm){
        searchNameForm.addEventListener('submit', e => {
            e.preventDefault();
            const targetName = document.getElementById('search-name-input').value.trim();
            if (!targetName) return;
            const members = dbLoad('members', []);
            const av = dbLoad('availability', {});
            const targetMember = members.find(m => m.name === targetName);
            
            if (!targetMember) { alert(`「${targetName}」は見つかりませんでした。`); return; }
            
            const memberAv = av[targetMember.id] || [];
            let availableSlots = [];
            for (let d = 0; d < 7; d++) {
                for (let t = 0; t < 3; t++) {
                    if (memberAv[d * 3 + t] === 1) availableSlots.push(`${W_LIST[d]}曜 ${T_LIST[t]}`);
                }
            }
            let out = `【${targetMember.name}】さんのシフト可能日\n-------------------------\n`;
            out += availableSlots.length > 0 ? availableSlots.join('\n') : "登録されている可能日はありません。";
            
            document.getElementById('search-modal-title').textContent = "検索結果 (名前)";
            document.getElementById('search-modal-body').textContent = out;
            searchModalOverlay.classList.add('visible');
        });
    }
    
    const searchModalClose = document.getElementById('search-modal-close-button');
    if(searchModalClose) searchModalClose.addEventListener('click', ()=>searchModalOverlay.classList.remove('visible'));

    // ==========================================
    // タブ3: データ閲覧
    // ==========================================
    function renderDataView() {
        const memEl = document.getElementById('data-view-members');
        if(!memEl) return;
        const m = dbLoad('members', []);
        const a = dbLoad('availability', {});
        const h = dbLoad('holiday_settings', []);
        memEl.textContent = JSON.stringify(m, null, 2);
        document.getElementById('data-view-availability').textContent = JSON.stringify(a, null, 2);
        document.getElementById('data-view-holiday').textContent = JSON.stringify(h, null, 2);
    }
    
    const clearBtn = document.getElementById('clear-all-data');
    if(clearBtn){
        clearBtn.addEventListener('click', ()=>{
            if(confirm('本当に全削除しますか？')) { localStorage.clear(); location.reload(); }
        });
    }

    // ==========================================
    // タブ4: 設定
    // ==========================================
    const themeToggle = document.getElementById('theme-toggle');
    if(themeToggle){
        if(localStorage.getItem('theme')==='dark') themeToggle.checked=true;
        themeToggle.addEventListener('change', e=>{
            if(e.target.checked){
                document.documentElement.setAttribute('data-theme','dark');
                localStorage.setItem('theme','dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme','light');
            }
        });
    }

    const chanceContainer = document.getElementById('chance-exclusion-settings');
    if(chanceContainer){
        const savedExclusion = dbLoad('chance_exclusion', []);
        chanceContainer.querySelectorAll('input').forEach(input => {
            if(savedExclusion.includes(parseInt(input.value))) input.checked = true;
        });
        chanceContainer.addEventListener('change', () => {
            const newExclusion = [];
            chanceContainer.querySelectorAll('input:checked').forEach(input => {
                newExclusion.push(parseInt(input.value));
            });
            dbSave('chance_exclusion', newExclusion);
        });
    }

    const exportBtn = document.getElementById('export-btn');
    if(exportBtn){
        exportBtn.addEventListener('click', ()=>{
            const data = {
                members: dbLoad('members', []),
                availability: dbLoad('availability', {}),
                chance_exclusion: dbLoad('chance_exclusion', []),
                holiday_settings: dbLoad('holiday_settings', []),
                date: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'shift_backup.json';
            a.click(); URL.revokeObjectURL(url);
        });
    }
    
    const impFile = document.getElementById('import-file');
    const importBtn = document.getElementById('import-btn');
    if(importBtn){
        importBtn.addEventListener('click', ()=>impFile.click());
        impFile.addEventListener('change', e=>{
            const f = e.target.files[0];
            if(!f) return;
            if(!confirm('上書きして復元しますか？')) return;
            const r = new FileReader();
            r.onload = ev => {
                try {
                    const d = JSON.parse(ev.target.result);
                    if(d.members && d.availability){
                        dbSave('members', d.members);
                        dbSave('availability', d.availability);
                        if(d.chance_exclusion) dbSave('chance_exclusion', d.chance_exclusion);
                        if(d.holiday_settings) dbSave('holiday_settings', d.holiday_settings);
                        alert('復元完了'); location.reload();
                    } else throw new Error();
                } catch(err){ alert('ファイルエラー'); }
            };
            r.readAsText(f);
        });
    }

    // 初期化
    renderAvailabilityGrid();
    renderHolidaySettings(); 
    renderDataView();
    renderGeneratedShift();
    updateNameSuggestions();
});