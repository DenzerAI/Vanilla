const form=document.getElementById('login'),error=document.getElementById('error');
form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';form.querySelector('button').disabled=true;
  const name=form.elements.name.value.trim(),password=form.elements.password.value;
  try {const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(name?{name,password}:{token:password})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Anmeldung fehlgeschlagen.');
    location.assign('/');
  } catch(e){error.textContent=e.message;form.querySelector('button').disabled=false;}});
