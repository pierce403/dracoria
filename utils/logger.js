// Preserve fixed operational events without logging credentials, user rows or chat.
function emit(level,event,fields={}) {
  const output=JSON.stringify({time:new Date().toISOString(),level,event,...fields})+'\n';
  (level==='error'?process.stderr:process.stdout).write(output);
}
module.exports={
  info:()=>emit('info','application_event'),error:()=>emit('error','application_error'),debug:()=>{},
  event:(event,fields)=>emit('info',event,fields),
  installConsoleGate(){
    for(const method of ['log','info','warn','debug'])console[method]=()=>emit('info','application_event');
    console.error=()=>emit('error','application_error');
  },
};
