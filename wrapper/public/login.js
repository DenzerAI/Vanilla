document.querySelector('#login').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button');button.disabled=true;
  try {const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:form.token.value})});
    const result=await response.json();if(!response.ok)throw Error(result.error);location.assign('/');
  }catch(error){document.querySelector('#error').textContent=error.message;}finally{button.disabled=false;}
});
