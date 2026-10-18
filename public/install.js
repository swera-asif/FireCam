export async function installApp({promptEvent,showGuide,notify}) {
 if(!promptEvent){showGuide();return;}
 try{await promptEvent.prompt();const result=await promptEvent.userChoice;if(result.outcome==='accepted')notify('FireCam was added to your apps.');else showGuide();}
 catch{notify('Installation is not available here. You can use your browser menu instead.');showGuide();}
}
