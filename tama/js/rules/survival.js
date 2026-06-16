// ルール：残基制（サバイバルモード）

function updateRuleUI() {
            const chkS = document.getElementById('chk-survival');
            const chkK = document.getElementById('chk-knockback');
            const chkE = document.getElementById('chk-escalation');
            const chkO = document.getElementById('chk-original');
            if (chkS && document.getElementById('setting-survival')) document.getElementById('setting-survival').style.display = chkS.checked ? 'block' : 'none';
            if (chkK && document.getElementById('setting-knockback')) document.getElementById('setting-knockback').style.display = chkK.checked ? 'block' : 'none';
            if (chkE && document.getElementById('setting-escalation')) document.getElementById('setting-escalation').style.display = chkE.checked ? 'block' : 'none';
            if (chkO && document.getElementById('setting-original')) document.getElementById('setting-original').style.display = chkO.checked ? 'block' : 'none';
        }

