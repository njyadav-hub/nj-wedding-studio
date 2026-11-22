const $=s=>document.querySelector(s);let mode='register';
function authOpen(){ $('#authModal').classList.remove('hidden'); }
['#heroCreate','#navCreate','#bottomCreate'].forEach(s=>$(s).onclick=authOpen);
$('#closeAuth').onclick=()=>$('#authModal').classList.add('hidden');
function setMode(m){mode=m;$('#authTitle').textContent=m==='register'?'Create your account':'Welcome back';$('#nameWrap').classList.toggle('hidden',m==='login');$('#authSubmit').textContent=m==='register'?'Create account':'Sign in';$('#authSwitch').innerHTML=m==='register'?'Already have an account? <button class="textbtn" id="switchAuth">Sign in</button>':'New to NJ Wedding Studio? <button class="textbtn" id="switchAuth">Create account</button>';$('#switchAuth').onclick=()=>setMode(mode==='register'?'login':'register');}
$('#switchAuth').onclick=()=>setMode('login');
$('#authForm').onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));try{const r=await fetch('/api/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json();if(!r.ok)throw Error(j.error);location.href='/dashboard.html';}catch(err){$('#authError').textContent=err.message;}};
